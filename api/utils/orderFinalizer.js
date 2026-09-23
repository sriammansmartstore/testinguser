import { adminDb, admin } from './firebaseAdmin.js';

/**
 * Shared idempotent order payment finalizer.
 * Called by BOTH /api/verify-razorpay-payment and /api/razorpay-webhook.
 *
 * @param {object} params
 * @param {string} params.internalOrderId - The internal order ID (e.g. ORD-...)
 * @param {string} params.razorpayOrderId - The Razorpay order ID (e.g. order_...)
 * @param {string} params.razorpayPaymentId - The Razorpay payment ID (e.g. pay_...)
 * @param {string} [params.razorpaySignature] - The verified Razorpay signature
 * @param {object} [params.paymentDetails] - Additional payment details (method, email, etc.)
 * @param {'client' | 'webhook' | 'zero_total'} params.triggerSource - Source of the finalization
 * @returns {Promise<{ success: boolean, alreadyFinalized?: boolean, orderId: string }>}
 */
export async function finalizeOrderPayment({
  internalOrderId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature = null,
  paymentDetails = {},
  triggerSource = 'client'
}) {
  if (!internalOrderId) {
    throw new Error('internalOrderId is required for order finalization');
  }

  const orderRef = adminDb.collection('orders').doc(internalOrderId);

  return await adminDb.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new Error(`Order ${internalOrderId} not found in Firestore`);
    }

    const orderData = orderSnap.data();

    // 1. Idempotency Check: if already finalized as Paid, return immediately without re-deducting or re-awarding
    if (orderData.paymentStatus === 'Paid' || orderData.status === 'Confirmed') {
      console.log(`[orderFinalizer] Order ${internalOrderId} already finalized. Returning cleanly.`);
      return {
        success: true,
        alreadyFinalized: true,
        orderId: internalOrderId
      };
    }

    // 2. Validate Razorpay Order ID matches what was created on the order (except zero-total checkouts)
    if (triggerSource !== 'zero_total' && razorpayOrderId && orderData.razorpayOrderId) {
      if (orderData.razorpayOrderId !== razorpayOrderId) {
        throw new Error(`Security Alert: Razorpay order ID mismatch for order ${internalOrderId}`);
      }
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const userDocId = orderData.buyerId || orderData.userProfile?.userDocId || orderData.buyerUid;

    // 3. Prepare updated order data
    const updatedOrder = {
      status: 'Confirmed',
      paymentStatus: 'Paid',
      paidAt: now,
      finalizedVia: triggerSource,
      razorpayDetails: {
        ...(orderData.razorpayDetails || {}),
        orderId: razorpayOrderId || orderData.razorpayOrderId || null,
        paymentId: razorpayPaymentId || null,
        signature: razorpaySignature || null,
        ...paymentDetails
      }
    };

    // Update main order document
    transaction.update(orderRef, updatedOrder);

    // 4. Duplicate to users/{userDocId}/orders/{internalOrderId}
    if (userDocId) {
      const userOrderRef = adminDb.collection('users').doc(userDocId).collection('orders').doc(internalOrderId);
      transaction.set(userOrderRef, { ...orderData, ...updatedOrder }, { merge: true });
    }

    // 5. Atomic Coin Deduction & Reservation Release
    const usedCoins = Number(orderData.usedCoins || 0);
    if (userDocId) {
      const userRef = adminDb.collection('users').doc(userDocId);
      const userSnap = await transaction.get(userRef);

      if (userSnap.exists) {
        const userData = userSnap.data() || {};
        const currentCoins = Number(userData.coins || 0);

        // Deduct used coins and clear reservation for this order
        const newCoins = Math.max(0, currentCoins - usedCoins);
        
        // Remove coin reservation if present
        let activeReservations = userData.reservedCoins || [];
        if (Array.isArray(activeReservations)) {
          activeReservations = activeReservations.filter(r => r.orderId !== internalOrderId);
        } else {
          activeReservations = [];
        }

        const userUpdates = {
          coins: newCoins,
          reservedCoins: activeReservations,
          lastUpdated: now
        };

        transaction.update(userRef, userUpdates);

        // Record coin usage in user's coin history if coins were actually used
        if (usedCoins > 0) {
          const coinHistRef = adminDb.collection('users').doc(userDocId).collection('coinHistory').doc();
          transaction.set(coinHistRef, {
            type: 'DEBIT',
            amount: usedCoins,
            reason: `Used for Order #${internalOrderId}`,
            orderId: internalOrderId,
            balanceAfter: newCoins,
            createdAt: now
          });
        }
      }
    }

    // 6. Award Purchase Coins and Referrer Coins (if any)
    try {
      const subtotal = Number(orderData.subtotal || 0);
      const rewardCoinRate = 0.01; // e.g. 1 coin per 100 rupees
      const earnedCoins = Math.floor(subtotal * rewardCoinRate);

      if (earnedCoins > 0 && userDocId) {
        const userRef = adminDb.collection('users').doc(userDocId);
        transaction.update(userRef, {
          coins: admin.firestore.FieldValue.increment(earnedCoins)
        });

        const earnHistRef = adminDb.collection('users').doc(userDocId).collection('coinHistory').doc();
        transaction.set(earnHistRef, {
          type: 'CREDIT',
          amount: earnedCoins,
          reason: `Earned from Order #${internalOrderId}`,
          orderId: internalOrderId,
          createdAt: now
        });
      }

      // Referrer bonus
      const referrerId = orderData.referrerId;
      if (referrerId) {
        const refUserRef = adminDb.collection('users').doc(referrerId);
        const refBonus = Math.floor(subtotal * 0.02); // 2% referral reward
        if (refBonus > 0) {
          transaction.update(refUserRef, {
            coins: admin.firestore.FieldValue.increment(refBonus)
          });
          const refHistRef = adminDb.collection('users').doc(referrerId).collection('coinHistory').doc();
          transaction.set(refHistRef, {
            type: 'CREDIT',
            amount: refBonus,
            reason: `Referral bonus from buyer's Order #${internalOrderId}`,
            orderId: internalOrderId,
            createdAt: now
          });
        }
      }
    } catch (rewardErr) {
      console.warn('[orderFinalizer] Non-critical error awarding coins:', rewardErr);
    }

    // 7. Partial Cart Item Removal (Only purchased items and quantities)
    if (userDocId && Array.isArray(orderData.cartItems) && orderData.cartItems.length > 0) {
      const cartCollectionRef = adminDb.collection('users').doc(userDocId).collection('cart');
      // Read current cart docs
      const cartDocsSnap = await cartCollectionRef.get();
      
      for (const cartDoc of cartDocsSnap.docs) {
        const cartItem = cartDoc.data();
        // Match purchased item by cartItemId or product id + variant
        const purchasedMatch = orderData.cartItems.find(p => 
          p.cartItemId === cartDoc.id || 
          p.id === cartItem.id && (p.unit === cartItem.unit && String(p.unitSize) === String(cartItem.unitSize))
        );

        if (purchasedMatch) {
          const currentQty = Number(cartItem.qty || cartItem.quantity || 1);
          const purchasedQty = Number(purchasedMatch.qty || purchasedMatch.quantity || 1);

          if (currentQty <= purchasedQty) {
            // Completely purchased -> delete cart document
            transaction.delete(cartDoc.ref);
          } else {
            // Partially purchased -> decrement quantity only
            transaction.update(cartDoc.ref, {
              qty: currentQty - purchasedQty,
              quantity: currentQty - purchasedQty,
              updatedAt: now
            });
          }
        }
      }
    }

    return {
      success: true,
      alreadyFinalized: false,
      orderId: internalOrderId
    };
  });
}
