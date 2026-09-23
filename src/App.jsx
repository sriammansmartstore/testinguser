import BottomNavbar from "./components/BottomNavbar";
import React, { useState, useEffect, lazy, Suspense } from "react";
import { auth } from "./firebase";
import { BrowserRouter as Router, Routes, Route, Navigate, Link as RouterLink, useLocation, useNavigationType, useNavigate } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import "@fontsource/montserrat";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { NotificationProvider } from './components/NotificationProvider';
import { UIProvider } from './context/UIContext';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import ScrollToTop from './components/ScrollToTop';
import RouteSEO from './components/RouteSEO';
import OrderDetailsPage from './pages/OrderDetailsPage';
import RequireAuth from './components/RequireAuth';
import GlobalPageSEO from './components/GlobalPageSEO';
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import Typography from "@mui/material/Typography";
import InstallMobileIcon from "@mui/icons-material/InstallMobile";
import Button from "@mui/material/Button";
import NotificationsIcon from "@mui/icons-material/Notifications";
import Badge from "@mui/material/Badge";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import { db } from "./firebase";
import { collection, getDocs, onSnapshot, doc, getDoc, setDoc } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { playNotificationSound } from "./utils/notificationSound";
import WishlistDetailPage from "./pages/WishlistDetailPage";
import WishlistReviewPage from "./pages/WishlistReviewPage";
import OfferScroller from "./components/OfferScroller";
import './animations/AddToCartAnimation.css';


