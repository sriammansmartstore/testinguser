import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

// This hook fetches referral code, referred friends, and progress for a user
const useReferralProgress = (userId) => {
  const [referralCode, setReferralCode] = useState('');
  const [referredFriends, setReferredFriends] = useState([]);
  const [rewardCoins, setRewardCoins] = useState(100); // Example: 100 coins per referral

  useEffect(() => {
    if (!userId) return;
    // Fetch or generate referral code and listen for changes
    const userRef = doc(db, 'users', userId);
    const unsub = onSnapshot(userRef, async (userSnap) => {
      if (userSnap.exists()) {
        let code = userSnap.data().referralCode;
        if (!code) {
          code = userId.slice(-6); // Simple fallback
          await setDoc(userRef, { referralCode: code }, { merge: true });
        }
        setReferralCode(code || userId.slice(-6));
      }
    });
    // Fetch referred friends and their order progress
    const fetchReferredFriends = async () => {
      const q = query(collection(db, 'users'), where('referredBy', '==', userId));
      const querySnapshot = await getDocs(q);
      const friends = [];
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        // Assume 'orderTotalReceived' is tracked in user doc
        friends.push({
          uid: docSnap.id,
          name: data.name,
          email: data.email,
          progress: data.orderTotalReceived || 0,
        });
      }
      setReferredFriends(friends);
    };
    fetchReferredFriends();
    return () => unsub();
  }, [userId]);

  return { referralCode, referredFriends, rewardCoins };
};

export default useReferralProgress;
