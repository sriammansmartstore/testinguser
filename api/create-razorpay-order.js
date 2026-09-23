import { adminDb, admin, verifyAuthToken } from './utils/firebaseAdmin.js';
import { getRazorpayClient } from './utils/razorpayClient.js';
import { reserveCoins, releaseCoinsReservation } from './utils/coinManager.js';
import { finalizeOrderPayment } from './utils/orderFinalizer.js';

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(455 || 405).json({ error: 'Method Not Allowed' });
  }

  let internalOrderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  let userDocId = null;
  let reservedCoinsAmount = 0;

  try {
    // 1. Authenticate user from Firebase ID Token
    const authUser = await verifyAuthToken(req);
    const uid = authUser.uid;

    // Resolve user document ID (custom SASS ID or uid)
    const mapSnap = await adminDb.collection('usersByUid').doc(uid).get();
    userDocId = mapSnap.exists ? (mapSnap.data()?.userDocId || uid) : uid;

    const {
      cartItems = [],
      deliveryOption = 'standard',
      address = null,
      coinsToUse = 0,
      promoCode = null,
      claimGST = false,
      gstDetails = null,
      verifiedPhoneNumber = null
    } = req.body || {};

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty or invalid' });
    }

    if (!address) {
      return res.status(400).json({ error: 'Delivery address is required' });
    }

    // 2. Fetch and Validate Product Prices from Firestore (NEVER trust frontend prices)
    let verifiedSubtotal = 0;
    const verifiedItems = [];

    for (const item of cartItems) {
      const productId = item.id;
      const category = item.category || 'general';
      const quantity = Math.max(1, Math.floor(Number(item.qty || item.quantity || 1)));

      if (!productId) {
        throw new Error('Invalid cart item: missing product ID');
      }

      // Try fetching product document
      let productSnap = await adminDb.collection('products').doc(category).collection('items').doc(productId).get();
      
      // Fallback: search across all categories if category path not found
      if (!productSnap.exists) {
        const querySnap = await adminDb.collectionGroup('items').where(admin.firestore.FieldPath.documentId(), '==', productId).limit(1).get();
        if (!querySnap.empty) {
          productSnap = querySnap.docs[0];
        }
      }

      if (!productSnap.exists) {
        throw new Error(`Product not found or unavailable: ${item.name || productId}`);
      }

      const productData = productSnap.data();

      // Check product availability
      if (productData.available === false) {
        throw new Error(`Product "${productData.name}" is currently out of stock`);
      }

      // Match selected variant / option if options array exists
      let selectedOption = null;
      if (Array.isArray(productData.options) && productData.options.length > 0) {
        selectedOption = productData.options.find(opt => 
          (item.unit && opt.unit === item.unit) &&
          (item.unitSize && String(opt.unitSize) === String(item.unitSize))
        ) || productData.options[0];
      }

      // Determine verified selling price
      const verifiedPrice = Number(
        selectedOption?.sellingPrice ??
        productData.sellingPrice ??
        productData.price ??
        0
      );

      if (verifiedPrice < 0) {
        throw new Error(`Invalid price for product: ${productData.name}`);
      }

      verifiedSubtotal += verifiedPrice * quantity;

      verifiedItems.push({
        id: productId,
        cartItemId: item.cartItemId || null,
        name: productData.name || item.name,
        qty: quantity,
        price: verifiedPrice,
        unit: selectedOption?.unit || item.unit || '',
        unitSize: selectedOption?.unitSize || item.unitSize || '',
        imageUrl: productData.imageUrls?.[0] || productData.imageUrl || item.imageUrl || '',
        category: productData.category || category
      });
    }

    // 3. Server-side Delivery Fee Calculation
    const isExpress = deliveryOption === 'express';
    let deliveryFee = 0;
    if (isExpress) {
      deliveryFee = verifiedSubtotal > 2000 ? 0 : 99;
    } else {
      deliveryFee = verifiedSubtotal > 500 ? 0 : 49;
    }

    // 4. Promo Code Validation
    let promoDiscount = 0;
    let validatedPromo = null;
    if (promoCode && typeof promoCode === 'string') {
      const cleanPromo = promoCode.trim().toUpperCase();
      const promoSnap = await adminDb.collection('Settings').doc('promos').get();
      if (promoSnap.exists) {
        const promos = promoSnap.data()?.list || [];
        const found = promos.find(p => p.code?.toUpperCase() === cleanPromo && p.active !== false);
        if (found) {
          if (found.type === 'percentage' || found.type === 'percent') {
            promoDiscount = Math.round((verifiedSubtotal * Number(found.amount || 0)) / 100);
          } else {
            promoDiscount = Number(found.amount || 0);
          }
          promoDiscount = Math.min(promoDiscount, verifiedSubtotal);
          validatedPromo = { code: cleanPromo, discount: promoDiscount };
        }
      }
    }

    // 5. Coins Discount & Concurrency Reservation
    let coinValue = 1;
    let safeCoinsToUse = 0;
    let coinsDiscount = 0;

    const requestedCoins = Math.max(0, Math.floor(Number(coinsToUse || 0)));
    if (requestedCoins > 0) {
      // Get rupee value per coin
      const coinSettingSnap = await adminDb.collection('Settings').doc('CoinValue').get();
      if (coinSettingSnap.exists) {
        const rawVal = coinSettingSnap.data()?.CoinValue;
        coinValue = Number(rawVal) || 1;
      }

      // Max coins that can be applied to post-promo product total
      const payableBeforeCoins = Math.max(0, verifiedSubtotal - promoDiscount);
      const maxCoinsByMoney = Math.floor(payableBeforeCoins / coinValue);
      safeCoinsToUse = Math.min(requestedCoins, maxCoinsByMoney);

      if (safeCoinsToUse > 0) {
        // Reserve coins atomically to prevent double spending
        await reserveCoins(userDocId, safeCoinsToUse, internalOrderId);
        reservedCoinsAmount = safeCoinsToUse;
        coinsDiscount = safeCoinsToUse * coinValue;
      }
    }

    // 6. Calculate Final Total Amount
    const finalTotal = Math.max(0, Number((verifiedSubtotal + deliveryFee - promoDiscount - coinsDiscount).toFixed(2)));
    const amountInPaise = Math.round(finalTotal * 100);

    // Fetch user profile info
    const userDocSnap = await adminDb.collection('users').doc(userDocId).get();
    const userData = userDocSnap.exists ? userDocSnap.data() : {};
    const referrerId = userData?.referredBy || null;

    // 7. Base Order Document Structure
    const initialOrderData = {
      orderId: internalOrderId,
      buyerUid: uid,
      buyerId: userDocId,
      referrerId,
      userProfile: {
        uid,
        userDocId,
        fullName: userData?.fullName || authUser.name || '',
        email: userData?.email || authUser.email || '',
        number: verifiedPhoneNumber || userData?.number || authUser.phone_number || ''
      },
      address,
      cartItems: verifiedItems,
      subtotal: verifiedSubtotal,
      discount: promoDiscount,
      promo: validatedPromo,
      deliveryFee,
      deliveryMethod: isExpress ? 'express' : 'standard',
      coinsApplied: safeCoinsToUse > 0,
      usedCoins: safeCoinsToUse,
      coinValue,
      coinsDiscount,
      total: finalTotal,
      amountInPaise,
      claimGST: Boolean(claimGST),
      gstDetails: claimGST ? gstDetails : null,
      paymentMethod: finalTotal === 0 ? 'ZeroTotal' : 'Razorpay',
      paymentStatus: 'Pending',
      status: 'Pending',
      razorpayOrderId: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 8. Handle Zero-Total Checkout (100% covered by promo/coins)
    if (amountInPaise === 0) {
      initialOrderData.paymentStatus = 'Paid';
      initialOrderData.status = 'Confirmed';
      
      // Save order
      await adminDb.collection('orders').doc(internalOrderId).set(initialOrderData);

      // Finalize immediately using shared finalizer
      await finalizeOrderPayment({
        internalOrderId,
        triggerSource: 'zero_total'
      });

      return res.status(200).json({
        success: true,
        zeroTotal: true,
        internalOrderId,
        amount: 0,
        currency: 'INR'
      });
    }

    // 9. Create Razorpay Order via Official SDK
    const razorpay = getRazorpayClient();
    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: internalOrderId,
      notes: {
        internalOrderId,
        buyerUid: uid,
        buyerId: userDocId
      }
    });

    // Store Razorpay order ID on the initial Firestore order
    initialOrderData.razorpayOrderId = rzpOrder.id;
    await adminDb.collection('orders').doc(internalOrderId).set(initialOrderData);

    // Return order details to frontend for Razorpay Checkout modal
    return res.status(200).json({
      success: true,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency || 'INR',
      internalOrderId
    });

  } catch (err) {
    console.error('[create-razorpay-order] Error:', err);

    // Release coin reservation if error occurred
    if (userDocId && reservedCoinsAmount > 0) {
      await releaseCoinsReservation(userDocId, internalOrderId);
    }

    return res.status(err.message?.includes('Unauthorized') ? 401 : 400).json({
      error: err.message || 'Failed to create payment order'
    });
  }
}
