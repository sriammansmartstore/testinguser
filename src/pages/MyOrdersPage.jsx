import React, { useEffect, useState, useContext } from 'react';
import { Box, Typography, IconButton, Grid, Card, CardContent, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText, Divider, CircularProgress, TextField, Stack, Tooltip, Snackbar, Alert } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import withPullToRefresh from '../components/withPullToRefresh';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, updateDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import VIPProgressBar from '../components/VIPProgressBar';
import { useLanguage } from '../context/LanguageContext';

const formatDate = (d) => {
  if (!d) return '';
  let dateObj = null;
  if (d.toDate && typeof d.toDate === 'function') dateObj = d.toDate();
  else if (d.seconds) dateObj = new Date(d.seconds * 1000);
  else if (typeof d === 'string') dateObj = new Date(d);
  else if (d instanceof Date) dateObj = d;
  else return String(d);

  try {
    return dateObj.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch (e) {
    return dateObj.toString();
  }
};

const STATUS_FLOW = ['pending', 'processing', 'shipped', 'in transit', 'delivered'];
const normalizeStatus = (s) => {
  if (!s) return 'pending';
  const v = String(s).trim().toLowerCase();
  if (v === 'in transist' || v === 'in-transit' || v === 'in_transit' || v === 'transit') return 'in transit';
  return v;
};
const statusColor = (s) => {
  const v = normalizeStatus(s);
  if (v === 'delivered') return 'success';
  if (v === 'cancelled') return 'error';
  if (v === 'shipped' || v === 'in transit') return 'info';
  if (v === 'processing') return 'warning';
  return 'default';
};
const OrderStatusChip = ({ status, t }) => {
  const v = normalizeStatus(status);
  let label = (status || 'Unknown').toString();
  if (t) {
    if (v === 'pending' || v === 'order placed') label = t('orderPlaced') || label;
    else if (v === 'processing') label = t('processing') || label;
    else if (v === 'packed') label = t('packed') || label;
    else if (v === 'shipped' || v === 'in transit') label = t('inTransit') || label;
    else if (v === 'delivered') label = t('delivered') || label;
    else if (v === 'cancelled') label = t('cancelled') || label;
    else if (v === 'returned') label = t('returned') || label;
  }
  return <Chip label={label} color={statusColor(status)} size="small" />;
};

const MyOrdersPage = () => {
  const { t } = useLanguage();
  const { user } = useContext(AuthContext) || {};
  const [userDocId, setUserDocId] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [savingCancel, setSavingCancel] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackSeverity, setSnackSeverity] = useState('success');
  // Return state
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnProduct, setReturnProduct] = useState(null);
  const [savingReturn, setSavingReturn] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!user) { setUserDocId(null); return; }
        const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
        setUserDocId(mapSnap.exists() ? (mapSnap.data()?.userDocId || null) : null);
      } catch (_) { setUserDocId(null); }
    })();
  }, [user]);

  // Update both top-level orders and user subcollection orders
  const updateOrderEverywhere = async (order, updates) => {
    const tasks = [];
    // Always update the selected ref first if available
    if (order?.ref) tasks.push(updateDoc(order.ref, updates));

    const orderId = order?.orderId || order?.id;
    if (!orderId) {
      await Promise.allSettled(tasks);
      return;
    }

    try {
      // Top-level orders by orderId or id
      const topCol = collection(db, 'orders');
      const qTop = query(topCol, where('orderId', '==', orderId));
      const snapTop = await getDocs(qTop);
      if (!snapTop.empty) {
        snapTop.forEach(d => tasks.push(updateDoc(d.ref, updates)));
      } else {
        // Fallback: try by doc id match
        const qTopById = query(topCol, where('__name__', '==', order.id));
        const snapTopById = await getDocs(qTopById);
        snapTopById.forEach(d => tasks.push(updateDoc(d.ref, updates)));
      }
    } catch (_) { /* ignore */ }

    try {
      if (userDocId) {
        // User subcollection by orderId or id
        const userCol = collection(db, 'users', userDocId, 'orders');
        const qUser = query(userCol, where('orderId', '==', orderId));
        const snapUser = await getDocs(qUser);
        if (!snapUser.empty) {
          snapUser.forEach(d => tasks.push(updateDoc(d.ref, updates)));
        } else {
          const qUserById = query(userCol, where('__name__', '==', order.id));
          const snapUserById = await getDocs(qUserById);
          snapUserById.forEach(d => tasks.push(updateDoc(d.ref, updates)));
        }
      }
    } catch (_) { /* ignore */ }

    await Promise.allSettled(tasks);

    // Note: coin/referral logic removed — no-op for delivered releases
  };

  // (Referral/coin release logic removed)

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const results = [];

        console.debug('[Orders] fetching orders for user.uid=', user.uid, 'email=', user.email, 'phone=', user.phoneNumber);

        // 1) Try user's subcollection: users/{SASS}/orders (no-throw)
        try {
          const mappedId = userDocId || (await (async () => { try { const m = await getDoc(doc(db,'usersByUid', user.uid)); return m.exists() ? (m.data()?.userDocId || null) : null; } catch(_) { return null; } })());
          if (mappedId) {
            const col = collection(db, 'users', mappedId, 'orders');
            const snap = await getDocs(query(col, orderBy('createdAt', 'desc')));
            console.debug('[Orders] found in users/{SASS}/orders:', snap.size);
            snap.docs.forEach(d => results.push({ id: d.id, ref: d.ref, ...d.data() }));
          }
        } catch (e) {
          console.debug('[Orders] users/{SASS}/orders query failed', e?.message || e);
        }

        // 2) Fallbacks in top-level 'orders' collection using multiple potential identifiers
        if (results.length === 0) {
          const col = collection(db, 'orders');
          const attempts = [];
          // try by userProfile.uid
          attempts.push(async () => {
            try {
              const q = query(col, where('userProfile.uid', '==', user.uid), orderBy('createdAt', 'desc'));
              const snap = await getDocs(q);
              console.debug('[Orders] query userProfile.uid ->', snap.size);
              snap.docs.forEach(d => results.push({ id: d.id, ref: d.ref, ...d.data() }));
            } catch (e) { console.debug('[Orders] query userProfile.uid failed', e?.message || e); }
          });
          // try by phone number
          if (user.phoneNumber) attempts.push(async () => {
            try {
              const q = query(col, where('userProfile.number', '==', user.phoneNumber), orderBy('createdAt', 'desc'));
              const snap = await getDocs(q);
              console.debug('[Orders] query userProfile.number ->', snap.size);
              snap.docs.forEach(d => results.push({ id: d.id, ref: d.ref, ...d.data() }));
            } catch (e) { console.debug('[Orders] query userProfile.number failed', e?.message || e); }
          });
          // try by email
          if (user.email) attempts.push(async () => {
            try {
              const q = query(col, where('userProfile.email', '==', user.email), orderBy('createdAt', 'desc'));
              const snap = await getDocs(q);
              console.debug('[Orders] query userProfile.email ->', snap.size);
              snap.docs.forEach(d => results.push({ id: d.id, ref: d.ref, ...d.data() }));
            } catch (e) { console.debug('[Orders] query userProfile.email failed', e?.message || e); }
          });

          // run attempts sequentially
          for (const fn of attempts) await fn();
        }

        console.debug('[Orders] total results before dedupe:', results.length);
        // dedupe by id
        const dedup = [];
        const seen = new Set();
        for (const r of results) {
          if (!seen.has(r.id)) { seen.add(r.id); dedup.push(r); }
        }

        // sort by createdAt (best-effort)
        dedup.sort((a, b) => {
          const ta = a.createdAt?.seconds ?? (a.createdAt ? Date.parse(a.createdAt) / 1000 : 0);
          const tb = b.createdAt?.seconds ?? (b.createdAt ? Date.parse(b.createdAt) / 1000 : 0);
          return tb - ta;
        });

        console.debug('[Orders] final count:', dedup.length, 'ids:', dedup.map(d => d.id));
        setOrders(dedup);
        // if navigated with a highlight id, open that order after load
        const highlightId = location.state?.highlightOrderId;
        if (highlightId) {
          const found = dedup.find(o => o.id === highlightId || o.orderId === highlightId);
          if (found) setSelected(found);
        }
      } catch (err) {
        console.error('Failed to load orders', err);
        setError('Failed to load orders.');
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [user]);

  if (!user) {
    return (
      <Box sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <IconButton onClick={() => navigate(-1)} size="small" sx={{ mr: 1 }}><ArrowBackIcon /></IconButton>
          <Typography variant="h6" sx={{ flex: 1 }}>{t('myOrdersTitle')}</Typography>
        </Box>
        <Typography>{t('login')}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: 980, mx: 'auto' }}>
      <Box display="flex" alignItems="center" mb={2}>
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ mr: 1 }}><ArrowBackIcon /></IconButton>
        <Typography variant="h5" sx={{ flex: 1, fontWeight: 700 }}>{t('myOrdersTitle')}</Typography>
      </Box>

  {/* VIP Progress Bar (compact) */}
  <VIPProgressBar orders={orders} threshold={5000} compact />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : orders.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="h6">{t('noOrdersFound')}</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {orders.map(order => (
            <Grid item xs={12} sm={6} key={order.id}>
              <Card sx={{ borderRadius: 2, boxShadow: 3, border: '1px solid rgba(0,0,0,0.06)' }}>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('order')} {order.orderId || order.id}</Typography>
                      <Typography variant="caption" color="text.secondary">{formatDate(order.createdAt)}</Typography>
                    </Box>
                    <OrderStatusChip status={order.status} t={t} />
                  </Box>

                  <Box mb={1}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{(order.items || order.cartItems || []).length ? `${(order.items || order.cartItems).length} item(s)` : `${t('totalAmount')}: ₹${order.total ?? order.amount ?? 0}`}</Typography>
                    <Typography variant="body2" color="text.secondary">Payment: {order.paymentMethod || order.payment?.method || 'N/A'} {order.paymentStatus ? `• ${order.paymentStatus}` : ''}</Typography>
                    {normalizeStatus(order.status) === 'cancelled' && order.cancelReason && (
                      <Alert severity="error" icon={false} sx={{ mt: 1, fontWeight: 600, borderRadius: 2, py: 0.5, px: 1 }}>
                        {t('cancelledNote')}: {order.cancelReason}
                      </Alert>
                    )}
                  </Box>

                  <Box display="flex" gap={1} justifyContent="flex-end">
                    <Button size="small" onClick={() => navigate(`/order/${order.orderId || order.id}`)}>View</Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={!!selected} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Order Details</DialogTitle>
        <DialogContent>
          {selected && (
            <Box>
              <Box mb={1} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('order')} {selected.orderId || selected.id}</Typography>
                <OrderStatusChip status={selected.status} t={t} />
              </Box>

              <Typography variant="body2" color="text.secondary">Placed: {formatDate(selected.createdAt)}</Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Items</Typography>
              <List dense>
                {(selected.items || selected.cartItems || []).map((it, idx) => (
                  <ListItem key={idx} sx={{ py: 0 }}>
                    <ListItemText primary={it.name || it.product?.name || it.productName} secondary={`${it.unitSize ? it.unitSize + ' ' + it.unit : ''} × ${it.quantity || it.qty || it.quantityOrdered || 1}`} />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{it.sellingPrice || it.price || it.total || ''}</Typography>
                    {/* Return product button for delivered orders */}
                    {normalizeStatus(selected.status) === 'delivered' && (
                      <Button size="small" color="warning" variant="outlined" sx={{ ml: 2 }} onClick={() => { setReturnProduct(it); setReturnReason(''); setReturnOpen(true); }}>
                        Return Product
                      </Button>
                    )}
                  </ListItem>
                ))}
              </List>

              {/* Return entire order button for delivered orders */}
              {normalizeStatus(selected.status) === 'delivered' && (
                <Button fullWidth color="warning" variant="contained" sx={{ mt: 2, fontWeight: 700 }} onClick={() => { setReturnProduct(null); setReturnReason(''); setReturnOpen(true); }}>
                  Return Entire Order
                </Button>
              )}
      {/* Return Dialog */}
      <Dialog open={returnOpen} onClose={() => !savingReturn && setReturnOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>{returnProduct ? `Return Product` : `Return Order`}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please tell us why you want to return {returnProduct ? `this product` : `the order`}.
          </Typography>
          {returnProduct && (
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
              {returnProduct.name || returnProduct.productName} ({returnProduct.unitSize} {returnProduct.unit})
            </Typography>
          )}
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            placeholder="Reason for return"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={savingReturn} onClick={() => setReturnOpen(false)}>Close</Button>
          <Button
            color="warning"
            variant="contained"
            disabled={savingReturn || !selected || !returnReason.trim()}
            onClick={async () => {
              setSavingReturn(true);
              try {
                // Prepare updates
                let updates = {};
                if (returnProduct) {
                  updates = {
                    returnedProducts: [ ...(selected.returnedProducts || []), {
                      productId: returnProduct.productId || returnProduct.id,
                      name: returnProduct.name || returnProduct.productName,
                      reason: returnReason.trim(),
                      returnedAt: serverTimestamp(),
                    } ]
                  };
                } else {
                  updates = {
                    status: 'returned',
                    returnReason: returnReason.trim(),
                    returnedAt: serverTimestamp(),
                  };
                }
                await updateOrderEverywhere(selected, updates);
                // reflect locally
                setOrders(prev => prev.map(o => (o.id === selected.id ? { ...o, ...updates } : o)));
                setSelected(prev => prev ? { ...prev, ...updates } : prev);
                setSnackMsg(returnProduct ? 'Product return requested' : 'Order return requested');
                setSnackSeverity('success');
                setSnackOpen(true);
              } catch (e) {
                console.error('Return order/product failed', e);
                setSnackMsg('Failed to request return. Please try again.');
                setSnackSeverity('error');
                setSnackOpen(true);
              } finally {
                setSavingReturn(false);
                setReturnOpen(false);
              }
            }}
          >
            {savingReturn ? 'Submitting…' : 'Confirm Return'}
          </Button>
        </DialogActions>
      </Dialog>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('orderSummary', 'Summary')}</Typography>
              <Box display="flex" justifyContent="space-between"><Typography variant="body2">{t('subtotal', 'Subtotal')}</Typography><Typography variant="body2">₹{selected.subtotal ?? selected.total ?? selected.amount ?? 0}</Typography></Box>
              <Box display="flex" justifyContent="space-between"><Typography variant="body2">{t('deliveryCharge', 'Delivery')}</Typography><Typography variant="body2">₹{selected.deliveryFee ?? selected.shipping ?? 0}</Typography></Box>
              <Box display="flex" justifyContent="space-between" sx={{ mt: 1, fontWeight: 700 }}><Typography variant="body2">{t('total', 'Total')}</Typography><Typography variant="body2">₹{selected.total ?? selected.amount ?? 0}</Typography></Box>

              {selected.userProfile && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('deliveryAddress', 'Shipping Address')}</Typography>
                  <Typography variant="body2">{selected.userProfile.fullName}</Typography>
                  <Typography variant="body2" color="text.secondary">{selected.userProfile.number}</Typography>
                  <Typography variant="body2" color="text.secondary">{selected.userProfile.address || (selected.address && selected.address.street)}</Typography>
                </>
              )}

              {(() => {
                const s = normalizeStatus(selected.status);
                const canCancel = s === 'pending' || s === 'processing';
                if (!canCancel) return null;
                return (
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Tooltip title="You can cancel before the order is shipped.">
                      <Button color="error" variant="outlined" size="small" onClick={() => { setCancelReason(''); setCancelOpen(true); }}>
                        {t('cancelOrder', 'Cancel Order')}
                      </Button>
                    </Tooltip>
                  </Box>
                );
              })()}

            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onClose={() => !savingCancel && setCancelOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Cancel Order</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please tell us why you are cancelling. This helps us improve.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            placeholder="Reason for cancellation"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={savingCancel} onClick={() => setCancelOpen(false)}>Close</Button>
          <Button
            color="error"
            variant="contained"
            disabled={savingCancel || !selected || !(normalizeStatus(selected.status) === 'pending' || normalizeStatus(selected.status) === 'processing')}
            onClick={async () => {
              setSavingCancel(true);
              try {
                // Double-check status eligibility
                const s = normalizeStatus(selected.status);
                if (!(s === 'pending' || s === 'processing')) {
                  setSavingCancel(false);
                  setCancelOpen(false);
                  return;
                }
                const updates = {
                  status: 'cancelled',
                  cancelReason: cancelReason?.trim() || null,
                  updatedAt: serverTimestamp(),
                };
                await updateOrderEverywhere(selected, updates);
                // reflect locally
                setOrders(prev => prev.map(o => (o.id === selected.id ? { ...o, status: 'cancelled', cancelReason: cancelReason?.trim() || null } : o)));
                setSelected(prev => prev ? { ...prev, status: 'cancelled', cancelReason: cancelReason?.trim() || null } : prev);
                // success snackbar
                setSnackMsg('Order cancelled successfully');
                setSnackSeverity('success');
                setSnackOpen(true);
              } catch (e) {
                console.error('Cancel order failed', e);
                setSnackMsg('Failed to cancel order. Please try again.');
                setSnackSeverity('error');
                setSnackOpen(true);
              } finally {
                setSavingCancel(false);
                setCancelOpen(false);
              }
            }}
          >
            {savingCancel ? 'Cancelling…' : 'Confirm Cancel'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={(_, reason) => { if (reason !== 'clickaway') setSnackOpen(false); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackOpen(false)} severity={snackSeverity} sx={{ width: '100%' }}>
          {snackMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Create a fetch function to be used by pull-to-refresh
const fetchOrders = async (user, setLoading, setError, setOrders, setSelected, location) => {
  if (!user) return;
  setLoading(true);
  setError(null);
  try {
    const results = [];

    // 1) Try user's subcollection: users/{uid}/orders (no-throw)
    try {
      const col = collection(db, 'users', user.uid, 'orders');
      const snap = await getDocs(query(col, orderBy('createdAt', 'desc')));
      snap.docs.forEach(d => results.push({ id: d.id, ref: d.ref, ...d.data() }));
    } catch (e) {
      console.debug('[Orders] users/{uid}/orders query failed', e?.message || e);
    }

    // 2) Fallbacks in top-level 'orders' collection using multiple potential identifiers
    if (results.length === 0) {
      const col = collection(db, 'orders');
      const attempts = [];
      attempts.push(async () => {
        try {
          const q = query(col, where('userProfile.uid', '==', user.uid), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          snap.docs.forEach(d => results.push({ id: d.id, ref: d.ref, ...d.data() }));
        } catch (e) { console.debug('[Orders] query userProfile.uid failed', e?.message || e); }
      });
      if (user.phoneNumber) attempts.push(async () => {
        try {
          const q = query(col, where('userProfile.number', '==', user.phoneNumber), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          snap.docs.forEach(d => results.push({ id: d.id, ref: d.ref, ...d.data() }));
        } catch (e) { console.debug('[Orders] query userProfile.number failed', e?.message || e); }
      });
      if (user.email) attempts.push(async () => {
        try {
          const q = query(col, where('userProfile.email', '==', user.email), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          snap.docs.forEach(d => results.push({ id: d.id, ref: d.ref, ...d.data() }));
        } catch (e) { console.debug('[Orders] query userProfile.email failed', e?.message || e); }
      });

      for (const fn of attempts) await fn();
    }

    // dedupe by id
    const dedup = [];
    const seen = new Set();
    for (const r of results) {
      if (!seen.has(r.id)) { seen.add(r.id); dedup.push(r); }
    }

    // sort by createdAt
    dedup.sort((a, b) => {
      const ta = a.createdAt?.seconds ?? (a.createdAt ? Date.parse(a.createdAt) / 1000 : 0);
      const tb = b.createdAt?.seconds ?? (b.createdAt ? Date.parse(b.createdAt) / 1000 : 0);
      return tb - ta;
    });

    setOrders(dedup);
    // if navigated with a highlight id, open that order after load
    const highlightId = location.state?.highlightOrderId;
    if (highlightId) {
      const found = dedup.find(o => o.id === highlightId || o.orderId === highlightId);
      if (found) setSelected(found);
    }
  } catch (err) {
    console.error('Failed to load orders', err);
    setError('Failed to load orders.');
  } finally {
    setLoading(false);
  }
};

const MyOrdersPageWithPullToRefresh = withPullToRefresh(MyOrdersPage, async () => {
  try {
    await fetchOrders(user, setLoading, setError, setOrders, setSelected, location);
  } catch (error) {
    console.error('Error refreshing orders:', error);
  }
});

export default MyOrdersPageWithPullToRefresh;
