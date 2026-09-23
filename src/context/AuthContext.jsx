import React, { createContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { ensureUserDocId } from "../utils/userUtils";

export const AuthContext = createContext({
  user: undefined,
  userDetails: null,
  userDocId: null,
  loading: true
});

export const AuthProvider = ({ children }) => {
  // Start with undefined so route guards (RequireAuth) know auth is still initializing
  const [user, setUser] = useState(undefined);
  const [userDetails, setUserDetails] = useState(null);

  useEffect(() => {
    let userDocUnsub = null;
    let mapUnsub = null;
    let isCancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (isCancelled) return;
      setUser(u);

      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }
      if (mapUnsub) {
        mapUnsub();
        mapUnsub = null;
      }

      if (u) {
        try {
          // Listen to mapping doc usersByUid/{uid}
          const mapRef = doc(db, 'usersByUid', u.uid);
          mapUnsub = onSnapshot(mapRef, async (mapSnap) => {
            if (isCancelled) return;
            let userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || null) : null;

            // Self-heal: If mapping doesn't exist, link to existing account by email or create SASS id
            if (!userDocId) {
              try {
                userDocId = await ensureUserDocId(u.uid, u.email || null, u.phoneNumber || null);
              } catch (e) {
                console.warn("Self-heal userDocId error:", e);
              }
            }

            if (userDocId) {
              if (userDocUnsub) {
                userDocUnsub();
                userDocUnsub = null;
              }
              const userDocRef = doc(db, 'users', userDocId);
              userDocUnsub = onSnapshot(userDocRef, (userDocSnap) => {
                if (isCancelled) return;
                if (userDocSnap.exists()) {
                  setUserDetails(userDocSnap.data());
                } else {
                  setUserDetails(null);
                }
              }, () => {
                if (!isCancelled) setUserDetails(null);
              });
            } else {
              setUserDetails(null);
            }
          }, () => {
            if (!isCancelled) setUserDetails(null);
          });
        } catch (err) {
          console.error("AuthContext listener setup error:", err);
          setUserDetails(null);
        }
      } else {
        setUserDetails(null);
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
      if (userDocUnsub) userDocUnsub();
      if (mapUnsub) mapUnsub();
    };
  }, []);

  const userDocId = userDetails?.userId || null;
  const loading = user === undefined;

  return (
    <AuthContext.Provider value={{ user, userDetails, userDocId, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
