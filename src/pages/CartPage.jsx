import React, { useContext, useState, useMemo, useCallback } from "react";
import { TextField, FormControlLabel, Checkbox, Paper, Card, CardContent, Divider, Typography as MuiTypography } from "@mui/material";
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import withPullToRefresh from '../components/withPullToRefresh';
import { useGSTDetails } from "../hooks/useGSTDetails";
import { Box, Typography, Button, CircularProgress, Alert, Container, Chip, Stack } from "@mui/material";
import { useNotification } from '../components/NotificationProvider';
import { AuthContext } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

// Component and Hook Imports
import OrderSummaryCard from "../checkout/components/OrderSummaryCard";
import DeliveryAddressCard from "../checkout/components/DeliveryAddressCard";
import PromoCodeCard from "../checkout/components/PromoCodeCard";
import { useCheckoutData } from "../hooks/useCheckoutData";
import { calculateOrderSummary } from "../utils/orderUtils";
import { useLanguage } from "../context/LanguageContext";

const CartPage = () => {
  const { t } = useLanguage();
  const { user } = useContext(AuthContext);
  const { notify } = useNotification() || { notify: () => {} };
  const [selectedAddressId, setSelectedAddressId] = useState("");
  // appliedPromo will hold the promo object returned from Firestore or null
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoNotice, setPromoNotice] = useState('');
  const [cartVersion, setCartVersion] = useState(0); // Used to force re-render on cart updates
  const navigate = useNavigate();
  const location = useLocation();

  const { userProfile, addresses, cartItems, loading, error, refreshData } = useCheckoutData(setSelectedAddressId);
  const { gstDetails, setGSTDetails, loading: gstLoading, error: gstError } = useGSTDetails();
  const [claimGST, setClaimGST] = useState(false);
  const [gstForm, setGstForm] = useState(gstDetails || { gstNumber: '', businessName: '', businessAddress: '' });
  const [gstSaveLoading, setGstSaveLoading] = useState(false);
  // Update local GST form when GST details change
  React.useEffect(() => {
    setGstForm(gstDetails || { gstNumber: '', businessName: '', businessAddress: '' });
  }, [gstDetails]);
  const handleGSTInputChange = (e) => {
    const { name, value } = e.target;
    setGstForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveGSTDetails = async () => {
    setGstSaveLoading(true);
    try {
      await setGSTDetails(gstForm);
      notify('GST details saved successfully', 'success');
    } catch {
      notify('Failed to save GST details', 'error');
    } finally {
      setGstSaveLoading(false);
    }
  };

  const itemsToProcess = useMemo(() =>
    location.state?.source === "wishlist" ? location.state.items : cartItems,
    [location.state, cartItems, cartVersion]
  );
  
  // base summary (before any promo) - used for delivery calculations and progress bars
  const baseSummary = useMemo(() => calculateOrderSummary(itemsToProcess), [itemsToProcess]);

  const orderSummary = useMemo(() => {
    console.log('Cart items in CartPage:', itemsToProcess);
    const summary = calculateOrderSummary(itemsToProcess);
    // reset promo notice
    setPromoNotice('');
    // Apply promo code discount if any
    if (appliedPromo) {
      let discount = 0;
      try {
        const type = String((appliedPromo.type || '')).trim().toLowerCase();
        const amount = Number(appliedPromo.amount) || 0;

        if (type === 'percentage' || type === 'percent') {
          // percentage stored as number e.g. 10 for 10%
          discount = Math.round((summary.total * amount) / 100);
        } else {
          // treat everything else as fixed rupee discount
          discount = amount;
          // if rupee discount exceeds cart total, inform user and cap it
          if (discount > summary.total) {
            setPromoNotice(`Promo is for ₹${discount.toLocaleString('en-IN')}, but cart subtotal is only ₹${summary.total.toLocaleString('en-IN')}. Discount applied up to ₹${summary.total.toLocaleString('en-IN')}.`);
            discount = summary.total;
          }
        }
      } catch (e) {
        discount = 0;
      }

      // Ensure discount isn't greater than total (safety)
      if (discount > summary.total) discount = summary.total;

      const totalAfter = Math.max(0, summary.total - discount);
      return {
        ...summary,
        discount,
        total: totalAfter,
        promo: appliedPromo
      };
    }
    
    return summary;
  }, [itemsToProcess, appliedPromo]);

  const selectedAddressObject = useMemo(
    () => addresses.find((a) => a.id === selectedAddressId),
    [addresses, selectedAddressId]
  );

  // Keep track of delivery option (stored by DeliveryOptionsCard in localStorage)
  const [deliveryOption, setDeliveryOption] = React.useState(() => {
    try {
      const v = localStorage.getItem('deliveryOption') || 'standard';
      return v === 'fast' ? 'express' : v;
    } catch (_) { return 'standard'; }
  });
  // Listen for changes dispatched from DeliveryOptionsCard
  React.useEffect(() => {
    const handler = (e) => {
      const val = (e && e.detail && e.detail.option) || null;
      if (val === 'standard' || val === 'express' || val === 'fast') setDeliveryOption(val === 'fast' ? 'express' : val);
    };
    window.addEventListener('deliveryOptionChanged', handler);
    return () => window.removeEventListener('deliveryOptionChanged', handler);
  }, []);

  const deliveryCharge = React.useMemo(() => {
    const sub = Number(baseSummary.total || 0);
    if (deliveryOption === 'standard') return sub > 500 ? 0 : 49;
    return sub > 1000 ? 0 : 99; // express
  }, [deliveryOption, baseSummary]);

  // Final amount shown to user includes delivery charge
  const finalAmount = (Number(orderSummary.total || 0) + Number(deliveryCharge || 0));

  const handleProceedToPayment = useCallback(() => {
    if (!selectedAddressId) {
      notify('Please select a delivery address to continue', 'warning');
      return;
    }
    navigate("/payment", {
      state: {
        orderSummary,
        selectedAddress: selectedAddressObject,
        userProfile,
        cartItems: itemsToProcess,
        gstDetails: claimGST ? gstForm : null,
        claimGST,
        deliveryCharge,
        finalAmount,
        baseTotal: baseSummary.total,
        deliveryOption,
      },
    });
  }, [selectedAddressId, orderSummary, selectedAddressObject, userProfile, itemsToProcess, navigate, notify]);

  const handleCartUpdate = useCallback(() => {
    // Force a refresh of cart data
    setCartVersion(prev => prev + 1);
    refreshData();
  }, [refreshData]);

  // Listen for global checkout-refresh events (used by pull-to-refresh HOC)
  React.useEffect(() => {
    const handler = async () => {
      try {
        await refreshData();
      } catch (e) {
        console.error('Error refreshing checkout data via event:', e);
      }
    };
    window.addEventListener('checkout-refresh', handler);
    return () => window.removeEventListener('checkout-refresh', handler);
  }, [refreshData]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (orderSummary.items.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Your cart is empty
        </Typography>
        <Typography color="text.secondary" paragraph>
          Looks like you haven't added anything to your cart yet.
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => navigate('/')}
          endIcon={<ArrowForwardIcon />}
        >
          Continue Shopping
        </Button>
      </Container>
    );
  }

  return (
    // Single-column, mobile-first layout: components stacked vertically
    <Box sx={{
      bgcolor: 'grey.50',
      minHeight: '100vh',
      px: { xs: 2, sm: 3, md: 4 },
      py: { xs: 2, sm: 3 },
    }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        {/* Header with item count on the right */}
        <Box sx={{ 
          mb: 3, 
          display: 'flex', 
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          pt: 2,
          px: { xs: 0, sm: 2 }
        }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
            Shopping Cart
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" color="success" label={`Items: ${orderSummary.items.length}`} sx={{ fontWeight: 700 }} />
          </Stack>
        </Box>
        {/* Order summary (moved to top as requested) */}
        <Box sx={{ mb: { xs: 2, sm: 3 }, px: { xs: 0, sm: 2 } }}>
          <OrderSummaryCard 
            summary={{
              ...orderSummary,
              items: itemsToProcess,
              baseTotal: baseSummary.total
            }} 
            onUpdateCart={handleCartUpdate}
            showQuantityControls={true}
            showDeleteButton={true}
          />
        </Box>

        {/* Delivery address */}
        <Box sx={{ mb: { xs: 2, sm: 3 }, px: { xs: 0, sm: 2 } }}>
          <DeliveryAddressCard
            addresses={addresses}
            selectedAddressId={selectedAddressId}
            onSelectAddress={setSelectedAddressId}
            onAddNewAddress={() => navigate('/addresses', { state: { fromCart: true } })}
            orderTotal={baseSummary.total} /* delivery uses pre-discount subtotal */
          />
          <PromoCodeCard
            onApplyPromo={(promoOrNull) => setAppliedPromo(promoOrNull)}
          />
        </Box>

        {/* GST Details Section - Minimal UI */}
        <Card elevation={1} sx={{ mb: 2, borderRadius: 2, boxShadow: 1, py: 1 }}>
          <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ReceiptLongIcon color="primary" sx={{ fontSize: 20 }} />
                  <MuiTypography variant="subtitle2" fontWeight={700}>
                    {t('claimGstShort', 'Claim GST')}
                  </MuiTypography>
                </Box>
                <Box>
                  <Checkbox checked={claimGST} onChange={e => setClaimGST(e.target.checked)} size="small" />
                </Box>
              </Box>
              <MuiTypography variant="caption" color="text.secondary" mb={0.5} sx={{ display: 'block' }}>
                {t('claimGstDesc', 'Add GST details for invoice')}
              </MuiTypography>
            {claimGST && (
              <Box sx={{ mt: 0.5, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                {claimGST && (
                  <Box sx={{ mt: 1, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
                    <TextField
                      label={t('gstNumber', 'GST Number')}
                      name="gstNumber"
                      value={gstForm.gstNumber}
                      onChange={handleGSTInputChange}
                      fullWidth
                      size="small"
                      margin="dense"
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label={t('businessName', 'Business Name')}
                      name="businessName"
                      value={gstForm.businessName}
                      onChange={handleGSTInputChange}
                      fullWidth
                      size="small"
                      margin="dense"
                      sx={{ flex: 1 }}
                    />
                  </Box>
                )}
                {claimGST && (
                  <TextField
                    label={t('businessAddress', 'Business Address')}
                    name="businessAddress"
                    value={gstForm.businessAddress}
                    onChange={handleGSTInputChange}
                    fullWidth
                    size="small"
                    margin="dense"
                    sx={{ mt: 1 }}
                  />
                )}
                {claimGST && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSaveGSTDetails}
                    disabled={gstSaveLoading}
                    sx={{ mt: 0.5, borderRadius: 1.5, fontWeight: 600, px: 2, py: 0.5, fontSize: '0.8rem' }}
                  >
                    {gstSaveLoading ? <CircularProgress size={14} /> : t('save', 'Save')}
                  </Button>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* (Totals already shown above) */}

        {/* Promo applied message (shows as subtraction) */}
        {orderSummary?.discount > 0 && (
          <Box sx={{ mb: 1, px: { xs: 0, sm: 2 } }}>
            <Alert severity="success" sx={{ borderRadius: 1 }}>
              {`-₹${(orderSummary.discount || 0).toLocaleString('en-IN')} applied with code ${orderSummary.promo?.code || ''} (${String(orderSummary.promo?.type || '').toLowerCase() === 'percentage' ? orderSummary.promo.amount + '%' : '₹' + orderSummary.promo.amount})`}
              {promoNotice ? <div style={{ marginTop: 6, fontSize: 12, color: '#155724' }}>{promoNotice}</div> : null}
            </Alert>
          </Box>
        )}

        {/* Checkout button */}
        <Box sx={{ 
          position: 'sticky', 
          bottom: 16,
          px: { xs: 0, sm: 2 },
          width: '100%',
          zIndex: 10,
          backgroundColor: 'transparent'
        }}>
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleProceedToPayment}
            disabled={!selectedAddressId || loading}
            sx={{
              py: 1.5,
              px: 3,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '1rem',
              boxShadow: 3,
            }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              `${t('proceedToPay', 'Proceed to Pay')} ${Number(finalAmount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}`
            )}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

const CartPageWithPullToRefresh = withPullToRefresh(CartPage, async () => {
  // Dispatch an event the page listens to so the in-component refreshData() is invoked
  try {
    window.dispatchEvent(new CustomEvent('checkout-refresh'));
  } catch (error) {
    console.error('Error dispatching checkout-refresh event:', error);
  }
});

export default CartPageWithPullToRefresh;