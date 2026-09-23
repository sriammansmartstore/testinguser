import { adminDb } from './firebaseAdmin.js';

const RESERVATION_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

/**
 * Atomically reserve coins for an order to prevent double-spending in concurrent checkouts.
 *
 * @param {string} userDocId
 * @param {number} coinsToUse
 * @param {string} orderId
 * @returns {Promise<{ success: boolean, reservedAmount: number }>}
 */
export async function reserveCoins(userDocId, coinsToUse, orderId) {
  if (!coinsToUse || coinsToUse <= 0 || !userDocId) {
    return { success: true, reservedAmount: 0 };
  }

  const userRef = adminDb.collection('users').doc(userDocId);

  return await adminDb.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) {
      throw new Error(`User ${userDocId} not found for coin reservation`);
    }

    const userData = userSnap.data() || {};
    const totalBalance = Number(userData.coins || 0);
    const now = Date.now();

    // Filter out expired reservations
    let existingReservations = Array.isArray(userData.reservedCoins) ? userData.reservedCoins : [];
    existingReservations = existingReservations.filter(r => r.expiresAt > now && r.orderId !== orderId);

    const currentlyReserved = existingReservations.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const availableCoins = Math.max(0, totalBalance - currentlyReserved);

    if (coinsToUse > availableCoins) {
      throw new Error(`Insufficient unreserved coins. Available: ${availableCoins}, Requested: ${coinsToUse}`);
    }

    // Add new reservation
    const newReservation = {
      orderId,
      amount: coinsToUse,
      expiresAt: now + RESERVATION_TTL_MS,
      createdAt: now
    };

    existingReservations.push(newReservation);
    transaction.update(userRef, {
      reservedCoins: existingReservations
    });

    return {
      success: true,
      reservedAmount: coinsToUse
    };
  });
}

/**
 * Release coin reservation if payment fails or user cancels
 *
 * @param {string} userDocId
 * @param {string} orderId
 */
export async function releaseCoinsReservation(userDocId, orderId) {
  if (!userDocId || !orderId) return;

  const userRef = adminDb.collection('users').doc(userDocId);
  try {
    await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) return;

      const userData = userSnap.data() || {};
      let reservations = Array.isArray(userData.reservedCoins) ? userData.reservedCoins : [];
      reservations = reservations.filter(r => r.orderId !== orderId);

      transaction.update(userRef, {
        reservedCoins: reservations
      });
    });
  } catch (err) {
    console.warn(`[coinManager] Failed to release coin reservation for order ${orderId}:`, err.message);
  }
}
