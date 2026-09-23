import React, { useContext, useEffect, useState } from "react";
import { BottomNavigation, BottomNavigationAction, Box } from "@mui/material";
import { Button } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import CategoryIcon from "@mui/icons-material/Category";
import SearchIcon from "@mui/icons-material/Search";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import Badge from "@mui/material/Badge";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
// import useScrollDirection from "../hooks/useScrollDirection";

const BottomNavbar = () => {
  const [nav, setNav] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const { user } = useContext(AuthContext) || {};
  const navigate = useNavigate();
  const location = useLocation();
  const p = location.pathname || '';
  // Remove filter bump from home and categories pages since they now have integrated sort/filter
  const showFilterBump = false; // Disabled as sort/filter is now integrated into the page headers
  // Search handler - focus the search bar robustly (iOS friendly)
  const handleSearch = () => {
    const isOnHome = (location.pathname || '') === '/';
    const fireFocus = () => window.dispatchEvent(new CustomEvent('focus-search'));
    if (isOnHome) {
      // If already on home, try immediately and again shortly after
      fireFocus();
      setTimeout(fireFocus, 120);
      setTimeout(fireFocus, 360);
      return;
    }
    // Navigate to home page, then attempt multiple times to ensure focus after mount/transitions
    navigate('/');
    setTimeout(fireFocus, 380);
    setTimeout(fireFocus, 640);
  };

  // Home handler - clears search and navigates to home
  const handleHome = () => {
    navigate('/');
    // Trigger clear search event
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('clear-search'));
    }, 100);
  };

  useEffect(() => {
    if (!user) return setCartCount(0);

    let unsub = null;
    (async () => {
      try {
        const mapRef = doc(db, 'usersByUid', user.uid);
        const mapSnap = await getDoc(mapRef);
        const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
        const cartRef = collection(db, "users", userDocId, "cart");
        unsub = onSnapshot(cartRef, (snapshot) => {
          setCartCount(snapshot.size);
        });
      } catch (e) {
        try {
          const cartRef = collection(db, "users", user.uid, "cart");
          unsub = onSnapshot(cartRef, (snapshot) => setCartCount(snapshot.size));
        } catch (_) {
          setCartCount(0);
        }
      }
    })();

    return () => { if (unsub) unsub(); };
  }, [user]);

  // Always show navbar, never hide on scroll
  const scrollDirection = 'up';
  const hideOnScroll = false;

  return (
    <Box sx={{ 
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1402,
      transform: 'translateY(0)',
      transition: 'none',
      willChange: 'auto'
    }}>
      {/* Center bump/handle to toggle filters (Home & Categories only) */}
      {showFilterBump && (
      <Box
        role="button"
        aria-label="toggle filters"
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); console.log('[BottomNavbar] bump tapped -> toggle-filters'); window.dispatchEvent(new CustomEvent('toggle-filters')); }}
        sx={{
          position: 'absolute',
          top: -36,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 68,
          height: 34,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          bgcolor: '#2e7d32',
          boxShadow: '0 4px 10px rgba(0,0,0,0.18)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
           userSelect: 'none',
          pointerEvents: 'auto',
          zIndex: 1402,
          touchAction: 'manipulation'
        }}
      >
        <KeyboardArrowUpIcon sx={{ fontSize: 24, color: '#fff' }} />
      </Box>
      )}
      <BottomNavigation
        showLabels
        value={nav}
        onChange={(e, newValue) => {
          setNav(newValue);
        }}
        sx={{
          position: "relative",
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          boxShadow: '0 -2px 12px rgba(56,142,60,0.10)',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          fontFamily: 'Montserrat',
          px: 1.5,
          zIndex: 1300
        }}
      >
      <BottomNavigationAction 
        label="Home" 
        icon={<HomeIcon sx={{ color: '#43a047' }} />} 
        onMouseDown={() => window.dispatchEvent(new CustomEvent('clear-search'))}
        onClick={() => navigate("/")}
        sx={{ fontFamily: 'Montserrat', fontWeight: 600 }} 
      />
      <BottomNavigationAction label="Categories" icon={<CategoryIcon sx={{ color: '#ff9800' }} />} onClick={() => navigate("/categories")} sx={{ fontFamily: 'Montserrat', fontWeight: 600 }} />
      <BottomNavigationAction
        label="Search"
        icon={<SearchIcon sx={{ fontSize: 28, color: '#388e3c' }} />}
        onClick={handleSearch}
        sx={{ fontFamily: 'Montserrat', fontWeight: 600, color: '#388e3c' }}
      />
      <BottomNavigationAction label="Wishlist" icon={<FavoriteIcon sx={{ color: '#e91e63' }} />} onClick={() => navigate("/wishlist")} sx={{ fontFamily: 'Montserrat', fontWeight: 600, pr: 2 }} />
      <BottomNavigationAction
        label="Cart"
        icon={
          <Badge
            badgeContent={cartCount}
            color="error"
            showZero
            overlap="circular"
          >
            <ShoppingCartIcon sx={{ color: '#1976d2' }} />
          </Badge>
        }
        onClick={() => navigate("/cart")}
        sx={{ fontFamily: 'Montserrat', fontWeight: 600, pl: 2 }}
      />
      </BottomNavigation>
    </Box>
  );
};

export default BottomNavbar;