const HomePage = lazy(() => import("./pages/HomePage"));
const ProductDetailsPage = lazy(() => import("./pages/ProductDetailsPage"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
const AddressesPage = lazy(() => import("./pages/AddressesPage"));
const UserSettingsPage = lazy(() => import("./pages/UserSettingsPage"));
const PaymentOptionsPage = lazy(() => import("./pages/PaymentOptionsPage"));
const MyOrdersPage = lazy(() => import("./pages/MyOrdersPage"));
const LocationDetectionPage = lazy(() => import("./pages/LocationDetectionPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const MorePage = lazy(() => import("./pages/MorePage"));
const AboutUsPage = lazy(() => import("./pages/AboutUsPage"));
const ReportProblemPage = lazy(() => import("./pages/ReportProblemPage"));
const UserDataPage = lazy(() => import("./pages/UserDataPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const CoinManagementPage = lazy(() => import("./pages/CoinManagementPage"));
const ReferAndEarnPage = lazy(() => import("./pages/ReferAndEarnPage"));
const ReferralTermsPage = lazy(() => import("./pages/ReferralTermsPage"));
const CoinTermsPage = lazy(() => import("./pages/CoinTermsPage"));
const RequestProductPage = lazy(() => import("./pages/RequestProductPage"));
const NotificationDetailPage = lazy(() => import("./pages/NotificationDetailPage"));
const TermsAndConditionsPage = lazy(() => import("./pages/TermsAndConditionsPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const RefundAndCancellationPolicyPage = lazy(() => import("./pages/RefundAndCancellationPolicyPage"));
const ShippingPolicyPage = lazy(() => import("./pages/ShippingPolicyPage"));
const ReturnPolicyPage = lazy(() => import("./pages/ReturnPolicyPage"));

const theme = createTheme({
  palette: {
    primary: {
      main: "#388e3c",
    },
    secondary: {
      main: "#43a047",
    },
    background: {
      default: "#fff",
    },
  },
  typography: {
    fontFamily: 'Montserrat, Arial, sans-serif',
  },
});


function App() {
  // Request location permission on app startup (robust)
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    const requestGeo = () => {
      try {
        navigator.geolocation.getCurrentPosition(
          () => {
            // success: we only need to trigger the permission prompt early
          },
          (err) => {
            // Log for debugging; some browsers require user interaction if previously denied
            console.warn('Geolocation error on startup:', err && err.message ? err.message : err);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
        );
      } catch (e) {
        console.warn('Geolocation exception on startup:', e);
      }
    };

    // Use Permissions API if available to avoid redundant prompts and ensure immediate request
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          // Trigger request for both 'granted' (to warm cache) and 'prompt' (to show prompt now)
          if (status.state === 'granted' || status.state === 'prompt') {
            requestGeo();
          }
          // If 'denied', do nothing here; user can enable via settings or later explicit action
        })
        .catch(() => {
          // Fallback if Permissions API not available/failed
          requestGeo();
        });
    } else {
      requestGeo();
    }
  }, []);
  // Disable browser scroll restoration so we control it
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      const prev = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';
      return () => { window.history.scrollRestoration = prev; };
    }
  }, []);
  const [nav, setNav] = useState(0);

  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider theme={theme}>
          <HelmetProvider>
          <NotificationProvider>
          <CssBaseline />
          <Router>
            <Helmet>
              <title>Sri Amman Smart Store</title>
              <meta name="description" content="Shop groceries and daily essentials online from Sri Amman Smart Store. Fast delivery, best prices, and secure payment options." />
              <meta name="robots" content="index,follow" />
              <meta property="og:site_name" content="Sri Amman Smart Store" />
              <meta property="og:title" content="Sri Amman Smart Store" />
              <meta property="og:description" content="Shop groceries and daily essentials online from Sri Amman Smart Store." />
              <meta property="og:type" content="website" />
            </Helmet>
            <RouteSEO />
            <GlobalPageSEO />
            <ScrollToTop />

            {/* Routed layout extracted to stable top-level component (prevents remounts) */}
            <UIProvider>
              <RoutedLayout />
            </UIProvider>
          </Router>
          </NotificationProvider>
          </HelmetProvider>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
export default App;

// Stable top-level routed layout to avoid remounts on App re-renders
import { useUI } from './context/UIContext';

function RoutedLayout() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const location = useLocation();
  const navType = useNavigationType();
  const onHome = location.pathname === '/';
  const { user } = React.useContext(AuthContext) || {};
  const navigate = useNavigate();
  const [cartCount, setCartCount] = React.useState(0);
  const [installPromptEvent, setInstallPromptEvent] = React.useState(null);
  const [isInstalled, setIsInstalled] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [lastNotification, setLastNotification] = React.useState(null);
  const [showPopup, setShowPopup] = React.useState(false);
  const [notificationPermission, setNotificationPermission] = React.useState(Notification.permission);

  // Track cart count
  React.useEffect(() => {
    let unsub = null;
    (async () => {
      if (!user) { setCartCount(0); return; }
      try {
        const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
        const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
        const cartRef = collection(db, 'users', userDocId, 'cart');
        unsub = onSnapshot(cartRef, (snapshot) => setCartCount(snapshot.size));
      } catch (_) {
        const cartRef = collection(db, 'users', user.uid, 'cart');
        unsub = onSnapshot(cartRef, (snapshot) => setCartCount(snapshot.size));
      }
    })();
    return () => { if (unsub) unsub(); };
  }, [user]);

  // Track unread notifications
  React.useEffect(() => {
    let unsub = null;
    (async () => {
      if (!user) { setUnreadCount(0); return; }
      try {
        const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
        const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
        const notifRef = collection(db, 'users', userDocId, 'notifications');
        unsub = onSnapshot(notifRef, (snap) => {
          let unread = 0;
          snap.docs.forEach(d => {
            const data = d.data();
            if (!data.read && !data.deleted) unread++;
          });
          setUnreadCount(unread);
          console.log('Unread notifications count:', unread);
        });
      } catch (err) {
        console.warn('Error tracking unread (mapped), trying fallback:', err);
        const notifRef = collection(db, 'users', user.uid, 'notifications');
        unsub = onSnapshot(notifRef, (snap) => {
          let unread = 0;
          snap.docs.forEach(d => {
            const data = d.data();
            if (!data.read && !data.deleted) unread++;
          });
          setUnreadCount(unread);
          console.log('Unread notifications count (fallback):', unread);
        });
      }
    })();
    return () => { if (unsub) unsub(); };
  }, [user]);

  // Request notification permission on mount
  React.useEffect(() => {
    if (Notification.permission !== 'granted') {
      Notification.requestPermission().then(setNotificationPermission);
    }
  }, []);

  // Register service worker and get FCM token
  React.useEffect(() => {
    if (!user) return;
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers not supported');
      return;
    }

    (async () => {
      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service worker registered:', registration);
        
        // Get FCM token
        try {
          const messaging = getMessaging();
          const token = await getToken(messaging, {
            vapidKey: 'BB8LNY0whUDSt0k_j66zSFK9xInaq0P73NSm05cjkRM2kFKuBYt3hS31zyWi7Lz7QSME9YC-Vgv0xiDWOJpdraU',
            serviceWorkerRegistration: registration
          });
          if (token) {
            console.log('FCM Tokens:', token);
            try {
              const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
              const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
              await setDoc(doc(db, 'users', userDocId), { fcmToken: token, lastTokenUpdate: new Date().toISOString() }, { merge: true });
            } catch (saveErr) {
              console.warn('Failed to save FCM token to user profile:', saveErr);
            }
          }
        } catch (err) {
          console.warn('Error getting FCM token:', err);
        }
      } catch (err) {
        console.warn('Service worker registration failed:', err);
      }
    })();

    try {
      const messaging = getMessaging();
      // Listen for foreground messages
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);
        if (payload.notification) {
          setLastNotification(payload.notification);
          setShowPopup(true);
          playNotificationSound();
        }
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('Firebase messaging setup error:', err);
    }
  }, [user]);

  // Play sound and show popup for new notification
  const handleClosePopup = () => setShowPopup(false);
  // PWA install prompt handling
  React.useEffect(() => {
    const handleBIP = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPromptEvent(null);
    };
    const checkInstalled = () => {
      try {
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
          setIsInstalled(true);
          return true;
        }
        if (typeof window.navigator !== 'undefined' && 'standalone' in window.navigator && window.navigator.standalone) {
          setIsInstalled(true);
          return true;
        }
      } catch (_) {}
      return false;
    };
    window.addEventListener('beforeinstallprompt', handleBIP);
    window.addEventListener('appinstalled', handleInstalled);
    checkInstalled();
    let mql;
    try {
      if (window.matchMedia) {
        mql = window.matchMedia('(display-mode: standalone)');
        if (mql && mql.addEventListener) {
          mql.addEventListener('change', (e) => { if (e.matches) setIsInstalled(true); });
        }
      }
    } catch (_) {}
    const onVisibility = () => { if (!document.hidden) checkInstalled(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBIP);
      window.removeEventListener('appinstalled', handleInstalled);
      try { if (mql && mql.removeEventListener) mql.removeEventListener('change', () => {}); } catch (_) {}
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  const promptInstall = async () => {
    if (!installPromptEvent) return;
    try {
      installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === 'accepted') {
        setInstallPromptEvent(null);
      }
    } catch (_) {}
  };

  const { forceHideAppBar } = useUI();

  // Remember scroll positions per route to keep pages stable
  const scrollPositionsRef = React.useRef({});
  // Load any saved positions from sessionStorage on first render
  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem('scrollPositions');
      if (saved) scrollPositionsRef.current = JSON.parse(saved) || {};
    } catch (_) {}
  }, []);
  // Before route changes (cleanup of pathname effect), persist current scrollY
  React.useEffect(() => {
    return () => {
      try {
        scrollPositionsRef.current[location.pathname] = window.scrollY || 0;
        sessionStorage.setItem('scrollPositions', JSON.stringify(scrollPositionsRef.current));
      } catch (_) {}
    };
  }, [location.pathname]);
  // On route change, restore prior scroll when navigating back/forward (POP)
  React.useEffect(() => {
    const pos = scrollPositionsRef.current[location.pathname];
    if (navType === 'POP' && typeof pos === 'number') {
      // Delay to allow layout to settle
      const t = setTimeout(() => window.scrollTo({ top: pos, behavior: 'auto' }), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [location.pathname, navType]);

  return (
    <>
      {/* Hide AppBar when forceHideAppBar is true (searching) */}
      {!forceHideAppBar && (
        <AppBar 
          position="fixed" 
          sx={{ 
            top: 0, 
            background: 'white',
            zIndex: 1100
          }}
        >
        <Toolbar sx={{ minHeight: 72, px: 2 }}>
          <IconButton edge="start" color="inherit" aria-label="menu" size="large" sx={{ mr: 0.5 }} onClick={() => {
            // Prevent opening the More drawer for unauthenticated users.
            if (!user) {
              navigate('/login', { state: { from: window.location.pathname } });
              return;
            }
            setDrawerOpen(true);
          }}>
            <MenuIcon sx={{ color: '#388e3c', fontSize: 30 }} />
          </IconButton>
          <Box component={RouterLink} to="/" sx={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', mr: 1 }}>
            <Box component="img" src="/banner.png" alt="Sri Amman Smart Store" sx={{ height: 44, objectFit: 'contain' }} />
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {installPromptEvent && !isInstalled && (
            <Button
              onClick={promptInstall}
              startIcon={<InstallMobileIcon sx={{ fontSize: 22 }} />}
              size="small"
              variant="outlined"
              sx={{ mr: 1, borderColor: '#388e3c', color: '#388e3c', textTransform: 'none', fontWeight: 700, px: 1, py: 0.3, display: { xs: 'inline-flex', sm: 'inline-flex' } }}
            >
              Install
            </Button>
          )}
          <IconButton id="global-notifications-button" color="inherit" component={RouterLink} to="/notifications" size="large" sx={{ ml: 1 }}>
            <Badge 
              badgeContent={unreadCount}
              color="error"
              overlap="circular"
              sx={{ '& .MuiBadge-badge': { fontSize: 11, height: 18, minWidth: 18 } }}
            >
              <NotificationsIcon sx={{ color: '#1976d2', fontSize: 28 }} />
            </Badge>
          </IconButton>
          {/* Popup for new notification */}
          {showPopup && lastNotification && (
            <Box 
              sx={{ 
                position: 'fixed', 
                top: 90, 
                left: '50%', 
                transform: 'translateX(-50%)',
                zIndex: 2000, 
                animation: 'slideDown 0.3s ease-out',
                '@keyframes slideDown': {
                  from: { transform: 'translateX(-50%) translateY(-100%)', opacity: 0 },
                  to: { transform: 'translateX(-50%) translateY(0)', opacity: 1 }
                }
              }}
            >
              <Box 
                sx={{ 
                  background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                  borderRadius: 2, 
                  boxShadow: '0 8px 32px rgba(25, 118, 210, 0.3)',
                  p: 2.5, 
                  minWidth: 300, 
                  maxWidth: 450, 
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 2,
                  color: '#fff'
                }}
              >
                <NotificationsIcon sx={{ mt: 0.5, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>{lastNotification.title}</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', mt: 0.5 }}>{lastNotification.body}</Typography>
                </Box>
                <Button 
                  onClick={handleClosePopup} 
                  size="small" 
                  sx={{ 
                    background: 'rgba(255, 255, 255, 0.2)', 
                    color: '#fff',
                    '&:hover': { background: 'rgba(255, 255, 255, 0.3)' },
                    textTransform: 'none',
                    fontWeight: 600,
                    flexShrink: 0
                  }}
                >
                  ✕
                </Button>
              </Box>
            </Box>
          )}
          
          {/* Auto-close popup after 5 seconds */}
          {showPopup && lastNotification && (
            <Box
              onAnimationEnd={() => {
                setTimeout(() => setShowPopup(false), 5000);
              }}
            />
          )}
        </Toolbar>
        </AppBar>
      )}
      {onHome && (
        <Box
          sx={{
            position: 'fixed',
            top: 72,
            left: 0,
            right: 0,
            zIndex: 1098,
            background: '#fff',
            m: 0,
            p: 0
          }}
        >
          <OfferScroller />
        </Box>
      )}
          <Drawer 
        anchor="left" 
        open={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        PaperProps={{ sx: { width: 340, maxWidth: '90vw', pt: 0, zIndex: 1402 } }}
        ModalProps={{ keepMounted: true, sx: { zIndex: 1402 } }}
      >
        <Suspense fallback={null}>
          <MorePage onClose={() => setDrawerOpen(false)} />
        </Suspense>
      </Drawer>
      <Box sx={{
        paddingTop: onHome ? '112px' : '88px',
        paddingBottom: '56px',
        minHeight: "100vh",
        background: '#fff',
        width: '100%',
        overflowX: 'hidden'
      }}>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/product/:category/:id" element={<ProductDetailsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/category/:categoryName" element={<CategoriesPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/wishlist" element={<RequireAuth><WishlistPage /></RequireAuth>} />
            <Route path="/wishlist/:wishlistId" element={<RequireAuth><WishlistDetailPage /></RequireAuth>} />
            <Route path="/wishlist/:wishlistId/review" element={<RequireAuth><WishlistReviewPage /></RequireAuth>} />
            <Route path="/addresses" element={<RequireAuth><AddressesPage /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><UserSettingsPage /></RequireAuth>} />
            <Route path="/payment" element={<RequireAuth><PaymentOptionsPage /></RequireAuth>} />
            <Route path="/orders" element={<RequireAuth><MyOrdersPage /></RequireAuth>} />
            <Route path="/order/:orderId" element={<RequireAuth><OrderDetailsPage /></RequireAuth>} />
            <Route path="/location" element={<LocationDetectionPage />} />
            <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
            <Route path="/notification/:id" element={<RequireAuth><NotificationDetailPage /></RequireAuth>} />
            <Route path="/about" element={<AboutUsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/report" element={<ReportProblemPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/userdata" element={<UserDataPage />} />
            <Route path="/coin-management" element={<CoinManagementPage />} />
            <Route path="/coin-terms" element={<CoinTermsPage />} />
            <Route path="/refer-and-earn" element={<ReferAndEarnPage />} />
            <Route path="/refer-terms" element={<ReferralTermsPage />} />
            <Route path="/terms" element={<TermsAndConditionsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/refund-cancellation" element={<RefundAndCancellationPolicyPage />} />
            <Route path="/shipping" element={<ShippingPolicyPage />} />
            <Route path="/return" element={<ReturnPolicyPage />} />
            <Route path="/request-product" element={<RequestProductPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </Box>
  {/* Hide BottomNavbar when forceHideAppBar is true (searching) */}
  {!forceHideAppBar && <BottomNavbar />}
    </>
  );
}
