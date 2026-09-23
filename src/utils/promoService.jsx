import { db } from '../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

/**
 * Fetch a promo document by its code from Firestore and perform basic validation.
 * Throws an Error with a user-friendly message when invalid.
 * Returns the promo object with its Firestore id on success.
 */
export async function fetchPromoByCode(code) {
  if (!code || !String(code).trim()) {
    throw new Error('Please enter a promo code');
  }

  const normalized = String(code).trim();
  const promosRef = collection(db, 'promos');
  const q = query(promosRef, where('code', '==', normalized), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error('Invalid promo code');
  }

  const doc = snap.docs[0];
  const data = doc.data();

  // Basic validation rules to prevent fake codes being applied
  if (data.isExpired) {
    throw new Error('This promo code has expired');
  }

  // Ensure amount and type exist and are sensible
  if (typeof data.amount !== 'number' || !data.type) {
    throw new Error('Invalid promo configuration');
  }

  return {
    id: doc.id,
    code: data.code,
    amount: data.amount,
    type: data.type, // expected values: 'percentage' or 'rupee'
    isExpired: !!data.isExpired,
    createdAt: data.createdAt || null,
    raw: data,
  };
}
