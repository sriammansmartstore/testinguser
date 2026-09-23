import { db } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Ensures a mapping exists between Firebase Auth UID and a unified userDocId (e.g. SASS0000006).
 * If the user's email or phone matches an existing document in `users`, links the UID to that document
 * so all historical data ("old memory" — orders, addresses, cart, coins, profile) is immediately restored.
 *
 * @param {string} uid - Firebase Auth user UID
 * @param {string|null} email - User email (optional)
 * @param {string|null} phoneNumber - User phone number (optional)
 * @returns {Promise<string>} The userDocId (e.g. 'SASS0000006')
 */
export async function ensureUserDocId(uid, email = null, phoneNumber = null) {
  if (!uid) return null;

  try {
    const cleanEmail = email && typeof email === 'string' ? email.trim() : null;
    const lowerEmail = cleanEmail ? cleanEmail.toLowerCase() : null;

    // 1. Check existing mapping in usersByUid/{uid}
    const mapRef = doc(db, 'usersByUid', uid);
    const mapSnap = await getDoc(mapRef);
    if (mapSnap.exists()) {
      const existingDocId = mapSnap.data()?.userDocId;
      if (existingDocId) {
        const userDocRef = doc(db, 'users', existingDocId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const updates = {};
          if (cleanEmail && !userDocSnap.data().email) {
            updates.email = cleanEmail;
          }
          if (phoneNumber && !userDocSnap.data().number) {
            updates.number = String(phoneNumber).replace(/\D/g, '');
          }
          if (Object.keys(updates).length > 0) {
            await setDoc(userDocRef, updates, { merge: true });
          }
          return existingDocId;
        }
      }
    }

    // 2. If not mapped or mapped doc doesn't exist, search by email in 'users'
    if (lowerEmail) {
      const usersCol = collection(db, 'users');
      let matchedDoc = null;

      // Query exact email first
      const qExact = query(usersCol, where('email', '==', cleanEmail));
      const snapExact = await getDocs(qExact);
      if (!snapExact.empty) {
        matchedDoc = snapExact.docs[0];
      } else if (cleanEmail !== lowerEmail) {
        const qLower = query(usersCol, where('email', '==', lowerEmail));
        const snapLower = await getDocs(qLower);
        if (!snapLower.empty) {
          matchedDoc = snapLower.docs[0];
        }
      }

      // Fallback: check all existing docs case-insensitively
      if (!matchedDoc) {
        const allUsersSnap = await getDocs(usersCol);
        allUsersSnap.forEach((d) => {
          const data = d.data();
          if (data?.email && data.email.toLowerCase().trim() === lowerEmail) {
            matchedDoc = d;
          }
        });
      }

      if (matchedDoc) {
        const foundUserDocId = matchedDoc.id;
        // Link this UID to the existing user doc
        await setDoc(mapRef, {
          userDocId: foundUserDocId,
          uid,
          email: cleanEmail,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Update the user doc with the new UID
        await setDoc(doc(db, 'users', foundUserDocId), {
          uid,
          email: cleanEmail,
          lastLogin: serverTimestamp()
        }, { merge: true });

        return foundUserDocId;
      }
    }

    // 3. Search by phone number in 'users' if provided
    if (phoneNumber) {
      const cleanPhone = String(phoneNumber).replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const phone10 = cleanPhone.slice(-10);
        const usersCol = collection(db, 'users');
        const qPhone = query(usersCol, where('number', '==', phone10));
        const snapPhone = await getDocs(qPhone);
        if (!snapPhone.empty) {
          const foundDoc = snapPhone.docs[0];
          const foundUserDocId = foundDoc.id;
          await setDoc(mapRef, {
            userDocId: foundUserDocId,
            uid,
            number: phone10,
            updatedAt: serverTimestamp()
          }, { merge: true });

          await setDoc(doc(db, 'users', foundUserDocId), {
            uid,
            lastLogin: serverTimestamp()
          }, { merge: true });

          return foundUserDocId;
        }
      }
    }

    // 4. If no existing user document found, generate sequential SASS ID
    const seqRef = doc(db, 'meta', 'userSequence');
    const nextId = await runTransaction(db, async (tx) => {
      const seqSnap = await tx.get(seqRef);
      const curr = seqSnap.exists() ? (seqSnap.data().current || 0) : 0;
      const updated = curr + 1;
      tx.set(seqRef, { current: updated }, { merge: true });
      return updated;
    });
    const pad = String(nextId).padStart(7, '0');
    const newUserId = `SASS${pad}`;

    // Create the mapping in usersByUid
    await setDoc(mapRef, {
      userDocId: newUserId,
      uid,
      email: cleanEmail,
      createdAt: serverTimestamp()
    }, { merge: true });

    // Initialize user document in users
    await setDoc(doc(db, 'users', newUserId), {
      userId: newUserId,
      uid,
      email: cleanEmail,
      createdAt: serverTimestamp()
    }, { merge: true });

    return newUserId;
  } catch (err) {
    console.error('ensureUserDocId error:', err);
    return uid;
  }
}

/**
 * Quick helper to get userDocId from usersByUid
 */
export async function getUserDocId(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'usersByUid', uid));
    if (snap.exists() && snap.data()?.userDocId) {
      return snap.data().userDocId;
    }
    return uid;
  } catch (_) {
    return uid;
  }
}
