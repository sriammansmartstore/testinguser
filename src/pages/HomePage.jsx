import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import FavoriteIcon from "@mui/icons-material/Favorite";
import Stack from "@mui/material/Stack";
import { collection, onSnapshot, collectionGroup, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";
import { Box, Typography, Snackbar, Alert, LinearProgress, Slide } from "@mui/material";
import BannerSlideshow from "../components/BannerSlideshow";
import SearchBar from "../components/SearchBar";
import SortFilterBar from "../components/SortFilterBar";
import LocationDetectionWidget from "./LocationDetectionWidget";
import { isWithinRadius } from "../utils/geo";
import { DELIVERY_ZONE_CENTER, DELIVERY_ZONE_RADIUS_METERS } from "../config/deliveryZone";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import useScrollDirection from "../hooks/useScrollDirection";
import { db } from "../firebase";
import { AuthContext } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { useLanguage } from "../context/LanguageContext";
import './HomePage.css';

const HomePage = () => {
  // Context and hooks
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { t } = useLanguage();

  // State management
  const [sort, setSort] = useState("newest");
  const [filters, setFilters] = useState({
    price: [0, 10000],
    discount: [0, 100],
    rating: [0, 5],
    unit: [],
    brand: [],
    available: false
  });
  const [detected, setDetected] = useState({ area: "", coords: null });

  // Derive deliverable state: null if unknown/unavailable, true if in radius, false if outside
  const isDeliverable = useMemo(() => {
    if (!detected?.coords || typeof detected.coords.lat !== 'number' || typeof detected.coords.lng !== 'number') {
      return null;
    }
    return isWithinRadius(detected.coords, DELIVERY_ZONE_CENTER, DELIVERY_ZONE_RADIUS_METERS);
  }, [detected?.coords]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  // Pull-to-refresh states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullState = useRef({ startY: 0, pulling: false });
  
  // Scroll behavior states
  const [isSearchFixed, setIsSearchFixed] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef(null);
  
  // Track cart count
  useEffect(() => {
    if (!user) {
      setCartCount(0);
      return;
    }

    let unsub = null;
    (async () => {
      try {
        const mapRef = doc(db, 'usersByUid', user.uid);
        const mapSnap = await getDoc(mapRef);
        const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
        const cartRef = collection(db, "users", userDocId, "cart");
        unsub = onSnapshot(cartRef, (snapshot) => setCartCount(snapshot.size));
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
  
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const { setForceHideAppBar } = useUI();
  
  // Product suggestions for search
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (search.trim()) {
      const searchText = search.trim().toLowerCase();
      // Show top 5 matching products by name, brand, or keywords
      const matches = products
        .filter(product => {
          const searchInName = product.name?.toLowerCase().includes(searchText);
          const searchInNameTamil = product.nameTamil?.toLowerCase().includes(searchText);
          const searchInBrand = product.brand?.toLowerCase().includes(searchText);
          const searchInCategory = product.category?.toLowerCase().includes(searchText);
          
          let searchInKeywords = false;
          if (product.keywords) {
            const keywordsArray = Array.isArray(product.keywords)
              ? product.keywords
              : typeof product.keywords === 'string'
                ? product.keywords.split(',')
                : [];
            searchInKeywords = keywordsArray.some(k => 
              String(k).trim().toLowerCase().includes(searchText)
            );
          }
          
          return searchInName || searchInNameTamil || searchInBrand || searchInCategory || searchInKeywords;
        })
        .sort((a, b) => {
          // Sort by relevance: exact matches first, then partial matches
          const aExact = a.name?.toLowerCase() === searchText;
          const bExact = b.name?.toLowerCase() === searchText;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          return 0;
        })
        .slice(0, 5);
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  }, [search, products, navigate]);

  // Control search bar visibility based on scroll and search state
  useEffect(() => {
    setForceHideAppBar(false);
    return () => {
      setForceHideAppBar(false);
    };
  }, [setForceHideAppBar]);

  // Track if we're in search mode
  const isSearchMode = isSearchFocused || search.trim().length > 0;

  // Refs and hooks
  const searchInputRef = useRef(null);
  const searchBarRef = useRef(null);

  // Scroll behavior effect
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!headerRef.current) return;
      
      const currentScrollY = window.scrollY;
      const headerElement = headerRef.current;
      const headerHeight = headerElement.offsetHeight;
      
      // Calculate when search bar should become fixed
      // We fix it after scrolling past the header height
      const shouldFix = currentScrollY > headerHeight;
      
      if (shouldFix && !isSearchFixed) {
        setIsSearchFixed(true);
        setHeaderHeight(headerHeight);
      } else if (!shouldFix && isSearchFixed) {
        setIsSearchFixed(false);
        setHeaderHeight(0);
      }

      lastScrollY = currentScrollY;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isSearchFixed]);

  // Helper function to safely render values
  const safeRender = (value) => {
    if (typeof value === 'object' && value !== null && 
        !Array.isArray(value) && !(value instanceof Date)) {
      console.error('Attempted to render object as React child:', value);
      return null;
    }
    return value;
  };

  // Voice search handler
  useEffect(() => {
    const handleVoiceSearch = (e) => {
      if (e.detail) setSearch(e.detail);
    };

    // Check for existing voice search query
    const voiceQuery = localStorage.getItem('voice_search_query');
    if (voiceQuery) {
      setSearch(voiceQuery);
      localStorage.removeItem('voice_search_query');
    }

    window.addEventListener('voice-search', handleVoiceSearch);
    return () => window.removeEventListener('voice-search', handleVoiceSearch);
  }, []);

  // Fetch products (extracted to reusable function for pull-to-refresh)
  const fetchProducts = React.useCallback(async () => {
      try {
        console.log('[HomePage] Fetching products...');
        let allProducts = [];
        
        try {
          // Primary method: collectionGroup query
          const itemsQuery = query(collectionGroup(db, 'items'));
          const snapshot = await getDocs(itemsQuery);
          console.log('[HomePage] Collection group snapshot size:', snapshot.size);
          
          allProducts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            category: doc.ref.parent?.parent?.id,
          }));
        } catch (collectionGroupError) {
          // Fallback: iterate through categories
          console.warn('Collection group query failed, using fallback:', collectionGroupError);
          const categoriesSnapshot = await getDocs(collection(db, "categories"));
          const categories = categoriesSnapshot.docs
            .map(doc => doc.data()?.name || doc.id)
            .filter(Boolean);
          
          console.log('[HomePage] Fallback categories:', categories);
          
          for (const category of categories) {
            try {
              const itemsRef = collection(db, "products", category, "items");
              const categoryQuery = query(itemsRef, orderBy("createdAt", "desc"));
              const categorySnapshot = await getDocs(categoryQuery);
              const categoryProducts = categorySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                category
              }));
              allProducts = [...allProducts, ...categoryProducts];
            } catch (categoryError) {
              console.error(`Error fetching products for category ${category}:`, categoryError);
            }
          }
        }

        // Sort by creation date (newest first)
        allProducts.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return dateB - dateA;
        });

        setProducts(allProducts);
        console.log('[HomePage] Total products fetched:', allProducts.length);
        
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
  }, [db]);

  // Initial fetch
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Show notification if navigated with state.notification
  useEffect(() => {
    if (location?.state?.notification) {
      const { message, severity } = location.state.notification || {};
      setSnackbarMsg(message || '');
      setSnackbarSeverity(severity || 'success');
      setSnackbarOpen(true);
      // Clear the history state so it doesn't show again on refresh
      try { navigate(location.pathname, { replace: true }); } catch (e) { /* ignore */ }
    }
  }, [location]);

  // Pull-to-refresh gesture on window when at top
  useEffect(() => {
    const onTouchStart = (e) => {
      if (window.scrollY === 0 && !isRefreshing) {
        pullState.current.startY = e.touches[0].clientY;
        pullState.current.pulling = true;
      }
    };
    const onTouchMove = (e) => {
      if (!pullState.current.pulling) return;
      const delta = e.touches[0].clientY - pullState.current.startY;
      if (delta < 0) {
        // ignore upward move
        pullState.current.pulling = false;
      }
      // We keep UI minimal; browser will show rubber-band on mobile
    };
    const onTouchEnd = async () => {
      if (!pullState.current.pulling) return;
      pullState.current.pulling = false;
      // Trigger refresh if user pulled sufficiently
      setIsRefreshing(true);
      setLoading(true);
      await fetchProducts();
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [fetchProducts, isRefreshing]);

  // Filter and sort products
  const getFilteredProducts = () => {
    let filtered = [...products];

    // Apply search filter
    if (search.trim()) {
      const searchText = search.trim().toLowerCase();
      
      const getSearchScore = (product) => {
        let score = 0;
        if (product.name?.toLowerCase().includes(searchText)) score += 10;
        if (product.nameTamil?.toLowerCase().includes(searchText)) score += 10;
        if (product.category?.toLowerCase().includes(searchText)) score += 5;
        
        if (product.keywords) {
          const keywordsArray = Array.isArray(product.keywords) 
            ? product.keywords 
            : typeof product.keywords === 'string' 
              ? product.keywords.split(',')
              : [];
          if (keywordsArray.some(keyword => 
            String(keyword).trim().toLowerCase().includes(searchText))
          ) score += 7;
        }
        
        if (product.description?.toLowerCase().includes(searchText)) score += 2;
        return score;
      };

      filtered = filtered
        .map(product => ({ ...product, _score: getSearchScore(product) }))
        .filter(product => product._score > 0);
    }

    // Apply price filter
    if (filters.price[0] > 0 || filters.price[1] < 10000) {
      filtered = filtered.filter(product => {
        const price = product.sellingPrice || product.price || 0;
        return price >= filters.price[0] && price <= filters.price[1];
      });
    }

    // Apply discount filter
    if (filters.discount[0] > 0 || filters.discount[1] < 100) {
      filtered = filtered.filter(product => {
        const mrp = product.mrp || 0;
        const sellingPrice = product.sellingPrice || product.price || 0;
        const discount = mrp > 0 ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;
        return discount >= filters.discount[0] && discount <= filters.discount[1];
      });
    }

    // Apply rating filter
    if (filters.rating[0] > 0 || filters.rating[1] < 5) {
      filtered = filtered.filter(product => {
        const rating = product.rating || 0;
        return rating >= filters.rating[0] && rating <= filters.rating[1];
      });
    }

    // Apply unit filter
    if (filters.unit.length > 0) {
      filtered = filtered.filter(product => filters.unit.includes(product.unit));
    }

    // Apply brand filter
    if (filters.brand.length > 0) {
      filtered = filtered.filter(product => filters.brand.includes(product.brand));
    }

    // Apply availability filter
    if (filters.available) {
      filtered = filtered.filter(product => product.available !== false);
    }

    // Apply sorting
    switch (sort) {
      case "priceLowHigh":
        filtered.sort((a, b) => {
          const priceA = a.sellingPrice || (a.options && a.options[0]?.sellingPrice) || a.price || a.mrp || 0;
          const priceB = b.sellingPrice || (b.options && b.options[0]?.sellingPrice) || b.price || b.mrp || 0;
          return priceA - priceB;
        });
        break;
      case "priceHighLow":
        filtered.sort((a, b) => {
          const priceA = a.sellingPrice || (a.options && a.options[0]?.sellingPrice) || a.price || a.mrp || 0;
          const priceB = b.sellingPrice || (b.options && b.options[0]?.sellingPrice) || b.price || b.mrp || 0;
          return priceB - priceA;
        });
        break;
      case "newest":
        filtered.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return dateB - dateA;
        });
        break;
      case "oldest":
        filtered.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return dateA - dateB;
        });
        break;
      case "nameAZ":
        filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      case "nameZA":
        filtered.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
        break;
      case "discount":
        filtered.sort((a, b) => {
          const discountA = a.mrp && a.sellingPrice ? 
            ((a.mrp - a.sellingPrice) / a.mrp) : 0;
          const discountB = b.mrp && b.sellingPrice ? 
            ((b.mrp - b.sellingPrice) / b.mrp) : 0;
          return discountB - discountA;
        });
        break;
      case "rating":
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "popularity": {
        // Sort by popularity-like fields if present
        const pop = (p) => p.popularity ?? p.views ?? p.ordersCount ?? p.sales ?? 0;
        filtered.sort((a, b) => pop(b) - pop(a));
        break;
      }
      case "featured": {
        // Featured products first, then by newest
        filtered.sort((a, b) => {
          const fa = a.featured ? 1 : 0;
          const fb = b.featured ? 1 : 0;
          if (fb !== fa) return fb - fa;
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return dateB - dateA;
        });
        break;
      }
      default:
        break;
    }

    return filtered;
  };

  const filteredProducts = getFilteredProducts();

  // Derive available units and brands for filters
  const derivedUnits = Array.from(new Set(
    products.flatMap(product => 
      (Array.isArray(product.options) 
        ? product.options.map(option => option.unit) 
        : [product.unit]
      ).filter(Boolean)
    )
  ));

  const derivedBrands = Array.from(new Set(
    products.map(product => product.brand).filter(Boolean)
  ));

  return (
    <Box className="home-root" sx={{ position: 'relative', pb: 0 }}>
      <SEO
        title="Online Grocery & Essentials"
        description="Shop groceries and daily essentials online from Sri Amman Smart Store. Discover fresh products, best prices, and fast delivery in Coimbatore."
        type="website"
      />
      
      {/* Header section with scroll behavior */}
      <Box className="header-container">
        {/* Spacer for fixed content */}
        <Box 
          className={`header-spacer ${isSearchFixed ? 'visible' : ''}`} 
          style={{'--header-height': `${headerHeight}px`}}
        />
        
        {/* App bar and OfferScroller - scrolls away */}
        <Box 
          className={`scrollable-header ${isSearchFixed ? 'hidden' : ''}`}
          ref={headerRef}
        >
          {/* This is where App bar and OfferScroller from App.js will be rendered */}
        </Box>

        {/* Search Bar - becomes fixed */}
        <Box 
          className={`search-bar-wrapper ${isSearchFixed ? 'sticky' : ''}`}
          sx={{
            py: 2, // Increased vertical padding
            px: 1.5, // Slightly increased horizontal padding
            borderBottom: '1px solid #e0e0e0',
            minHeight: '64px', // Set minimum height
          
          }}
        >
          {isRefreshing && (
            <Box sx={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
              <LinearProgress />
            </Box>
          )}
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t("searchPlaceholder", "Search products and categories...")}
            onSuggestionSelect={(item, type) => {
              if (type === 'product') {
                navigate(`/product/${item.category}/${item.id}`);
              } else if (type === 'category') {
                navigate(`/category/${encodeURIComponent(item.id)}`);
              }
            }}
          />
        </Box>
      </Box>

      {/* Main Content - offset when search is fixed */}
      <Box sx={{ 
        mt: isSearchFixed ? `${headerHeight}px` : 2,
        transition: 'margin-top 0.2s ease'
      }}>
        <Box>
          <LocationDetectionWidget 
            onLocationDetected={setDetected} 
            deliverableState={isDeliverable}
          />
          {/* Map hidden as requested */}
        </Box>

        <Box>
          <BannerSlideshow />
        </Box>
        
        {loading ? (
          <Typography sx={{ p: 2, textAlign: 'center' }}>
            {t("loadingProducts", "Loading products...")}
          </Typography>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((product) => (
              <ProductCard 
                product={product} 
                key={product.id} 
              />
            ))}
            {filteredProducts.length === 0 && !loading && (
              <Typography sx={{ p: 2, textAlign: 'center', width: '100%' }}>
                {t("noProductsFound", "No products found matching your criteria.")}
              </Typography>
            )}
          </div>
        )}
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        TransitionComponent={(props) => <Slide {...props} direction="up" />}
        sx={{ bottom: { xs: '76px', sm: '24px' } }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
          variant={snackbarSeverity === 'success' ? 'filled' : 'standard'}
          sx={{ boxShadow: 3, borderRadius: 2, width: '100%' }}
        >
          {snackbarMsg || 'Notification'}
        </Alert>
      </Snackbar>

      {/* Fixed SortFilterBar above BottomNavbar */}
      <Box sx={{ 
        position: 'fixed', 
        bottom: 56, 
        left: 0, 
        right: 0, 
        zIndex: 1201, 
        background: 'white',
        borderTop: '1px solid #e0e0e0',
        boxShadow: '0 -2px 5px rgba(0,0,0,0.05)',
        p: 0.5
      }}>
        <SortFilterBar
          compact
          sort={sort}
          setSort={setSort}
          filters={filters}
          setFilters={setFilters}
          units={derivedUnits}
          brands={derivedBrands}
          minPrice={0}
          maxPrice={10000}
          minDiscount={0}
          maxDiscount={100}
          minRating={0}
          maxRating={5}
        />
      </Box>
    </Box>
  );
};

export default HomePage;