import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Divider, 
  IconButton, 
  CircularProgress,
  Chip,
  Stack
} from '@mui/material';
import { 
  Add as AddIcon, 
  Remove as RemoveIcon, 
  Delete as DeleteIcon 
} from '@mui/icons-material';
import { db } from '../../firebase';
import { 
  doc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { AuthContext } from '../../context/AuthContext';
import { useContext } from 'react';

const OrderSummaryCard = ({ summary, onUpdateCart }) => {
  const items = summary?.items || [];
  
  // Debug: Log the items when they change
  React.useEffect(() => {
    console.log('Cart items:', items);
    if (items.length > 0) {
      console.log('First item keys:', Object.keys(items[0]));
    }
  }, [items]);
  // Enhanced price calculation function
  const getItemPrices = (item) => {
    if (!item) return { mrp: 0, price: 0 };
    
    console.log('Getting prices for item:', item);
    
    // Default values
    let mrp = 0;
    let price = item.price || 0;
    
    // Try to find matching option
    if (Array.isArray(item.options)) {
      const matchedOption = item.options.find(opt => 
        opt && 
        opt.unit === item.unit && 
        String(opt.unitSize) === String(item.unitSize)
      );
      
      if (matchedOption) {
        mrp = matchedOption.mrp || matchedOption.sellingPrice || price;
        price = matchedOption.sellingPrice || price;
      } else if (item.options.length > 0) {
        // Fallback to first option if no match found
        mrp = item.options[0].mrp || item.options[0].sellingPrice || price;
        price = item.options[0].sellingPrice || price;
      }
    }
    
    // If still no MRP, use item's own fields
    if (!mrp) {
      mrp = item.mrp || item.sellingPrice || price;
    }
    
    // Ensure price is a number
    price = Number(price) || 0;
    mrp = Number(mrp) || price;
    
    console.log('Calculated prices:', { mrp, price });
    return { mrp, price };
  };
  const { user: currentUser } = useContext(AuthContext);
  const [updatingItem, setUpdatingItem] = useState(null);

  const handleQuantityChange = async (itemId, newQty) => {
    console.log('handleQuantityChange called with:', { itemId, newQty });
    
    if (!currentUser?.uid) {
      console.error('No user logged in');
      return;
    }
    
    if (newQty < 1) {
      handleDelete(itemId);
      return;
    }
    
    if (!itemId) {
      console.error('No item ID provided');
      console.log('Current items:', items);
      return;
    }
    
    // Find the item by any identifier
    const item = items.find(item => 
      item.id === itemId || 
      item.cartItemId === itemId ||
      `item-${items.indexOf(item)}` === itemId
    );
    
    if (!item) {
      console.error('Item not found in cart:', itemId);
      console.log('Available items:', items.map((i, idx) => ({
        id: i.id,
        cartItemId: i.cartItemId,
        name: i.name,
        index: idx,
        indexId: `item-${idx}`
      })));
      return;
    }
    
    // Use the Firestore document ID directly
    if (!item.id) {
      console.error('No document ID found for item:', item);
      return;
    }
    
    const docId = item.id; // Always use the Firestore document ID
    
    // Prevent multiple clicks while updating
    if (updatingItem === docId) {
      console.log('Update already in progress for item:', docId);
      return;
    }
    
    setUpdatingItem(docId);
    
    try {
      console.log('Updating quantity in Firestore...');
      const itemRef = doc(db, 'users', currentUser.uid, 'cart', docId);
      
      await updateDoc(itemRef, { 
        quantity: Number(newQty),
        lastUpdated: new Date().toISOString()
      });
      
      console.log('Quantity updated successfully');
      
      // Force a refresh of the cart data
      if (onUpdateCart) {
        console.log('Triggering cart update...');
        await onUpdateCart();
      }
    } catch (error) {
      console.error('Error updating quantity:', {
        error,
        itemId,
        newQty,
        userId: currentUser?.uid,
        timestamp: new Date().toISOString()
      });
      
      // Show error to user if notification system is available
      if (window.notify) {
        window.notify('Failed to update quantity. Please try again.', 'error');
      }
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleDelete = async (itemId) => {
    console.log('Attempting to delete item:', itemId);
    
    if (!currentUser?.uid || !itemId) {
      console.error('Cannot delete: Missing user ID or item ID');
      return;
    }
    
    // Find the item by any identifier
    const item = items.find(item => 
      item.id === itemId || 
      item.cartItemId === itemId ||
      `item-${items.indexOf(item)}` === itemId
    );
    
    if (!item) {
      console.error('Item not found for deletion:', itemId);
      console.log('Available items:', items.map((i, idx) => ({
        id: i.id,
        cartItemId: i.cartItemId,
        name: i.name,
        index: idx,
        indexId: `item-${idx}`
      })));
      return;
    }
    
    // Use the Firestore document ID directly
    if (!item.id) {
      console.error('No document ID found for item:', item);
      return;
    }
    
    const docId = item.id;
    
    setUpdatingItem(docId);
    
    try {
      console.log('Deleting item from cart:', docId);
      const itemRef = doc(db, 'users', currentUser.uid, 'cart', docId);
      await deleteDoc(itemRef);
      console.log('Item deleted successfully');
      
      if (onUpdateCart) {
        console.log('Triggering cart update after delete...');
        await onUpdateCart();
      }
    } catch (error) {
      console.error('Error deleting item:', {
        error,
        itemId,
        userId: currentUser.uid,
        timestamp: new Date().toISOString()
      });
      
      if (window.notify) {
        window.notify('Failed to remove item. Please try again.', 'error');
      }
    } finally {
      setUpdatingItem(null);
    }
  };
  
  // Calculate line totals using the correct property names from Firestore
  const lineTotals = items.map(item => {
    const { price } = getItemPrices(item);
    const qty = item.quantity || 1;
    return price * qty;
  });
  
  const subTotal = lineTotals.reduce((a, b) => a + b, 0);
  // Allow using a pre-discount base total when provided by parent (CartPage)
  const baseTotal = typeof summary?.baseTotal === 'number' ? Number(summary.baseTotal) : subTotal;
  // Delivery selection state (synced with DeliveryOptionsCard via localStorage + event)
  const [deliveryOption, setDeliveryOption] = React.useState(() => {
    try {
      const v = localStorage.getItem('deliveryOption') || 'standard';
      return v === 'fast' ? 'express' : v; // backward compatibility
    } catch (_) { return 'standard'; }
  });
  React.useEffect(() => {
    const handler = (e) => {
      const val = (e && e.detail && e.detail.option) || null;
      // accept legacy 'fast' but normalize to 'express'
      if (val === 'standard' || val === 'express' || val === 'fast') setDeliveryOption(val === 'fast' ? 'express' : val);
    };
    window.addEventListener('deliveryOptionChanged', handler);
    // Also sync on mount from storage in case
    try {
      const s = localStorage.getItem('deliveryOption');
      if (s) setDeliveryOption(s === 'fast' ? 'express' : s);
    } catch (_) {}
    return () => window.removeEventListener('deliveryOptionChanged', handler);
  }, []);
  const deliveryCharge = React.useMemo(() => {
    if (deliveryOption === 'standard') {
      return baseTotal > 500 ? 0 : 49;
    }
    // express: free above 2000
    return baseTotal > 2000 ? 0 : 99;
  }, [deliveryOption, baseTotal]);
  
  // Calculate savings (MRP - Selling Price) and MRP total
  let savings = 0;
  let mrpTotal = 0;
  
  items.forEach(item => {
    const { mrp, price } = getItemPrices(item);
    const qty = item.quantity || 1;
    mrpTotal += mrp * qty;
    savings += Math.max(0, (mrp - price) * qty);
  });
  
  // New calculation for savings percentage
  const savedPercentage = mrpTotal > 0 ? ((savings / mrpTotal) * 100).toFixed(2) : 0;

  // Currency formatter (Indian numbering)
  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <Card sx={{ 
      borderRadius: { xs: 0, sm: 2 },
      boxShadow: { xs: 'none', sm: 3 },
      mb: { xs: 1.5, sm: 2 },
      overflow: 'hidden',
      border: '1px solid #e8f5e9',
      background: 'linear-gradient(180deg,#ffffff 0%, #f9fffb 100%)'
    }}>
      <CardContent sx={{ py: 1.25, px: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.2, fontSize: { xs: '1rem', sm: '1.05rem' } }}>Order Summary</Typography>
          <Stack direction="row" spacing={1}>
            {savings > 0 && (
              <Chip size="small" variant="outlined" color="success" label={`You save ${savedPercentage}%`} sx={{ fontWeight: 700 }} />
            )}
          </Stack>
        </Box>


        {items.map((item, index) => {
          // Use the Firestore document ID as the primary ID
          const itemId = item.id || `item-${index}`;
          const qty = item.quantity || item.qty || 1;
          const { mrp, price } = getItemPrices(item);
          const lineTotal = price * qty;
          const imageSrc = Array.isArray(item.imageUrls) 
            ? item.imageUrls[0] 
            : (item.imageUrl || item.image);
          
          console.log('Rendering cart item:', { 
            itemId, 
            qty,
            price,
            mrp,
            itemKeys: Object.keys(item) 
          });
          
          return (
            <React.Fragment key={itemId}>
              <Box sx={{ display: 'flex', alignItems: 'center', py: 0.9 }}>
                <Box sx={{ width: 54, height: 54, mr: 1.2, borderRadius: 1.5, overflow: 'hidden', bgcolor: 'grey.100', boxShadow: 1 }}>
                  {imageSrc ? (
                    <img src={imageSrc} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : null}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography 
                    variant="subtitle1" 
                    sx={{ 
                      fontWeight: 700, 
                      mb: 0.2,
                      fontSize: { xs: '0.9rem', sm: '0.95rem' },
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.name}
                  </Typography>
                  
                  {(item.unitSize && item.unit) && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ mb: 0.2, fontSize: '0.75rem' }}
                    >
                      {item.unitSize} {item.unit?.toUpperCase?.()}
                    </Typography>
                  )}
                  {/* Prices on the left: MRP (striked) + Selling price in one row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9 }}>
                    {mrp != null && (
                      <Typography variant="body2" color="text.secondary" sx={{ textDecoration: 'line-through', fontSize: '0.75rem' }}>
                        {fmt(mrp)}
                      </Typography>
                    )}
                    <Typography 
                      variant="body2" 
                      sx={{ fontWeight: 900, color: 'primary.main', fontSize: '0.92rem' }}
                    >
                      {fmt(price)}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, ml: 1 }}>
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Delete button clicked for item:', itemId);
                        handleDelete(itemId);
                      }}
                      disabled={updatingItem === itemId}
                      sx={{ color: 'error.main', p: 0.5, alignSelf: 'flex-end' }}
                    >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Decrease quantity for item:', itemId);
                        handleQuantityChange(itemId, qty - 1);
                      }}
                      disabled={updatingItem === itemId || qty <= 1}
                      sx={{ p: 0.5 }}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>
                      {updatingItem === itemId ? <CircularProgress size={16} /> : qty}
                    </Typography>
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Increase quantity for item:', itemId);
                        handleQuantityChange(itemId, qty + 1);
                      }}
                      disabled={updatingItem === itemId}
                      sx={{ p: 0.5 }}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </Box>
              {index < items.length - 1 && <Divider sx={{ my: 0.4 }} />}
            </React.Fragment>
          );
        })}

        <Divider sx={{ my: 1.2 }} />

        {/* Totals breakdown */}
        <Box sx={{
          p: 1.25,
          borderRadius: 2,
          background: 'linear-gradient(90deg, #e8f5e9 0%, #ffffff 100%)',
          border: '1px solid rgba(56,142,60,0.18)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
            <Typography sx={{ textDecoration: 'line-through',fontWeight: 600, color: 'grey.700', letterSpacing: 0.2 }}>Total</Typography>
            <Typography sx={{ textDecoration: 'line-through', color: 'grey.700', fontWeight: 600 }}>{fmt(mrpTotal)}</Typography>
          </Box>
          {savings > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
              <Typography sx={{ fontWeight: 800, color: 'success.dark', letterSpacing: 0.2 }}>You Save</Typography>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                <Chip size="small" color="success" variant="filled" label={`${savedPercentage}%`} sx={{ fontWeight: 800 }} />
                <Typography color="success.main" sx={{ fontWeight: 900 }}>{fmt(savings)}</Typography>
              </Box>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: 0.2, fontSize: { xs: '1rem', sm: '1.05rem' } }}>Subtotal</Typography>
            <Typography sx={{ fontWeight: 900, color: 'text.primary', fontSize: { xs: '1.05rem', sm: '1.15rem' } }}>{fmt(subTotal)}</Typography>
          </Box>
          {!summary?.promo && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.6 }}>
              <Typography sx={{ fontWeight: 700, color: 'text.secondary' }}>Delivery ({deliveryOption === 'standard' ? 'Standard' : 'Express'})</Typography>
              <Typography sx={{ fontWeight: 800, color: deliveryCharge === 0 ? 'success.main' : 'text.primary' }}>
                {deliveryCharge === 0 ? 'Free' : fmt(deliveryCharge)}
              </Typography>
            </Box>
          )}
        </Box>
        
        {/* Promo / final totals block at bottom */}
        <Box sx={{ mt: 1 }}>
          {summary?.promo && (
            <Box sx={{ mb: 1, p: 1.25, borderRadius: 2, background: 'linear-gradient(90deg,#fff8e1 0%,#ffffff 100%)', border: '1px solid #ffe0b2' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>Promo Applied</Typography>
                  <Typography variant="caption" color="text.secondary">{summary.promo.code}</Typography>
                </Box>
                <Typography color="success.main" sx={{ fontWeight: 900, fontSize: '1rem' }}>-{fmt(summary.discount || 0)}</Typography>
              </Box>
              <Divider sx={{ my: 0.5 }} />
              {/* Show delivery inside promo card above final total so users see delivery contribution */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 700, color: 'text.secondary' }}>Delivery ({deliveryOption === 'standard' ? 'Standard' : 'Express'})</Typography>
                <Typography sx={{ fontWeight: 800, color: deliveryCharge === 0 ? 'success.main' : 'text.primary' }}>
                  {deliveryCharge === 0 ? 'Free' : fmt(deliveryCharge)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography sx={{ fontWeight: 800 }}>Total After Discount</Typography>
                <Typography sx={{ fontWeight: 900, color: 'primary.main' }}>{fmt((Number(summary.total ?? 0) + Number(deliveryCharge || 0)))}</Typography>
              </Box>
            </Box>
          )}

          {!summary?.promo && (
            <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 900, color: 'text.primary' }}>Final Total</Typography>
              <Typography sx={{ fontWeight: 900, color: 'primary.main' }}>{fmt(subTotal + deliveryCharge)}</Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default OrderSummaryCard;