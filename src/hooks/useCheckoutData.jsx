import { useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, onSnapshot, doc, getDoc, getDocs } from "firebase/firestore";

/**
 * @description Custom hook to fetch all data required for the checkout page.
 * @param {Function} setInitiallySelectedAddress - A function to set the default selected address once addresses are loaded.
 * @returns {object} An object containing userProfile, addresses, cartItems, loading state, and error state.
 */
export const useCheckoutData = (setInitiallySelectedAddress) => {
  const { user } = useContext(AuthContext);
  const [userProfile, setUserProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Resolve the real user document id (usersByUid -> users)
  const resolveUserDocId = useCallback(async (u) => {
    if (!u) return null;
    try {
      const mapRef = doc(db, 'usersByUid', u.uid);
      const mapSnap = await getDoc(mapRef);
      const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || u.uid) : u.uid;
      return userDocId;
    } catch (err) {
      console.error('Error resolving userDocId:', err);
      return u.uid;
    }
  }, []);

  // Function to fetch cart data
  const fetchCartData = useCallback(async () => {
    if (!user) return [];

    try {
      const userDocId = await resolveUserDocId(user);
      const cartColRef = collection(db, "users", userDocId, "cart");
      const cartSnap = await getDocs(cartColRef);
      const items = cartSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      console.log('Fetched cart items:', items);
      return items;
    } catch (err) {
      console.error("Error fetching cart data:", err);
      setError("Failed to load your cart. Please try again later.");
      return [];
    }
  }, [user, resolveUserDocId]);

  // Function to refresh all data
  const refreshData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Resolve userDocId and refresh user profile
      const userDocId = await resolveUserDocId(user);
      const userDocRef = doc(db, "users", userDocId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        setUserProfile(userDocSnap.data());
      }

      // Refresh cart items
      const updatedCartItems = await fetchCartData();
      setCartItems(updatedCartItems);

      // Addresses are handled by the real-time listener
    } catch (err) {
      console.error("Error refreshing data:", err);
      setError("Failed to refresh data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, fetchCartData]);

  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      setAddresses([]);
      setCartItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        // Fetch user profile
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserProfile(userDocSnap.data());
        }

        // Fetch cart items
        const updatedCartItems = await fetchCartData();
        setCartItems(updatedCartItems);
      } catch (err) {
        console.error("Error fetching checkout data:", err);
        setError("Failed to load your checkout details. Please try again later.");
      } finally {
        // Loading is set to false after addresses listener is set up
      }
    };

    fetchData();

    // Set up real-time listeners for addresses and cart using mapped userDocId
    let unsubscribeAddresses = () => {};
    let unsubscribeCart = () => {};

    (async () => {
      let activeUserDocId = user.uid;
      try {
        activeUserDocId = await resolveUserDocId(user) || user.uid;
      } catch (e) {
        activeUserDocId = user.uid;
      }

      // Addresses listener
      try {
        const addressesColRef = collection(db, "users", activeUserDocId, "addresses");
        unsubscribeAddresses = onSnapshot(
          addressesColRef,
          (snapshot) => {
            const addrList = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            setAddresses(addrList);

            // Set the default selected address if not already set
            if (addrList.length > 0) {
              setInitiallySelectedAddress((prevId) => prevId || addrList[0].id);
            }
            setLoading(false); // Data loading complete
          },
          (err) => {
            console.error("Error listening to addresses:", err);
            setError("Failed to load delivery addresses.");
            setLoading(false);
          }
        );
      } catch (e) {
        console.error('Failed to set addresses listener', e);
      }

      // Cart listener
      try {
        const cartColRef = collection(db, "users", activeUserDocId, "cart");
        unsubscribeCart = onSnapshot(
          cartColRef,
          (snapshot) => {
            const updatedCartItems = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data()
            }));
            setCartItems(updatedCartItems);
          },
          (err) => {
            console.error("Error listening to cart:", err);
            setError("Failed to update cart items.");
          }
        );
      } catch (e) {
        console.error('Failed to set cart listener', e);
      }
    })();

    // Cleanup listeners on component unmount
    return () => {
      try { if (unsubscribeAddresses) unsubscribeAddresses(); } catch (_) {}
      try { if (unsubscribeCart) unsubscribeCart(); } catch (_) {}
    };
  }, [user, setInitiallySelectedAddress, fetchCartData, refreshTrigger]);

  return { userProfile, addresses, cartItems, loading, error, refreshData };
};
