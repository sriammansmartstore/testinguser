import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const useGSTDetails = () => {
  const { user } = useContext(AuthContext);
  const [gstDetails, setGSTDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load saved GST details from Firestore
  useEffect(() => {
    if (!user) {
      setGSTDetails(null);
      setLoading(false);
      return;
    }

    const loadGSTDetails = async () => {
      try {
        const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
        const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
        const gstDocRef = doc(db, 'users', userDocId, 'settings', 'gst');
        const gstDoc = await getDoc(gstDocRef);
        
        if (gstDoc.exists()) {
          setGSTDetails(gstDoc.data());
        } else {
          setGSTDetails({
            gstNumber: '',
            businessName: '',
            businessAddress: ''
          });
        }
      } catch (err) {
        console.error('Error loading GST details:', err);
        setError('Failed to load GST details');
      } finally {
        setLoading(false);
      }
    };

    loadGSTDetails();
  }, [user]);

  // Save GST details to Firestore
  const saveGSTDetails = async (details) => {
    if (!user) return;

    try {
      const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
      const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
      const gstDocRef = doc(db, 'users', userDocId, 'settings', 'gst');
      await setDoc(gstDocRef, details);
      setGSTDetails(details);
    } catch (err) {
      console.error('Error saving GST details:', err);
      setError('Failed to save GST details');
      throw err;
    }
  };

  return {
    gstDetails,
    setGSTDetails: saveGSTDetails,
    loading,
    error
  };
};