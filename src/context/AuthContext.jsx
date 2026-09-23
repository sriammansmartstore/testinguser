import React, { createContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

export const AuthContext = createContext({ user: null, userDetails: null });

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);

  useEffect(() => {
    let userDocUnsub = null;
    let mapUnsub = null;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
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
        // first resolve mapping usersByUid/{uid} -> { userDocId }
        const mapRef = doc(db, 'usersByUid', u.uid);
        mapUnsub = onSnapshot(mapRef, (mapSnap) => {
          if (userDocUnsub) { userDocUnsub(); userDocUnsub = null; }
          const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || null) : null;
          if (userDocId) {
            const userDocRef = doc(db, 'users', userDocId);
            userDocUnsub = onSnapshot(userDocRef, (userDocSnap) => {
              if (userDocSnap.exists()) {
                setUserDetails(userDocSnap.data());
              } else {
                setUserDetails(null);
              }
            }, () => setUserDetails(null));
          } else {
            setUserDetails(null);
          }
        }, () => setUserDetails(null));
      } else {
        setUserDetails(null);
      }
    });
    return () => {
      unsubscribe();
      if (userDocUnsub) userDocUnsub();
      if (mapUnsub) mapUnsub();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userDetails }}>
      {children}
    </AuthContext.Provider>
  );
};
