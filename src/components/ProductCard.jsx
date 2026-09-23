import React, { useState, useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  IconButton,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import WishlistWidget from './WishlistWidget';
import ShareButton from './ShareButton';
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import { db } from "../firebase";
import { getDiscount } from "../utils/productUtils";
import { updateDoc, query, where, collection, getDocs, addDoc, deleteDoc, doc, getDoc } from "firebase/firestore";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import AuthRequiredPrompt from './AuthRequiredPrompt';
import "./../pages/HomePage.css"; // Ensure the CSS is applied
import { animateAddToCart } from "../animations/AddToCartAnimation";

// Helper to get the middle option (or first if only one)
const getMiddleOption = (options) => {
  if (!Array.isArray(options) || options.length === 0) return null;
  const idx = Math.floor(options.length / 2);
  return options[idx];
};

const ProductCard = ({ product, onAddToCart, onAddToWishlist }) => {
  const navigate = useNavigate();
  // Prevent multiple rapid cart updates
  const pendingQuantityRef = React.useRef(null);
  const [updatingQuantity, setUpdatingQuantity] = useState(false);
  // wishlist state moved to WishlistWidget
  const [quantity, setQuantity] = useState(1);
  const [showQuantity, setShowQuantity] = useState(false);
  // Pick the middle option for display if available
  const hasMultipleOptions = Array.isArray(product.options) && product.options.length > 1;
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(0);
  const option = product.options?.[selectedOptionIdx] || product.options?.[0] || {};
  // If admin provided a global offerPrice, prefer it as the effective selling price
  const effectiveSellingPrice = (typeof product.offerPrice === 'number') ? product.offerPrice : (option.sellingPrice ?? option.price ?? product.sellingPrice ?? product.price ?? 0);
  const discount = getDiscount(option.mrp, effectiveSellingPrice);
  const { user } = useContext(AuthContext);
  // cart state awareness
  // Language context for product name display
  const { language, t, getProductName, getUnitText } = useLanguage();
  const getDisplayName = () => {
    return getProductName(product);
  };
  const [inCartAnyVariant, setInCartAnyVariant] = useState(false);
  const [hasCurrentVariantInCart, setHasCurrentVariantInCart] = useState(false);
  const [currentVariantQty, setCurrentVariantQty] = useState(0);
  const [optionQuantities, setOptionQuantities] = useState({});
  const [addQuantity, setAddQuantity] = useState(1);

  // wishlist fetching moved into WishlistWidget
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const imgBoxRef = React.useRef(null);

  const handleAddToCartClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If user is not logged in, show auth dialog
    if (!user) {
      setShowAuthDialog(true);
      return;
    }
    
    if (hasMultipleOptions) {
      setShowOptionsDialog(true);
      return;
    }
    setShowQuantity(true);
  };

  const updateCartQuantity = async (newQuantity, optionIndex) => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }
    if (updatingQuantity) {
      pendingQuantityRef.current = { newQuantity, optionIndex };
      return;
    }
    setUpdatingQuantity(true);
    
    const actualOptionIndex = optionIndex ?? selectedOptionIdx;
    const latestQuantity = Math.max(0, newQuantity);
    const optionToAdd = product.options?.[actualOptionIndex] || product.options?.[0] || {};
    
    // Skip if no valid option
    if (!optionToAdd.unit || !optionToAdd.unitSize) {
      alert("Product option missing unit/unitSize. Cannot update cart.");
      setUpdatingQuantity(false);
      return;
    }

    try {
      const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
      const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
      const cartRef = collection(db, 'users', userDocId, 'cart');
      const prevQty = optionQuantities[actualOptionIndex] || 0;
      const q = query(
        cartRef,
        where('productId', '==', product.id),
        where('unit', '==', optionToAdd.unit),
        where('unitSize', '==', optionToAdd.unitSize)
      );
      
      const cartSnap = await getDocs(q);
      
      if (!cartSnap.empty) {
        const cartDoc = cartSnap.docs[0];
        if (latestQuantity > 0) {
          // Update existing cart item with the new quantity
          await updateDoc(cartDoc.ref, {
            quantity: latestQuantity,
            addedAt: new Date().toISOString(),
            mrp: optionToAdd.mrp,
            sellingPrice: optionToAdd.sellingPrice ?? product.sellingPrice ?? null,
            price: optionToAdd.sellingPrice ?? product.sellingPrice ?? null,
          });
          console.log('Updated existing cart item with new quantity');
        } else {
          // If quantity is 0, remove the item from the cart
          await deleteDoc(cartDoc.ref);
          console.log('Removed item from cart');
        }
      } else if (latestQuantity > 0) {
        // Add as a new cart item only if quantity is positive
        const { id: _, ...productWithoutId } = product;
        const cartItem = {
          productId: product.id,
          ...productWithoutId,
          ...optionToAdd,
          quantity: latestQuantity,
          addedAt: new Date().toISOString(),
          mrp: optionToAdd.mrp,
          sellingPrice: optionToAdd.sellingPrice ?? product.sellingPrice ?? null,
          price: optionToAdd.sellingPrice ?? product.sellingPrice ?? null,
          cartItemId: `${product.id}_${optionToAdd.unit}_${optionToAdd.unitSize}`
        };
        const userRef = doc(db, 'usersByUid', user.uid);
        const userDoc = await getDoc(userRef);
        const userId = userDoc.exists() ? userDoc.data().userDocId : user.uid;
        const cartRef = collection(db, 'users', userId, 'cart');
        await addDoc(cartRef, cartItem);
        console.log('Added new cart item with unique option');
      }

      // Update local state immediately
      const newOptionQuantities = { ...optionQuantities };
      if (latestQuantity > 0) {
        newOptionQuantities[actualOptionIndex] = latestQuantity;
      } else {
        delete newOptionQuantities[actualOptionIndex];
      }
      setOptionQuantities(newOptionQuantities);
      
      // Update current variant state if it's the selected option
      if (actualOptionIndex === selectedOptionIdx) {
        setAddQuantity(latestQuantity);
        setHasCurrentVariantInCart(latestQuantity > 0);
        setCurrentVariantQty(latestQuantity);
        if (!hasMultipleOptions) {
          setShowQuantity(latestQuantity > 0);
        }
      }
      
      // Update any variant state
      const hasAny = Object.values(newOptionQuantities).some(qty => qty > 0);
      setInCartAnyVariant(hasAny);
      // Trigger fly-to-cart on first add for this option
      if (prevQty === 0 && latestQuantity > 0) {
        const startEl = imgBoxRef.current;
        const imgSrc = product.imageUrls?.[0] || '';
        animateAddToCart(startEl, imgSrc);
      }
      
      if (onAddToCart) onAddToCart(product, latestQuantity);
    } catch (err) {
      console.error('Error updating cart:', err);
      alert("Failed to update cart. Please try again.");
    } finally {
      setUpdatingQuantity(false);
      // Process any queued updates
      if (pendingQuantityRef.current !== null) {
        const { newQuantity: nextQty, optionIndex: nextIdx } = pendingQuantityRef.current;
        pendingQuantityRef.current = null;
        updateCartQuantity(nextQty, nextIdx);
      }
    }
  };

  useEffect(() => {
    const checkAllVariantsInCart = async () => {
      if (!user) {
        setOptionQuantities({});
        setHasCurrentVariantInCart(false);
        setShowQuantity(false);
        return;
      }

      try {
        const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
        const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
        const cartRef = collection(db, 'users', userDocId, 'cart');
        const q = query(cartRef, where('productId', '==', product.id));
        const cartSnap = await getDocs(q);

        const quantities = {};
        let hasAnyVariant = false;
        if (!cartSnap.empty) {
          cartSnap.docs.forEach(doc => {
            const item = doc.data();
            const optionIndex = product.options.findIndex(
              opt => opt.unit === item.unit && opt.unitSize === item.unitSize
            );
            if (optionIndex !== -1) {
              quantities[optionIndex] = item.quantity;
              hasAnyVariant = true;
            }
          });
        }
        setOptionQuantities(quantities);
        setInCartAnyVariant(hasAnyVariant);

        // Update state for the currently selected option
        const currentOptionQuantity = quantities[selectedOptionIdx] || 0;
        if (currentOptionQuantity > 0) {
          setHasCurrentVariantInCart(true);
          setCurrentVariantQty(currentOptionQuantity);
          setAddQuantity(currentOptionQuantity);
          if (!hasMultipleOptions) {
            setShowQuantity(true);
          }
        } else {
          setHasCurrentVariantInCart(false);
          setCurrentVariantQty(0);
          if (!hasMultipleOptions) {
            setShowQuantity(false);
          }
        }
      } catch (error) {
        console.error("Error checking variants in cart:", error);
        setOptionQuantities({});
        setHasCurrentVariantInCart(false);
      }
    };

    checkAllVariantsInCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, product.id, selectedOptionIdx, hasMultipleOptions]);

  return (
    <Card 
      className="product-card" 
      sx={{ 
        height: '100%', 
        position: 'relative', 
        overflow: 'hidden', 
        m: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        p: 0.5,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          transform: 'translateY(-2px)'
        }
      }}>
  {/* Wishlist widget */}
  <WishlistWidget product={product} selectedOption={option} onAdd={onAddToWishlist} />
  {/* Share button (top-left) */}
  <ShareButton product={product} sx={{ zIndex: 11 }} />
      <Link to={`/product/${product.category}/${product.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
        <Box
          ref={imgBoxRef}
          className="product-card-image-container"
          sx={{
            width: '100%',
            aspectRatio: '1/1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: 2,
            overflow: 'hidden',
            margin: '0 auto 8px',
            position: 'relative',
            padding: 0
          }}
        >
          {(product.offerZone === true || product.showOfferBand === true || typeof product.offerPrice === 'number') && (
            <Box sx={{ position: 'absolute', left: 8, top: 8, zIndex: 15, bgcolor: '#d32f2f', color: '#fff', px: 1.2, py: 0.4, borderRadius: 1, fontWeight: 800, fontSize: '0.75rem' }}>
              {t('offerBadge', 'OFFER')}
            </Box>
          )}
          <CardMedia
            component="img"
            image={product.imageUrls?.[0] || "https://via.placeholder.com/180"}
            alt={product.name}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              borderRadius: 2,
              transition: 'transform 0.3s ease',
              position: 'static',
              boxShadow: 'none',
              background: 'transparent',
              m: 0,
              p: 0,
              '&:hover': {
                transform: 'scale(1.05)'
              }
            }}
          />
        </Box>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          <CardContent sx={{ p: 0.25, pt: 0, pb: 0, flex: 1, paddingBottom: '0 !important' }}>
      <Box 
        className="product-name-container"
        style={{ width: '100%', overflow: 'hidden', position: 'relative', textAlign: 'center', minHeight: '2.2em' }}
      >
        {getDisplayName().length > 15 ? (
          <div className="scrolling-text-container">
            <span className="scrolling-text" style={{ fontWeight: 700, fontSize: '0.98rem', color: '#333' }}>{getDisplayName()}</span>
          </div>
        ) : (
          <Typography
            className="product-name"
            variant="subtitle1"
            fontWeight={700}
            sx={{ 
              fontSize: '0.98rem',
              mt: 0.7,
              mb: 0.2,
              lineHeight: 1.15,
              display: 'inline-block',
              width: 'auto',
              minWidth: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textAlign: 'center',
              position: 'relative',
              color: '#333'
            }}
          >
            {getDisplayName()}
          </Typography>
        )}
        {/* Price, unit, offer, and save section with improved spacing */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.3, mb: 0.2 }}>
          {/* Price row */}
          <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'nowrap', gap: 0.7, mt: 0.1 }}>
            <Typography className="selling-price" sx={{ fontWeight: 900, color: '#000', fontSize: '1.18rem', lineHeight: 1 }}>
              ₹{effectiveSellingPrice}
            </Typography>
            {option.mrp && option.mrp > effectiveSellingPrice && (
              <Typography className="mrp-price" sx={{ textDecoration: 'line-through', color: '#888', fontWeight: 600, fontSize: '0.92rem', lineHeight: 1 }}>
                ₹{option.mrp}
              </Typography>
            )}
          </Box>
          {/* Unit and offer row */}
          {(option.unit && option.unitSize) || discount ? (
            <Typography variant="caption" sx={{ color: '#666', fontWeight: 500, fontSize: '0.89em', display: 'block', mt: 0.1, mb: 0, lineHeight: 1.1 }}>
              {option.unitSize && option.unit ? `${option.unitSize} ${getUnitText ? getUnitText(option.unit) : option.unit}` : ''}
              {option.unitSize && option.unit && discount ? ' | ' : ''}
              {discount ? <span style={{ color: '#d32f2f', fontWeight: 600 }}>{discount}% {t('off', 'off')}</span> : null}
            </Typography>
          ) : null}
          {/* You save row */}
          {option.mrp && option.mrp > effectiveSellingPrice && (
            <Typography sx={{ color: '#2e7d32', fontWeight: 800, fontSize: '0.93rem', lineHeight: 1.1, mt: 0.1, textAlign: 'center' }}>
              {t('youSave', 'You save')}: ₹{Number((Math.max(0, (option.mrp || 0) - (effectiveSellingPrice || 0))).toFixed(2))}
            </Typography>
          )}
        </Box>
              </Box>
            {/* Product Pricing Section removed duplicate price row (now included above) */}
          </CardContent>
        </Box>
      </Link>
      {/* Add to Cart Section (fixed height to prevent layout shift) */}
      <Box
        className="add-to-cart-container"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: hasMultipleOptions ? 'auto' : 56,
          minHeight: 56,
          p: 0,
          m: 0,
          mt: 0,
          gap: 0,
        }}
      >
        {/* Show Add to Cart button only if not showing quantity selector for single option products */}
        {hasMultipleOptions ? (
          <Box sx={{ width: '100%', px: 0, pb: 0 }}>
            <Button
              variant="contained"
              color="success"
              size="small"
              fullWidth
              className="add-to-cart-btn"
              onClick={handleAddToCartClick}
              disabled={product.outOfStock}
              sx={{ height: 40, minHeight: 40, borderRadius: 2, fontWeight: 800, textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              {product.outOfStock ? t('outOfStock', 'Out of Stock') : (inCartAnyVariant ? t('addAnother', 'Add Another') : t('addOptions', 'Add Options'))}
            </Button>
          </Box>
        ) : (
          (!showQuantity) && (
            <Button
              variant="contained"
              color="success"
              size="small"
              fullWidth
              className="add-to-cart-btn"
              onClick={(e) => {
                if (hasCurrentVariantInCart) {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate('/cart');
                } else {
                  updateCartQuantity(1, 0);
                }
              }}
              disabled={product.outOfStock}
              sx={{ height: 40, minHeight: 40, borderRadius: 2, fontWeight: 800, textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              {product.outOfStock ? t('outOfStock', 'Out of Stock') : (hasCurrentVariantInCart ? t('goToCart', 'Go to Cart') : t('addToCart', 'Add'))}
            </Button>
          )
        )}
        {/* Show quantity controls only for single option products after adding to cart */}
        {showQuantity && !hasMultipleOptions && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', mb: 0, height: 40 }}>
            <IconButton size="small" sx={{
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: '50%',
              bgcolor: 'success.main',
              color: '#fff',
              '&:hover': { bgcolor: 'success.dark' }
            }} onClick={async e => {
              e.stopPropagation();
              if (addQuantity <= 1) {
                // Don't allow going below 1, remove from cart instead
                await updateCartQuantity(0, 0);
              } else {
                const newQty = addQuantity - 1;
                await updateCartQuantity(newQty, 0);
              }
            }}>
              <RemoveIcon fontSize="small" />
            </IconButton>
            <Typography sx={{ mx: 1, minWidth: 22, textAlign: 'center', fontSize: '1rem', fontWeight: 600, lineHeight: '36px' }}>{addQuantity}</Typography>
            <IconButton size="small" sx={{
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: '50%',
              bgcolor: 'success.main',
              color: '#fff',
              '&:hover': { bgcolor: 'success.dark' }
            }} onClick={async e => {
              e.stopPropagation();
              const newQty = addQuantity + 1;
              setAddQuantity(newQty);
              await updateCartQuantity(newQty, 0);
            }}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      {/* Options Dialog for products with multiple options */}
      <Dialog open={showOptionsDialog} onClose={() => setShowOptionsDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', pb: 1 }}>{t('choosePack') || 'Choose Option'}</DialogTitle>
        <DialogContent sx={{ px: 2, py: 1 }}>
          {Array.isArray(product.options) && product.options.length > 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {product.options.map((opt, idx) => {
                const quantity = optionQuantities[idx] || 0;

                return (
                  <Box key={idx} sx={{ border: '1px solid #eee', borderRadius: 2, p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{opt.unitSize} {opt.unit} - ₹{opt.sellingPrice}</Typography>
                      {opt.mrp && opt.mrp > opt.sellingPrice && (
                        <Typography sx={{ textDecoration: 'line-through', color: '#888', fontWeight: 500, fontSize: '0.95rem' }}>MRP: ₹{opt.mrp}</Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <IconButton size="small" disabled={quantity === 0} sx={{
                        width: 36,
                        height: 36,
                        flexShrink: 0,
                        borderRadius: '50%',
                        bgcolor: quantity === 0 ? 'action.disabledBackground' : 'success.main',
                        color: quantity === 0 ? 'action.disabled' : '#fff',
                        '&:hover': { bgcolor: quantity === 0 ? 'action.disabledBackground' : 'success.dark' }
                      }} onClick={() => {
                        if (quantity <= 1) {
                          // Remove from cart when going below 1
                          updateCartQuantity(0, idx);
                        } else {
                          updateCartQuantity(quantity - 1, idx);
                        }
                      }}>
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                      <Typography sx={{ mx: 1, minWidth: 22, textAlign: 'center', fontSize: '1rem', fontWeight: 600, lineHeight: '36px' }}>{quantity}</Typography>
                      <IconButton size="small" sx={{
                        width: 36,
                        height: 36,
                        flexShrink: 0,
                        borderRadius: '50%',
                        bgcolor: 'success.main',
                        color: '#fff',
                        '&:hover': { bgcolor: 'success.dark' }
                      }} onClick={() => updateCartQuantity(quantity + 1, idx)}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button onClick={() => setShowOptionsDialog(false)} color="inherit" sx={{ borderRadius: 2 }}>{t('close') || 'Close'}</Button>
        </DialogActions>
      </Dialog>
      {/* Auth Required Dialog here */}
      <AuthRequiredPrompt 
        open={showAuthDialog} 
        onClose={() => setShowAuthDialog(false)} 
      />
    </Box>

  {/* wishlist UI moved to WishlistWidget */}
    </Card>
  );
};

export default ProductCard;