import React, { useEffect, useState, useContext } from "react";
import { useLanguage } from "../context/LanguageContext";
import './ProductDetailsPage.css';
import { useParams, useNavigate } from "react-router-dom";
import { Box, Typography, Card, CardMedia, CardContent, Button, IconButton, Divider, Rating, TextField, Dialog, DialogContent, Badge, AppBar, Toolbar } from "@mui/material";
import WishlistWidget from '../components/WishlistWidget';
import ShareButton from '../components/ShareButton';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import { getDiscount } from "../utils/productUtils";
import { db } from "../firebase";
import { AuthContext } from "../context/AuthContext";
import { doc, getDoc, setDoc, collection, addDoc, getDocs, orderBy, query } from "firebase/firestore";
import { updateDoc, where, deleteDoc } from "firebase/firestore";
import { getOptionKey, getPrimaryOption, fetchWishlistsWithProductOptions } from '../utils/wishlistUtils';
import ProductCard from "../components/ProductCard"; // Explicit extension for compatibility
import SEO from "../components/SEO";
import { animateAddToCart } from "../animations/AddToCartAnimation";
import AuthRequiredPrompt from "../components/AuthRequiredPrompt";

const ProductDetailsPage = () => {
  const { language, t, getProductName } = useLanguage();
  const getDisplayName = () => {
    if (!product) return '';
    return getProductName(product);
  };
  // wishlist state moved into WishlistWidget
  const { category, id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState();
  const [quantity, setQuantity] = useState(0);
  const [cartQuantity, setCartQuantity] = useState(0);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [userRating, setUserRating] = useState(0);
  const [userReview, setUserReview] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [otherProducts, setOtherProducts] = useState([]);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(0);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const mainImgRef = React.useRef(null);
  // Zoom/Pan states for full-screen image viewer
  const [zoomScale, setZoomScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = React.useRef({ x: 0, y: 0 });
  const lastOffsetRef = React.useRef({ x: 0, y: 0 });
  const lastTapRef = React.useRef(0);
  const pinchStartRef = React.useRef({ distance: 0, scale: 1, mid: { x: 0, y: 0 } });
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const { user, userDetails } = useContext(AuthContext) || {};
  // Dynamic offsets for fullscreen dialog safe areas (top App Bar, bottom navbar)
  const [appBarOffset, setAppBarOffset] = useState(56);
  const [bottomSafeOffset, setBottomSafeOffset] = useState(56);
  // wishlist logic extracted to WishlistWidget
  // Add to Cart handled via quantity changes
  

  const updateCartQuantity = async (newQuantity) => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }
    
    if (updatingQuantity) return;
    setUpdatingQuantity(true);
    
    try {
      const selectedOption = options[selectedOptionIdx] || options[0];
      const prevQty = cartQuantity || 0;
      
      // Helper function to extract MRP from product or option
      const extractMrp = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj.mrp != null) return obj.mrp;
        if (obj.mrp12 != null) return obj.mrp12;
        const dynKey = Object.keys(obj).find(k => /^mrp\d+$/i.test(k));
        return dynKey ? obj[dynKey] : null;
      };
      
      const mrpValue = extractMrp(selectedOption) ?? extractMrp(product);
      // resolve custom doc id
      const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
      const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
      const cartRef = collection(db, "users", userDocId, "cart");
      
      // Validate required fields
      if (!selectedOption.unit || !selectedOption.unitSize) {
        alert("Product option missing unit/unitSize. Cannot add to cart.");
        setUpdatingQuantity(false);
        return;
      }
      
      // Check if this exact product + option already exists in cart
      const q = query(
        cartRef,
        where('productId', '==', product.id),
        where('unit', '==', selectedOption.unit),
        where('unitSize', '==', selectedOption.unitSize)
      );
      
      const cartSnap = await getDocs(q);
      
      if (!cartSnap.empty) {
        const cartDoc = cartSnap.docs[0];
        if (newQuantity > 0) {
          // Update existing cart item with new quantity
          await updateDoc(cartDoc.ref, { 
            quantity: newQuantity, 
            addedAt: new Date().toISOString(),
            mrp: mrpValue,
            sellingPrice: selectedOption.sellingPrice ?? product.sellingPrice ?? null,
            price: selectedOption.sellingPrice ?? product.sellingPrice ?? null
          });
          console.log('Updated existing cart item with new quantity');
        } else {
          // Remove from cart if quantity is 0
          await deleteDoc(cartDoc.ref);
          console.log('Removed item from cart');
        }
      } else if (newQuantity > 0) {
        // Add as new cart item
        const { id: _, ...productWithoutId } = product;
        const cartItem = {
          productId: product.id,
          ...productWithoutId,
          ...selectedOption,
          quantity: newQuantity,
          addedAt: new Date().toISOString(),
          mrp: mrpValue,
          sellingPrice: selectedOption.sellingPrice ?? product.sellingPrice ?? null,
          price: selectedOption.sellingPrice ?? product.sellingPrice ?? null,
          cartItemId: `${product.id}_${selectedOption.unit}_${selectedOption.unitSize}`
        };
        
        await addDoc(cartRef, cartItem);
        console.log('Added new cart item with unique option');
      }
      
      // Update local state immediately
      setCartQuantity(newQuantity);
      setInCart(newQuantity > 0);
      setQuantity(newQuantity);
      
      if (newQuantity > 0) {
        setCartAdded(true);
        setTimeout(() => setCartAdded(false), 1500);
        // Trigger fly-to-cart if this is the first add
        if (prevQty === 0) {
          const startEl = mainImgRef.current;
          const imgSrc = product?.imageUrls?.[selectedImageIdx] || product?.imageUrls?.[0] || '';
          animateAddToCart(startEl, imgSrc);
        }
      }
    } catch (err) {
      console.error('Error updating cart:', err);
      alert("Failed to update cart. Please try again.");
    } finally {
      setUpdatingQuantity(false);
    }
  };


  // wishlist logic replaced by WishlistWidget

  useEffect(() => {
    // Fetch product by id from Firestore (modular v9 syntax)
    const fetchProduct = async () => {
      try {
        console.log('[PDP] Fetch product start', { category, id });
        if (!category || !id) {
          setProduct(null);
          return;
        }
        const ref = doc(db, "products", category, "items", id);
        const snap = await getDoc(ref);
        console.log('[PDP] Product doc path:', ref.path, 'exists:', snap.exists());
        if (snap.exists()) setProduct({ id: snap.id, ...snap.data() });
        else setProduct(null);
      } catch (err) {
        console.error('[PDP] Error fetching product', err);
        setProduct(null);
      }
    };
    fetchProduct();
  }, [category, id]);

  // Measure default App Bar height/bottom and bottom navbar when opening fullscreen and on layout changes
  useEffect(() => {
    if (!isImageDialogOpen) return;
    const computeOffset = () => {
      const bars = Array.from(document.querySelectorAll('.MuiAppBar-root'));
      if (bars.length === 0) {
        setAppBarOffset(56);
      } else {
        const bottoms = bars
          .map(el => el.getBoundingClientRect())
          .filter(rect => rect.height > 0 && rect.top <= 2) // visible at top edge
          .map(rect => rect.bottom);
        const fallback = bars[0].getBoundingClientRect().bottom || 56;
        const maxBottom = bottoms.length > 0 ? Math.max(...bottoms) : fallback;
        // Floor to avoid 1-2px visual gap due to fractional device pixels
        const computedTop = Math.max(0, Math.floor(maxBottom));
        setAppBarOffset(Math.min(window.innerHeight, computedTop));
      }

      // Compute bottom safe area (bottom nav / OS bars)
      const bottomCandidates = [
        ...Array.from(document.querySelectorAll('.MuiBottomNavigation-root')),
        ...Array.from(document.querySelectorAll('[data-bottom-nav]')),
        ...Array.from(document.querySelectorAll('*'))
          .filter(el => {
            const style = window.getComputedStyle(el);
            if (style.position !== 'fixed') return false;
            const rect = el.getBoundingClientRect();
            return rect.height > 30 && Math.abs(window.innerHeight - rect.bottom) <= 2;
          })
      ];
      let bottomOffset = 0;
      if (bottomCandidates.length > 0) {
        bottomOffset = Math.max(...bottomCandidates.map(el => {
          const r = el.getBoundingClientRect();
          return Math.floor(Math.max(0, r.height));
        }));
      }
      // Fallback typical mobile bottom nav height
      setBottomSafeOffset(Math.max(0, bottomOffset || 56));
    };
    computeOffset();
    window.addEventListener('resize', computeOffset);
    window.addEventListener('scroll', computeOffset, { passive: true });
    window.addEventListener('orientationchange', computeOffset);
    const id = setInterval(computeOffset, 300); // guard for async layout like install banners
    return () => {
      window.removeEventListener('resize', computeOffset);
      window.removeEventListener('scroll', computeOffset);
      window.removeEventListener('orientationchange', computeOffset);
      clearInterval(id);
    };
  }, [isImageDialogOpen]);

  // Fetch reviews
  useEffect(() => {
    const fetchReviews = async () => {
      if (!category || !id) return;
      try {
        const reviewsRef = collection(db, "products", category, "items", id, "reviews");
        const q = orderBy ? query(reviewsRef, orderBy("createdAt", "desc")) : reviewsRef;
        const snap = await getDocs(q);
        console.log('[PDP] Reviews fetched:', snap.size);
        setReviews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('[PDP] Error fetching reviews', err);
        setReviews([]);
      }
    };
    fetchReviews();
  }, [category, id]);

  // Fetch other products in the same category
  useEffect(() => {
    const fetchOtherProducts = async () => {
      if (!category || !id) return;
      try {
        const productsRef = collection(db, "products", category, "items");
        const q = query(productsRef, orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(p => p.id !== id);
        console.log('[PDP] Other products fetched:', snap.size, 'after filter:', list.length);
        setOtherProducts(list);
      } catch (err) {
        console.error('[PDP] Error fetching other products', err);
        setOtherProducts([]);
      }
    };
    fetchOtherProducts();
  }, [category, id]);
  // derived values needed for render
  const options = Array.isArray(product?.options) && product.options.length > 0 ? product.options : [{
    mrp: product?.mrp,
    sellingPrice: product?.sellingPrice,
    specialPrice: product?.specialPrice,
    unit: product?.unit || 'piece',
    unitSize: product?.unitSize || '1',
    quantity: product?.quantity || 1
  }];
  
  const selectedOption = options[selectedOptionIdx] || options[0];
  const discount = getDiscount(selectedOption.mrp, selectedOption.sellingPrice);
  const savings = Math.max(0, (selectedOption?.mrp ?? 0) - (selectedOption?.sellingPrice ?? 0));
  const avgRating = reviews.length ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1) : 0;
  const [cartLoading, setCartLoading] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [updatingQuantity, setUpdatingQuantity] = useState(false);

  // Check if selected option of this product is already in the user's cart and get quantity
  useEffect(() => {
    const checkInCart = async () => {
      try {
        if (!user || !product) { 
          setInCart(false); 
          setCartQuantity(0);
          return; 
        }
        const selected = options[selectedOptionIdx] || options[0];
        if (!selected?.unit || !selected?.unitSize) { 
          setInCart(false); 
          setCartQuantity(0);
          return; 
        }
        const mapSnap2 = await getDoc(doc(db, 'usersByUid', user.uid));
        const userDocId2 = mapSnap2.exists() ? (mapSnap2.data()?.userDocId || user.uid) : user.uid;
        const cartRef = collection(db, "users", userDocId2, "cart");
        const qy = query(
          cartRef,
          where('productId', '==', product.id),
          where('unit', '==', selected.unit),
          where('unitSize', '==', selected.unitSize)
        );
        const snap = await getDocs(qy);
        const present = !snap.empty;
        const currentCartQuantity = present ? snap.docs[0].data().quantity || 0 : 0;
        
        console.log('[PDP] Cart check', { productId: product.id, unit: selected.unit, unitSize: selected.unitSize, present, quantity: currentCartQuantity });
        setInCart(present);
        setCartQuantity(currentCartQuantity);
        
        // Sync the quantity selector with cart quantity
        if (currentCartQuantity > 0) {
          setQuantity(currentCartQuantity);
        } else {
          setQuantity(0);
        }
      } catch (e) {
        console.error('[PDP] Cart check error', e);
        setInCart(false);
        setCartQuantity(0);
      }
    };
    checkInCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, product, selectedOptionIdx, updatingQuantity]);

  // Helper function to constrain offset within bounds
  const constrainOffset = (offset, scale) => {
    if (scale <= 1) return { x: 0, y: 0 };
    
    // Get container dimensions
    const container = document.querySelector('[role="img"]')?.parentElement;
    if (!container) return offset;
    
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    // Estimate scaled image dimensions (assuming image fits in container when not zoomed)
    const scaledWidth = containerWidth * scale;
    const scaledHeight = containerHeight * scale;
    
    // Calculate maximum allowed offsets
    const maxOffsetX = (scaledWidth - containerWidth) / 2;
    const maxOffsetY = (scaledHeight - containerHeight) / 2;
    
    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, offset.x)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, offset.y))
    };
  };

  // Guard: product undefined => still loading; product === null => not found
  if (!product) {
    return <div>Loading...</div>;
  }

  // SEO data
  const seoData = {
    title: product.name || 'Product Details',
    description: product.description || '',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      image: product?.imageUrls?.[0] || '',
      description: product.description || '',
      sku: product.id,
      brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
      offers: {
        "@type": "Offer",
        priceCurrency: "INR",
        price: selectedOption?.sellingPrice ?? product?.sellingPrice ?? '0',
        availability: product?.outOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        url: typeof window !== 'undefined' ? window.location.href : '',
      },
    },
  };

  // Add aggregate rating if we have reviews
  if (reviews.length > 0) {
    seoData.structuredData.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: avgRating,
      reviewCount: reviews.length
    };
  }

  return (
    <Box className="product-details-root" sx={{ 
      px: { xs: 1.5, sm: 4 }, // 12px on mobile, 32px on desktop
      py: 0,
      maxWidth: '100%',
      boxSizing: 'border-box'
    }}>
      <SEO 
        title={seoData.title}
        description={seoData.description}
        structuredData={seoData.structuredData}
      />
      
      {/* Auth Required Dialog */}
      <AuthRequiredPrompt 
        open={showAuthDialog} 
        onClose={() => setShowAuthDialog(false)} 
      />
      
      <Card sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: { md: 3 }, boxShadow: 0, position: 'relative', borderRadius: 0, alignItems: { md: 'stretch' } }}>
        {/* Image gallery */}
        <Box ref={mainImgRef} sx={{ position: 'relative', width: { xs: '100%', md: '50%' }, height: { xs: 320, sm: 420, md: 520 }, display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: { xs: '#fafafa', sm: '#fafafa' }, pb: 0, overflow: 'hidden', flexShrink: 0 }}>
          {/* Back button */}
          <IconButton 
            onClick={() => navigate(-1)}
            sx={{ 
              position: 'absolute', 
              top: 16, 
              left: 16, 
              zIndex: 2, 
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.8)'
              }
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
            <CardMedia
              component="div"
              role="img"
              aria-label={product?.name || 'Product image'}
              sx={{
                width: '100%',
                height: '100%',
                backgroundColor: '#ffffff',
                backgroundImage: `url(${product?.imageUrls?.[selectedImageIdx] || product?.imageUrls?.[0] || 'https://via.placeholder.com/300'})`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: '50% 55%',
                backgroundSize: 'cover',
              cursor: 'pointer'
              }}
              onClick={() => setIsImageDialogOpen(true)}
            />
            {/* Full-screen image dialog with swipe */}
            <Dialog
              open={isImageDialogOpen}
              onClose={() => {
                setIsImageDialogOpen(false);
                // Reset zoom/pan when closing
                setZoomScale(1);
                setOffset({ x: 0, y: 0 });
              }}
              // Keep default app bar visible by offsetting dialog content below it
              fullScreen
              hideBackdrop
              sx={{ zIndex: 1099 }}
              PaperProps={{
                sx: { 
                  backgroundColor: '#fff',
                  position: 'fixed',
                  top: `${Math.max(0, appBarOffset - 2)}px`,
                  height: `calc(100vh - ${Math.max(0, appBarOffset - 2)}px)`,
                  width: '100vw',
                  display: 'flex',
                  flexDirection: 'column'
                }
              }}
            >
              {/* Fullscreen overlay header (no layout gap) */}
              <DialogContent 
                sx={{ 
                  p: 0,
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  flex: '1 1 auto',
                  minHeight: 0,
                  backgroundColor: '#fff',
                  overflow: 'hidden',
                  pb: 0,
                  userSelect: 'none'
                }}
              >
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3, display: 'flex', alignItems: 'center', gap: 0.75, p: 0, m: 0, background: 'transparent' }}>
                  <IconButton
                    size="small"
                    edge="start"
                    onClick={() => {
                      setIsImageDialogOpen(false);
                      setZoomScale(1);
                      setOffset({ x: 0, y: 0 });
                    }}
                    aria-label="Back"
                    sx={{ m: 0.25, ml: 0.5 }}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#000', m: 0, lineHeight: 1, py: 0 }} noWrap>
                    {product?.name || 'Image'}
                  </Typography>
                </Box>
                
                <Box 
                  sx={{ 
                    position: 'absolute',
                    inset: 0,
                    width: '100%', 
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#fff',
                    touchAction: 'none',
                    cursor: isPanning ? 'grabbing' : (zoomScale > 1 ? 'grab' : 'default'),
                    zIndex: 1
                  }}
                  onWheel={(e) => {
                    e.preventDefault();
                    const delta = -e.deltaY; // wheel up to zoom in
                    const factor = delta > 0 ? 1.1 : 0.9;
                    setZoomScale(prev => {
                      const next = Math.min(6, Math.max(1, prev * factor));
                      return next;
                    });
                  }}
                  onDoubleClick={(e) => {
                    // Toggle zoom on double click
                    setZoomScale(prev => prev === 1 ? 2 : 1);
                    if (zoomScale === 1) setOffset({ x: 0, y: 0 });
                  }}
                  onMouseDown={(e) => {
                    if (zoomScale <= 1) return;
                    setIsPanning(true);
                    panStartRef.current = { x: e.clientX, y: e.clientY };
                    lastOffsetRef.current = { ...offset };
                  }}
                  onMouseMove={(e) => {
                    if (!isPanning) return;
                    const dx = e.clientX - panStartRef.current.x;
                    const dy = e.clientY - panStartRef.current.y;
                    setOffset({ x: lastOffsetRef.current.x + dx, y: lastOffsetRef.current.y + dy });
                  }}
                  onMouseUp={() => {
                    setIsPanning(false);
                    // Apply boundary constraints
                    setOffset(prev => constrainOffset(prev, zoomScale));
                  }}
                  onMouseLeave={() => {
                    setIsPanning(false);
                    // Apply boundary constraints when leaving the box
                    setOffset(prev => constrainOffset(prev, zoomScale));
                  }}
                  onTouchStart={(e) => {
                    if (e.touches.length === 2) {
                      const [t1, t2] = e.touches;
                      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                      pinchStartRef.current = { distance: dist, scale: zoomScale, mid: { x: (t1.clientX + t2.clientX)/2, y: (t1.clientY + t2.clientY)/2 } };
                    } else if (e.touches.length === 1) {
                      if (zoomScale > 1) {
                        setIsPanning(true);
                        panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                        lastOffsetRef.current = { ...offset };
                      } else {
                        // Handle swipe between images when not zoomed
                        const startX = e.touches[0].clientX;
                        const handleTouchMove = (ev) => {
                          const diffX = ev.touches[0].clientX - startX;
                          if (Math.abs(diffX) > 60) {
                            if (diffX > 0 && selectedImageIdx > 0) setSelectedImageIdx(prev => prev - 1);
                            else if (diffX < 0 && selectedImageIdx < (product?.imageUrls?.length - 1)) setSelectedImageIdx(prev => prev + 1);
                            document.removeEventListener('touchmove', handleTouchMove);
                          }
                        };
                        document.addEventListener('touchmove', handleTouchMove, { passive: true });
                        document.addEventListener('touchend', () => {
                          document.removeEventListener('touchmove', handleTouchMove);
                        }, { once: true });
                      }
                    }
                  }}
                  onTouchMove={(e) => {
                    if (e.touches.length === 2) {
                      const [t1, t2] = e.touches;
                      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                      const start = pinchStartRef.current.distance || dist;
                      const factor = dist / start;
                      const next = Math.min(6, Math.max(1, (pinchStartRef.current.scale || zoomScale) * factor));
                      setZoomScale(next);
                    } else if (e.touches.length === 1 && isPanning) {
                      const dx = e.touches[0].clientX - panStartRef.current.x;
                      const dy = e.touches[0].clientY - panStartRef.current.y;
                      setOffset({ x: lastOffsetRef.current.x + dx, y: lastOffsetRef.current.y + dy });
                    }
                  }}
                  onTouchEnd={(e) => {
                    if (e.touches.length === 0) {
                      setIsPanning(false);
                      // Apply boundary constraints
                      setOffset(prev => constrainOffset(prev, zoomScale));
                      // Double-tap to zoom
                      const now = Date.now();
                      if (now - lastTapRef.current < 300) {
                        setZoomScale(prev => prev === 1 ? 2 : 1);
                        if (zoomScale === 1) setOffset({ x: 0, y: 0 });
                      }
                      lastTapRef.current = now;
                    }
                  }}
                >
                  <img
                    src={product?.imageUrls?.[selectedImageIdx] || product?.imageUrls?.[0]}
                    alt={product?.name}
                    style={{ 
                      maxWidth: '100%',
                      maxHeight: '100%',
                      transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoomScale})`,
                      transition: isPanning ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                      objectFit: 'contain',
                      willChange: 'transform',
                      userSelect: 'none'
                    }}
                    draggable={false}
                  />
                </Box>

                {/* Image counter */}
                <Typography
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    right: 16,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '0.875rem'
                  }}
                >
                  {selectedImageIdx + 1} / {product?.imageUrls?.length}
                </Typography>

                {/* Thumbnails at bottom inside fullscreen */}
                {Array.isArray(product?.imageUrls) && product.imageUrls.length > 1 && (
                  <Box className="horizontal-scroll" sx={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 62px)', width: '100%', display: 'flex', gap: 0.75, justifyContent: 'center', overflowX: 'auto', py: 0.5, zIndex: 2005, background: 'rgba(255,255,255,0.98)', borderTop: '1px solid #e5e5e5', boxShadow: '0 -4px 10px rgba(0,0,0,0.08)', backdropFilter: 'saturate(180%) blur(8px)' }}>
                    {product.imageUrls.map((img, idx) => (
                      <CardMedia
                        key={idx}
                        component="img"
                        image={img}
                        alt={`thumb-full-${idx}`}
                        onClick={() => setSelectedImageIdx(idx)}
                        sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1, border: selectedImageIdx === idx ? '2px solid #388e3c' : '1px solid #e0e0e0', cursor: 'pointer', boxShadow: selectedImageIdx === idx ? 2 : 0 }}
                      />
                    ))}
                  </Box>
                )}
              </DialogContent>
            </Dialog>
            {/* Thumbnails inside image at bottom (hidden when fullscreen dialog is open) */}
            {!isImageDialogOpen && Array.isArray(product?.imageUrls) && product.imageUrls.length > 1 && (
              <Box className="horizontal-scroll" sx={{ position: 'absolute', left: 0, bottom: 0, width: '100%', display: 'flex', gap: 1, justifyContent: 'center', overflowX: 'auto', pb: 0.5, zIndex: 1, background: 'rgba(255,255,255,0.7)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
                {product.imageUrls.map((img, idx) => (
                  <CardMedia
                    key={idx}
                    component="img"
                    image={img}
                    alt={`thumb-${idx}`}
                    onClick={() => setSelectedImageIdx(idx)}
                    sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1, border: selectedImageIdx === idx ? '2px solid #388e3c' : '1px solid #eee', cursor: 'pointer', boxShadow: selectedImageIdx === idx ? 2 : 0 }}
                  />
                ))}
              </Box>
            )}
          </Box>
          {/* Wishlist + Share overlaid at top-right of image area */}
          <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* ShareButton inline next to wishlist (override default absolute) */}
            <ShareButton product={product} sx={{ position: 'static', top: 'auto', left: 'auto' }} />
            <WishlistWidget inline product={product} selectedOption={selectedOption} onAdd={() => { /* noop */ }} />
          </Box>
        </Box>

        <CardContent sx={{ flex: 1, flexBasis: { md: '50%' }, px: { xs: 0, sm: 2 }, pt: { xs: 2, sm: 3 }, pb: { xs: 1, sm: 2 } }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 800,
              color: '#212121',
              fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2rem' },
              lineHeight: 1.2,
              letterSpacing: '0.2px',
              mb: 0.5,
              wordBreak: 'break-word'
            }}
          >
            {getDisplayName()}
          </Typography>
          {/* Show unit and unitSize below name */}
          {selectedOption?.unit && selectedOption?.unitSize && (
            <Typography variant="subtitle2" sx={{ color: '#666', fontWeight: 500, fontSize: '1.1rem', mb: 1 }}>
              {selectedOption.unitSize} {selectedOption.unit}
            </Typography>
          )}
          <Divider sx={{ mt: { xs: 1, sm: 2 }, mb: 2 }} />
          {/* Modern pricing and cart UI */}
       
          {/* Unit selector - horizontally scrollable and spaced */}
{options.length > 1 && (
  <Box className="horizontal-scroll" sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1, mb: 1, width: '100%' }}>
    {options.map((opt, idx) => {
      const optMrp = opt?.mrp ?? product?.mrp ?? 0;
      const optSell = (opt?.sellingPrice ?? product?.sellingPrice ?? optMrp) || 0;
      const hasDiscount = Number(optMrp) > Number(optSell);
      return (
        <Button
          key={idx}
          variant={selectedOptionIdx === idx ? 'contained' : 'outlined'}
          color={selectedOptionIdx === idx ? 'primary' : 'inherit'}
          size="small"
          sx={{
            fontWeight: 700,
            borderRadius: 3,
            minWidth: 110,
            px: 1.5,
            py: 0.6,
            textAlign: 'left',
            boxShadow: selectedOptionIdx === idx ? 3 : 0,
            border: selectedOptionIdx === idx ? '2px solid #388e3c' : '1px solid #eee',
            background: selectedOptionIdx === idx ? 'linear-gradient(90deg,#e0ffe6 0%,#fff 100%)' : '#fff',
            color: selectedOptionIdx === idx ? '#388e3c' : '#222',
            transition: '0.2s',
            '&:hover': { boxShadow: 4, borderColor: '#43a047', background: '#f5fff5' }
          }}
          onClick={() => setSelectedOptionIdx(idx)}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
            <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.9rem' }}>
              {opt.unitSize} {String(opt.unit || '').toUpperCase()}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 900, fontSize: '0.95rem' }}>
                ₹{Number(optSell).toLocaleString('en-IN')}
              </Typography>
              {hasDiscount && (
                <Typography variant="body2" sx={{ color: '#888', textDecoration: 'line-through', fontWeight: 600, fontSize: '0.8rem' }}>
                  ₹{Number(optMrp).toLocaleString('en-IN')}
                </Typography>
              )}
            </Box>
          </Box>
        </Button>
      );
    })}
  </Box>
)}

{/* Price display based on selected unit */}
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5, mb: 2, mt: 1 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <Typography variant="h4" sx={{ fontWeight: 900, color: '#388e3c', fontSize: { xs: '2rem', sm: '2.5rem' } }}>
        ₹{selectedOption.sellingPrice}
      </Typography>
      {savings > 0 && (
        <Box sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 1.25,
          py: 0.5,
          borderRadius: 999,
          background: 'linear-gradient(90deg, #e8f5e9 0%, #c8e6c9 100%)',
          boxShadow: '0 2px 6px rgba(56,142,60,0.16)',
          border: '1px solid rgba(56,142,60,0.22)'
        }}>
          <Typography variant="body2" sx={{ fontWeight: 800, color: '#2e7d32' }}>
            You save: ₹{savings.toLocaleString('en-IN')}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#2e7d32', opacity: 0.9 }}>
            ({discount}% off)
          </Typography>
        </Box>
      )}
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {discount > 0 && (
        <Typography variant="body2" sx={{ color: '#888', textDecoration: 'line-through', fontWeight: 500, fontSize: { xs: '1.1rem', sm: '1.2rem' } }}>
          MRP ₹{selectedOption.mrp}
        </Typography>
      )}
      {discount > 0 && (
        <Typography variant="body2" sx={{ color: '#888', fontWeight: 500, fontSize: { xs: '1.05rem', sm: '1.1rem' } }}>
          (Incl Of All Taxes)
        </Typography>
      )}
    </Box>
  </Box>
{/* ...existing code... */}
<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
  <Typography variant="body2" sx={{ fontWeight: 700, color: '#555', mr: 1 }}>Qty</Typography>
  <IconButton size="small" sx={{
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: '50%',
    bgcolor: 'success.main',
    color: '#fff',
    '&:hover': { bgcolor: 'success.dark' }
  }} onClick={e => { 
    e.stopPropagation(); 
    const newQty = Math.max(0, quantity - 1);
    updateCartQuantity(newQty);
  }}>
    <RemoveIcon fontSize="small" />
  </IconButton>
  <Typography variant="h6" sx={{ mx: 1.5, minWidth: 28, textAlign: 'center', fontWeight: 700, color: '#222', letterSpacing: 1 }}>{quantity}</Typography>
  <IconButton size="small" sx={{
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: '50%',
    bgcolor: 'success.main',
    color: '#fff',
    '&:hover': { bgcolor: 'success.dark' }
  }} onClick={e => { 
    e.stopPropagation(); 
    const newQty = quantity + 1;
    updateCartQuantity(newQty);
  }}>
    <AddIcon fontSize="small" />
  </IconButton>
</Box>

{inCart && (
  <Box sx={{ mt: 1 }}>
    <Button
      variant="contained"
      color="primary"
      sx={{ width: '100%', py: 1.1, fontSize: '1.05rem', fontWeight: 700, borderRadius: 2 }}
      onClick={() => navigate('/cart')}
    >
      Go to Cart
    </Button>
  </Box>
)}

          {/* Description with Read More */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              {showFullDesc ? product.description : (product.description?.length > 120 ? product.description.slice(0, 120) + "..." : product.description)}
            </Typography>
            {product.description?.length > 120 && (
              <Button size="small" color="primary" sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.95rem', pl: 0 }} onClick={() => setShowFullDesc(v => !v)}>
                {showFullDesc ? "Show less" : "Read more"}
              </Button>
            )}
          </Box>
          {/* Ratings & Reviews Section */}
          <Divider sx={{ my: 2 }} />
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Ratings & Reviews</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Rating value={Number(avgRating) || 0} precision={0.1} readOnly size="medium" />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{avgRating || "No ratings yet"}</Typography>
              <Typography variant="body2" sx={{ color: '#888', ml: 1 }}>({reviews.length} reviews)</Typography>
            </Box>
            {/* Review submission removed as per requirement */}
            {/* List of Reviews */}
            <Box sx={{ mt: 1 }}>
              {reviews.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#888' }}>No reviews yet.</Typography>
              ) : (
                reviews.map(r => (
                  <Box key={r.id} sx={{ mb: 2, p: 1.5, bgcolor: '#f9f9f9', borderRadius: 2, boxShadow: 1 }}>
                    {/* Review text first */}
                    <Typography variant="body2" sx={{ mb: 1 }}>{r.review}</Typography>
                    {/* Stars and date in a row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Rating value={r.rating} readOnly size="small" />
                      <Typography variant="caption" sx={{ color: '#888', textAlign: 'right' }}>
                        {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : ''}
                      </Typography>
                    </Box>
                    {/* Name below stars/date */}
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{r.reviewer || 'Anonymous'}</Typography>
                  </Box>
                ))
              )}
            </Box>
          </Box>
          {/* You might check section */}
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>You might check</Typography>
          <Box className="horizontal-scroll" sx={{ display: 'flex', overflowX: 'auto', gap: 2, pb: 1 }}>
            {otherProducts?.length > 0 ? (
              otherProducts.map(prod => (
                <Box key={prod.id} sx={{ maxWidth: 220, flex: '0 0 auto' }}>
                  {/* Use your existing ProductCard component for consistency */}
                  <ProductCard product={prod} category={category} />
                </Box>
              ))
            ) : (
              <Typography variant="body2" sx={{ color: '#888', minWidth: 220 }}>No other products found.</Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ProductDetailsPage;
