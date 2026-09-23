import React, { useEffect, useState, useContext } from 'react';
import { 
  Box, Typography, Chip, Button, Divider, List, ListItem, ListItemText, 
  Alert, TextField, Dialog, DialogTitle, DialogContent, DialogActions, 
  CircularProgress, IconButton, Paper, Stack
} from '@mui/material';
import { 
  Fade, 
  Slide,
  Zoom 
} from '@mui/material';
import {
  LocalShipping,
  Payment,
  LocationOn,
  ArrowBack,
  CheckCircle,
  Schedule,
  Inventory,
  LocalShippingOutlined,
  AssignmentTurnedIn,
  Cancel,
  Replay,
  Download,
  Receipt
} from '@mui/icons-material';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { rupee } from '../utils/currency';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';

// --- Enhanced Utility Functions ---
const formatDate = (d) => {
  let dateObj = null;
  if (d && typeof d.toDate === 'function') dateObj = d.toDate();
  else if (d && d.seconds) dateObj = new Date(d.seconds * 1000);
  else if (typeof d === 'string') dateObj = new Date(d);
  else if (d instanceof Date) dateObj = d;
  else return String(d);
  try {
    return dateObj.toLocaleString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } catch (e) {
    return dateObj.toString();
  }
};

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

const statusIcons = {
  'pending': Schedule,
  'processing': Inventory,
  'packed': AssignmentTurnedIn,
  'in transit': LocalShippingOutlined,
  'delivered': CheckCircle,
  'cancelled': Cancel,
  'returned': Replay
};

const statusLabels = {
  'pending': 'Order Placed',
  'processing': 'Processing',
  'packed': 'Packed',
  'in transit': 'In Transit',
  'delivered': 'Delivered',
  'cancelled': 'Cancelled',
  'returned': 'Returned'
};

const OrderStatusChip = ({ status }) => (
  <Chip 
    label={statusLabels[normalizeStatus(status)] || status} 
    color={statusColor(status)} 
    size="small"
    sx={{ fontWeight: 600 }}
  />
);

// Modern Track Order Component
const TrackOrderProgress = ({ status, order }) => {
  const currentStatus = normalizeStatus(status);
  const steps = ['pending', 'processing', 'packed', 'in transit', 'delivered'];
  const currentIndex = steps.indexOf(currentStatus);
  
  // Sharp dark colors for icons and line
  const iconBgColors = {
    'pending': '#1e293b', // dark blue
    'processing': '#7c2d12', // dark orange
    'packed': '#14532d', // dark green
    'in transit': '#3b0764', // dark purple
    'delivered': '#0f172a', // darkest
  };

  return (
    <Box sx={{ width: '100%', py: 1 }}>
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        position: 'relative',
        minHeight: 180,
        px: 3,
        background: '#fff',
        borderRadius: 2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        border: '1px solid #f3f4f6',
        maxWidth: 320,
        margin: '0 auto'
      }}>
        {steps.map((step, index) => {
          const IconComponent = statusIcons[step];
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === steps.length - 1;
          
          return (
            <Box key={step} sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              my: 2,
              position: 'relative',
              zIndex: 2,
              width: '100%',
              minHeight: 40
            }}>
              {/* Icon */}
              <Box sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: isCompleted ? iconBgColors[step] : '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isCompleted ? 'white' : '#94a3b8',
                border: isCurrent ? '2px solid #111' : 'none',
                boxShadow: isCurrent ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.3s ease',
                position: 'relative',
                ml: 2,
                zIndex: 2
              }}>
                <IconComponent sx={{ fontSize: 18 }} />
              </Box>

              {/* Text */}
              <Box sx={{ flex: 1, ml: 3 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? '#111' : '#94a3b8',
                    whiteSpace: 'nowrap',
                    fontSize: 13,
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {statusLabels[step]}
                </Typography>
                {/* per-step notes (below each step label) */}
                {(order && ({
                  'pending': order.pendingNotes,
                  'processing': order.processingNotes,
                  'packed': order.packedNotes,
                  'in transit': order.inTransitNotes,
                  'delivered': order.deliveredNotes
                }[step])) && (
                  <Typography variant="caption" sx={{ color: isCurrent ? '#0f172a' : '#94a3b8', display: 'block', mt: 0.25, fontSize: 11, lineHeight: 1.3 }}>
                    {({ 'pending': order.pendingNotes, 'processing': order.processingNotes, 'packed': order.packedNotes, 'in transit': order.inTransitNotes, 'delivered': order.deliveredNotes }[step])}
                  </Typography>
                )}
                {(order && ({ 'pending': order.createdAt, 'in transit': order.inTransitAt, 'delivered': order.deliveredAt }[step])) && (
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.25, fontSize: 10 }}>
                    {formatDate(({ 'pending': order.createdAt, 'in transit': order.inTransitAt, 'delivered': order.deliveredAt }[step]))}
                  </Typography>
                )}
                {isCurrent && order?.estimatedDelivery && (
                  <Typography variant="caption" sx={{ 
                    color: '#1e293b', 
                    fontWeight: 600, 
                    mt: 0.5,
                    display: 'block' 
                  }}>
                    Est. {formatDate(order.estimatedDelivery).split(',')[0]}
                  </Typography>
                )}
              </Box>

              {/* Progress Line */}
              {!isLast && (
                <Box sx={{
                  position: 'absolute',
                  left: '48px', // Aligned with the center of the icon
                  top: '50%',
                  height: '100%',
                  width: '2px',
                  background: isCompleted ? '#1e293b' : '#e5e7eb',
                  transform: 'translateY(20px)', // Adjusts the line to connect with the next icon
                  zIndex: 1
                }} />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

const COMPANY_DETAILS = {
  name: 'Sri Amman Smart Store',
  address: '123 Main Street, Chennai, Tamil Nadu 600001',
  phone: '+91 98765 43210',
  email: 'contact@sriammanstore.com',
  website: 'www.sriammanstore.com',
  gst: 'GSTIN: 33ABCDE1234F1Z5',
  logo: '/logo.png' // Make sure this path is correct
};

const OrderDetailsPage = () => {
  const { user } = useContext(AuthContext) || {};
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [savingCancel, setSavingCancel] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnProduct, setReturnProduct] = useState(null);
  const [savingReturn, setSavingReturn] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const generateInvoice = async () => {
    try {
      setGeneratingInvoice(true);
      const doc = new jsPDF();
      
      // Set font
      doc.setFont('helvetica');
      
      // Add logo safely
      try {
        const img = new Image();
        img.src = COMPANY_DETAILS.logo;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        if (img.complete && img.naturalWidth > 0) {
          const logoWidth = 40;
          doc.addImage(img, 'PNG', 15, 15, logoWidth, logoWidth * 0.75);
        }
      } catch (imgErr) {
        console.warn('Failed to add logo to invoice:', imgErr);
      }
      
      // Company details (right aligned)
      doc.setFontSize(20);
      doc.setTextColor(33, 33, 33);
      doc.text('TAX INVOICE', 195, 25, { align: 'right' });
      
      // Company details (left side)
      doc.setFontSize(14);
      doc.text(COMPANY_DETAILS.name, 15, 50);
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const companyDetails = [
        COMPANY_DETAILS.address,
        COMPANY_DETAILS.phone,
        COMPANY_DETAILS.email,
        COMPANY_DETAILS.website,
        COMPANY_DETAILS.gst
      ];
      companyDetails.forEach((line, i) => {
        doc.text(line, 15, 60 + (i * 5));
      });

      // Order details
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(245, 245, 245);
      doc.rect(15, 90, 180, 25, 'F');
      
      doc.setFontSize(11);
      doc.setTextColor(33, 33, 33);
      const orderDate = formatDate(order.createdAt);
      const orderDetails = [
        ['Order ID:', `#${order.orderId || order.id}`, 'Date:', orderDate],
        ['Status:', normalizeStatus(order.status).toUpperCase(), 'Payment:', order.paymentMethod || order.payment?.method || 'N/A']
      ];
      
      orderDetails.forEach((row, i) => {
        doc.text(row[0], 20, 100 + (i * 10));
        doc.text(row[1], 45, 100 + (i * 10));
        doc.text(row[2], 120, 100 + (i * 10));
        doc.text(row[3], 145, 100 + (i * 10));
      });

      // Customer details
      if (order.userProfile) {
        doc.setFontSize(12);
        doc.setTextColor(33, 33, 33);
        doc.text('Bill To:', 15, 130);
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        const customerDetails = [
          order.userProfile.fullName,
          order.userProfile.number,
          order.userProfile.address || (order.address && order.address.street)
        ].filter(Boolean);
        customerDetails.forEach((line, i) => {
          doc.text(line, 15, 140 + (i * 5));
        });
      }

      // Currency formatter for PDF (avoiding Unicode symbol issues in standard Helvetica font)
      const formatCurrencyPDF = (val) => {
        const num = Number(val || 0);
        return `Rs. ${num.toLocaleString('en-IN')}`;
      };

      // Items table
      const items = order.items || order.cartItems || [];
      const tableHeaders = [['Item', 'Quantity', 'Unit Price', 'Total']];
      const tableData = items.map(item => [
        item.name || item.product?.name || item.productName,
        `${item.quantity || item.qty || 1} ${item.unit || ''}`.trim(),
        `${formatCurrencyPDF(item.sellingPrice || item.price || '')}`,
        `${formatCurrencyPDF((item.sellingPrice || item.price || 0) * (item.quantity || item.qty || 1))}`
      ]);

      autoTable(doc, {
        startY: 160,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 10,
          cellPadding: 5
        }
      });

      // Summary
      const finalY = doc.lastAutoTable.finalY + 10;
      const summaryX = 130;
        // derive values to print on invoice (prefer persisted fields)
        const itemsForCalc = order.items || order.cartItems || [];
        const computedItemsTotalForPdf = itemsForCalc.reduce((s, it) => {
          const price = Number(it.sellingPrice ?? it.price ?? it.total ?? 0) || 0;
          const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
          return s + price * qty;
        }, 0);
        const pdfSubtotal = Number(order.subtotal ?? computedItemsTotalForPdf ?? order.total ?? order.amount ?? 0);
        const pdfDelivery = Number(order.deliveryFee ?? order.shipping ?? 0);
        const pdfTotal = Number(order.total ?? order.amount ?? 0);
        const pdfDiscount = Number(order.discount ?? Math.max(0, pdfSubtotal - Math.max(0, pdfTotal - pdfDelivery))) || 0;

        const summaryItems = [
          ['Subtotal:', `${formatCurrencyPDF(pdfSubtotal)}`],
          ...(pdfDiscount > 0 ? [['Discount:', `- ${formatCurrencyPDF(pdfDiscount)}`]] : []),
          ['Delivery Fee:', `${formatCurrencyPDF(pdfDelivery)}`],
          ['Total:', `${formatCurrencyPDF(pdfTotal)}`]
        ];

      summaryItems.forEach((item, i) => {
        const isTotal = i === summaryItems.length - 1;
        if (isTotal) {
          doc.setFontSize(12);
          doc.setTextColor(33, 33, 33);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFontSize(10);
          doc.setTextColor(80, 80, 80);
          doc.setFont('helvetica', 'normal');
        }
        doc.text(item[0], summaryX, finalY + (i * 7));
        doc.text(item[1], 195, finalY + (i * 7), { align: 'right' });
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text('This is a computer-generated document. No signature is required.', 195, 280, { align: 'right' });

      // Save the PDF
      doc.save(`Invoice-${order.orderId || order.id}.pdf`);
    } catch (err) {
      console.error('Error generating invoice:', err);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handleBack = () => {
    navigate('/orders', { replace: true });
  };

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      setError(null);
      try {
        let found = null;
        if (user?.uid) {
          try {
            const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
            const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
            const userCol = collection(db, 'users', userDocId, 'orders');
            const qUser = query(userCol, where('orderId', '==', orderId));
            const snapUser = await getDocs(qUser);
            if (!snapUser.empty) found = { id: snapUser.docs[0].id, ref: snapUser.docs[0].ref, ...snapUser.docs[0].data() };
          } catch (_) {}
        }
        if (!found) {
          const topCol = collection(db, 'orders');
          const qTop = query(topCol, where('orderId', '==', orderId));
          const snapTop = await getDocs(qTop);
          if (!snapTop.empty) found = { id: snapTop.docs[0].id, ref: snapTop.docs[0].ref, ...snapTop.docs[0].data() };
        }
        setOrder(found);
      } catch (err) {
        setError('Failed to load order.');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId, user]);

  const updateOrderEverywhere = async (order, updates) => {
    const tasks = [];
    if (order?.ref) tasks.push(updateDoc(order.ref, updates));
    const orderId = order?.orderId || order?.id;
    if (!orderId) {
      await Promise.allSettled(tasks);
      return;
    }
    try {
      const topCol = collection(db, 'orders');
      const qTop = query(topCol, where('orderId', '==', orderId));
      const snapTop = await getDocs(qTop);
      if (!snapTop.empty) {
        snapTop.forEach(d => tasks.push(updateDoc(d.ref, updates)));
      }
    } catch (_) {}
    try {
      if (user?.uid) {
        const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
        const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
        const userCol = collection(db, 'users', userDocId, 'orders');
        const qUser = query(userCol, where('orderId', '==', orderId));
        const snapUser = await getDocs(qUser);
        if (!snapUser.empty) {
          snapUser.forEach(d => tasks.push(updateDoc(d.ref, updates)));
        }
      }
    } catch (_) {}
    await Promise.allSettled(tasks);
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress size={40} />
    </Box>
  );
  
  if (error || !order) return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Alert severity="error" sx={{ maxWidth: 400, mx: 'auto' }}>
        {error || 'Order not found.'}
      </Alert>
    </Box>
  );

  const currentStatus = normalizeStatus(order.status);
  const canCancel = ['pending', 'processing'].includes(currentStatus);
  const canReturn = currentStatus === 'delivered';

  // Prefer explicit persisted fields (subtotal, discount, deliveryFee, total).
  // Fall back to legacy fields or computed values when missing.
  const items = order.items || order.cartItems || [];
  const computedItemsTotal = items.reduce((sum, it) => {
    const price = Number(it.sellingPrice ?? it.price ?? it.total ?? 0) || 0;
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    return sum + price * qty;
  }, 0);

  const subtotal = Number(order.subtotal ?? computedItemsTotal ?? order.total ?? order.amount ?? 0);
  const deliveryFee = Number(order.deliveryFee ?? order.shipping ?? 0);
  // Prefer persisted total when it's > 0, otherwise compute from components
  const persistedTotal = Number(order.total ?? order.amount ?? 0);

  // Determine discount:
  // 1) use persisted order.discount if present
  // 2) else, if order.promo exists, compute from promo: percentage -> Math.round(subtotal * pct / 100), rupee -> clamp to subtotal
  // 3) else, derive from subtotal and persistedTotal if possible
  let discount = 0;
  if (typeof order.discount === 'number' && !Number.isNaN(order.discount)) {
    discount = Number(order.discount) || 0;
  } else if (order.promo && typeof order.promo === 'object') {
    const promo = order.promo;
    const pType = String(promo.type || promo.raw?.type || '').toLowerCase();
    const pAmount = Number(promo.amount ?? promo.raw?.amount ?? 0) || 0;
    if (pType === 'percentage') {
      discount = Math.round((subtotal * pAmount) / 100);
    } else {
      // rupee type or unknown — treat as rupee
      discount = Math.min(pAmount, subtotal);
    }
    // ensure non-negative
    discount = Math.max(0, discount);
  } else if (persistedTotal > 0) {
    // deduce discount from subtotal, delivery and persisted total
    discount = Math.max(0, subtotal - Math.max(0, persistedTotal - deliveryFee));
  } else {
    discount = 0;
  }

  // Compute totals:
  const itemsTotalAfterDiscount = Math.max(0, subtotal - discount);
  // Prefer persisted total when it's > 0, otherwise compute grand total as items after discount + delivery
  const grandTotal = persistedTotal > 0 ? persistedTotal : Math.max(0, itemsTotalAfterDiscount + deliveryFee);

  // Expose promo display-friendly info
  const promoDisplay = order.promo && typeof order.promo === 'object' ? {
    code: order.promo.code || order.promo.raw?.code,
    type: (order.promo.type || order.promo.raw?.type || '').toLowerCase(),
    amount: Number(order.promo.amount ?? order.promo.raw?.amount ?? 0) || 0
  } : null;

  return (
    <Fade in={true} timeout={500}>
      <Box sx={{
        minHeight: '100vh',
        background: '#f8fafc'
      }}>
        {/* Header */}
        <Paper sx={{
          background: 'white',
          borderRadius: 0,
          width: '100%',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
          {/* Top Bar */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            px: 2, 
            py: 1.5,
            borderBottom: '1px solid #f1f5f9'
          }}>
            <IconButton 
              onClick={handleBack} 
              size="small"
              sx={{ mr: 2 }}
            >
              <ArrowBack fontSize="small" />
            </IconButton>
            <Typography variant="subtitle1" sx={{ 
              fontWeight: 600, 
              flex: 1,
              fontSize: '1rem'
            }}>
              Order Details
            </Typography>
            <OrderStatusChip status={order.status} />
          </Box>

          {/* Order Info */}
          <Box sx={{ px: 2, py: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box flex={1}>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5 }}>
                  #{order.orderId || order.id}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  {formatDate(order.createdAt)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ 
                  fontWeight: 700, 
                  color: '#1e293b',
                  fontSize: '1.125rem'
                }}>
                  {rupee(grandTotal)}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Paper>

        {/* Main Content */}
        <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 0, sm: 3 } }}>
          <Stack spacing={{ xs: 1, sm: 3 }}>
            {/* Track Order Section */}
            <Paper sx={{ 
              p: { xs: 2, sm: 3 }, 
              background: 'white', 
              borderRadius: { xs: 0, sm: 2 },
              boxShadow: { xs: 'none', sm: '0 1px 3px rgba(0,0,0,0.1)' },
              borderBottom: { xs: '1px solid #f1f5f9', sm: 'none' }
            }}>
              <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                <LocalShipping sx={{ color: '#3b82f6', mr: 1.5, fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                  Track Your Order
                </Typography>
              </Box>
                {/* Order notes and delivery/timestamps from Firestore */}
  <Box sx={{ mt: -1, mb: 2 }}>
   {order.deliveryMethod && (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
    <LocalShipping sx={{ fontSize: 16, color: 'primary.main' }} />
    <Chip
      label={order.deliveryMethod}
      size="small"
      variant="outlined"
      sx={{
        borderRadius: 1,
        borderColor: 'primary.100',
        backgroundColor: 'primary.50',
        color: 'primary.700',
        fontWeight: 600,
        fontSize: '0.75rem',
        height: 24
      }}
    />
  </Box>
)}
  </Box>
  <TrackOrderProgress status={order.status} order={order} />
              
              {currentStatus === 'in transit' && order.trackingNumber && (
                <Alert 
                  severity="info" 
                  sx={{ 
                    mt: 2,
                    borderRadius: 1,
                    '& .MuiAlert-message': { width: '100%' }
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                      Tracking ID
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>
                      {order.trackingNumber}
                    </Typography>
                  </Box>
                </Alert>
              )}
            </Paper>

            {/* Items List */}
            <Paper sx={{ 
              background: 'white', 
              borderRadius: { xs: 0, sm: 2 },
              boxShadow: { xs: 'none', sm: '0 1px 3px rgba(0,0,0,0.1)' },
              borderBottom: { xs: '1px solid #f1f5f9', sm: 'none' }
            }}>
              <Box sx={{ p: { xs: 2, sm: 3 }, borderBottom: '1px solid #f1f5f9' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                  Items ({(order.items || order.cartItems || []).length})
                </Typography>
              </Box>
              <List disablePadding>
                {(order.items || order.cartItems || []).map((it, idx) => (
                  <ListItem 
                    key={idx} 
                    sx={{ 
                      py: 2,
                      px: { xs: 2, sm: 3 },
                      borderBottom: idx !== (order.items || order.cartItems || []).length - 1 ? '1px solid #f8fafc' : 'none'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Box sx={{ 
                        width: 56, 
                        height: 56, 
                        background: '#f8fafc', 
                        borderRadius: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 2
                      }}>
                        <Inventory sx={{ color: '#64748b', fontSize: 24 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            fontWeight: 500,
                            color: '#1e293b',
                            mb: 0.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {it.name || it.product?.name || it.productName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {it.unitSize ? `${it.unitSize} ${it.unit} Ã— ${it.quantity || it.qty || 1}` : `Qty: ${it.quantity || it.qty || 1}`}
                        </Typography>
                      </Box>
                        <Typography variant="subtitle2" sx={{ 
                        fontWeight: 600,
                        color: '#1e293b',
                        ml: 2,
                        whiteSpace: 'nowrap'
                      }}>
                        {rupee(it.sellingPrice || it.price || it.total || '')}
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </Paper>

            {/* Order Information Grid */}
            <Box sx={{ 
              display: 'grid', 
              gap: { xs: 1, sm: 3 }, 
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } 
            }}>
              {/* Payment Summary */}
              <Paper sx={{ 
                background: 'white', 
                borderRadius: { xs: 0, sm: 2 },
                boxShadow: { xs: 'none', sm: '0 1px 3px rgba(0,0,0,0.1)' },
                borderBottom: { xs: '1px solid #f1f5f9', sm: 'none' },
                overflow: 'hidden'
              }}>
                <Box sx={{ p: { xs: 2, sm: 3 }, borderBottom: '1px solid #f1f5f9' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Payment sx={{ color: '#10b981', mr: 1.5, fontSize: 20 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                      Payment Details
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ p: { xs: 2, sm: 3 } }}>
                  <Stack spacing={2}>
                    {/* 1) Subtotal */}
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ color: '#64748b' }}>Subtotal</Typography>
                      <Typography variant="body2" sx={{ color: '#1e293b' }}>
                        {rupee(subtotal)}
                      </Typography>
                    </Box>

                    {/* 2) Discount (show promo code and negative amount) */}
                    {discount > 0 && (
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" sx={{ color: '#64748b' }}>{promoDisplay && promoDisplay.code ? `Discount (Promo ${promoDisplay.code})` : 'Discount'}</Typography>
                        <Typography variant="body2" sx={{ color: '#1e293b' }}>
                          -{rupee(discount)}
                        </Typography>
                      </Box>
                    )}

                    {/* 3) Total after discount (items total) */}
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ color: '#64748b' }}>Total</Typography>
                      <Typography variant="body2" sx={{ color: '#1e293b' }}>
                        {rupee(itemsTotalAfterDiscount)}
                      </Typography>
                    </Box>

                    {/* 4) Delivery Fee */}
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ color: '#64748b' }}>Delivery Fee</Typography>
                      <Typography variant="body2" sx={{ color: '#1e293b' }}>
                        {rupee(deliveryFee)}
                      </Typography>
                    </Box>

                    <Divider />

                    {/* 5) Grand Total */}
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                        Grand Total
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                        {rupee(grandTotal)}
                      </Typography>
                    </Box>
                    <Box 
                      sx={{ 
                        mt: 1,
                        p: 1.5,
                        background: '#f8fafc',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Payment Method
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        color: '#1e293b',
                        fontWeight: 600,
                        textTransform: 'capitalize'
                      }}>
                        {order.paymentMethod || order.payment?.method || 'N/A'}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Paper>

              {/* Shipping Address */}
              {order.userProfile && (
                <Paper sx={{ 
                  background: 'white', 
                  borderRadius: { xs: 0, sm: 2 },
                  boxShadow: { xs: 'none', sm: '0 1px 3px rgba(0,0,0,0.1)' },
                  borderBottom: { xs: '1px solid #f1f5f9', sm: 'none' },
                  overflow: 'hidden'
                }}>
                  <Box sx={{ p: { xs: 2, sm: 3 }, borderBottom: '1px solid #f1f5f9' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <LocationOn sx={{ color: '#ef4444', mr: 1.5, fontSize: 20 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                        Delivery Address
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ p: { xs: 2, sm: 3 } }}>
                    <Typography variant="subtitle2" sx={{ 
                      fontWeight: 600,
                      color: '#1e293b',
                      mb: 1
                    }}>
                      {order.userProfile.fullName}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: '#64748b',
                      mb: 0.5,
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {order.userProfile.number}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: '#64748b',
                      lineHeight: 1.5
                    }}>
                      {order.userProfile.address || (order.address && order.address.street)}
                    </Typography>
                  </Box>
                </Paper>
              )}
            </Box>

            {/* Action Buttons */}
            <Paper sx={{ 
              background: 'white',
              borderRadius: { xs: 0, sm: 2 },
              boxShadow: { xs: 'none', sm: '0 1px 3px rgba(0,0,0,0.1)' },
              overflow: 'hidden',
              mt: { xs: 2, sm: 3 }
            }}>
              <Box sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack 
                  spacing={2}
                  sx={{
                    '& .MuiButton-root': {
                      py: 1,
                      borderRadius: 1.5
                    }
                  }}
                >
                  {/* Cancel/Return Buttons Row */}
                  {(canCancel || canReturn) && (
                    <Stack 
                      direction="row" 
                      spacing={2}
                      sx={{
                        '& .MuiButton-root': {
                          flex: 1
                        }
                      }}
                    >
                      {canCancel && (
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<Cancel />}
                          onClick={() => setCancelOpen(true)}
                          sx={{ fontWeight: 600 }}
                        >
                          Cancel Order
                        </Button>
                      )}
                      {canReturn && (
                        <Button
                          variant="outlined"
                          color="warning"
                          startIcon={<Replay />}
                          onClick={() => setReturnOpen(true)}
                          sx={{ fontWeight: 600 }}
                        >
                          Return Order
                        </Button>
                      )}
                    </Stack>
                  )}
                  
                  {/* Invoice Download Button - Only show for delivered orders */}
                  {currentStatus === 'delivered' && (
                    <Button
                      variant="outlined"
                      color="primary"
                      fullWidth
                      startIcon={<Receipt />}
                      onClick={generateInvoice}
                      disabled={generatingInvoice}
                      sx={{ 
                        fontWeight: 600,
                        borderColor: '#3b82f6',
                        color: '#3b82f6',
                        '&:hover': {
                          borderColor: '#2563eb',
                          backgroundColor: 'rgba(59, 130, 246, 0.04)'
                        }
                      }}
                    >
                      {generatingInvoice ? 'Generating Invoice...' : 'Download Invoice'}
                    </Button>
                  )}
                </Stack>
              </Box>
            </Paper>

            {/* Status Alerts */}
            {(currentStatus === 'cancelled' || currentStatus === 'returned') && (
              <Box sx={{ px: { xs: 2, sm: 0 }, pb: { xs: 2, sm: 0 } }}>
                {currentStatus === 'cancelled' && order.cancelReason && (
                  <Alert 
                    severity="error" 
                    sx={{ 
                      borderRadius: { xs: 1.5, sm: 2 },
                      '& .MuiAlert-message': { width: '100%' }
                    }}
                  >
                    <Box>
                      <Typography variant="caption" sx={{ 
                        display: 'block',
                        color: '#ef4444',
                        fontWeight: 600,
                        mb: 0.5
                      }}>
                        Order Cancelled
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#991b1b' }}>
                        {order.cancelReason}
                      </Typography>
                    </Box>
                  </Alert>
                )}
                {currentStatus === 'returned' && order.returnReason && (
                  <Alert 
                    severity="warning"
                    sx={{ 
                      borderRadius: { xs: 1.5, sm: 2 },
                      '& .MuiAlert-message': { width: '100%' }
                    }}
                  >
                    <Box>
                      <Typography variant="caption" sx={{ 
                        display: 'block',
                        color: '#d97706',
                        fontWeight: 600,
                        mb: 0.5
                      }}>
                        Order Returned
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#92400e' }}>
                        {order.returnReason}
                      </Typography>
                    </Box>
                  </Alert>
                )}
              </Box>
            )}
          </Stack>
        </Box>

        {/* Cancel Dialog */}
        <Dialog 
          open={cancelOpen} 
          onClose={() => !savingCancel && setCancelOpen(false)} 
          fullWidth 
          maxWidth="sm"
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ fontWeight: 700, color: '#1e293b' }}>Cancel Order</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please tell us why you're cancelling this order. This helps us improve our service.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={3}
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              sx={{ borderRadius: 2 }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button 
              disabled={savingCancel} 
              onClick={() => setCancelOpen(false)}
              sx={{ borderRadius: 2 }}
            >
              Close
            </Button>
            <Button
              color="error"
              variant="contained"
              disabled={savingCancel || !cancelReason.trim()}
              onClick={async () => {
                setSavingCancel(true);
                try {
                  const updates = {
                    status: 'cancelled',
                    cancelReason: cancelReason.trim(),
                    updatedAt: serverTimestamp(),
                  };
                  await updateOrderEverywhere(order, updates);
                  setOrder(prev => prev ? { ...prev, ...updates } : prev);
                } catch (e) {
                  setError('Failed to cancel order.');
                } finally {
                  setSavingCancel(false);
                  setCancelOpen(false);
                }
              }}
              sx={{ borderRadius: 2, fontWeight: 600 }}
            >
              {savingCancel ? <CircularProgress size={20} /> : 'Confirm Cancellation'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Return Dialog */}
        <Dialog 
          open={returnOpen} 
          onClose={() => !savingReturn && setReturnOpen(false)} 
          fullWidth 
          maxWidth="sm"
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ fontWeight: 700, color: '#1e293b' }}>
            {returnProduct ? `Return Product` : `Return Order`}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please tell us why you want to return {returnProduct ? `this product` : `your order`}.
            </Typography>
            {returnProduct && (
              <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                <Typography variant="body2" fontWeight={600}>
                  {returnProduct.name || returnProduct.productName} 
                  {returnProduct.unitSize && ` (${returnProduct.unitSize} ${returnProduct.unit})`}
                </Typography>
              </Alert>
            )}
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={3}
              placeholder="Reason for return..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              sx={{ borderRadius: 2 }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button 
              disabled={savingReturn} 
              onClick={() => setReturnOpen(false)}
              sx={{ borderRadius: 2 }}
            >
              Close
            </Button>
            <Button
              color="warning"
              variant="contained"
              disabled={savingReturn || !returnReason.trim()}
              onClick={async () => {
                setSavingReturn(true);
                try {
                  let updates = {};
                  if (returnProduct) {
                    updates = {
                      returnedProducts: [ ...(order.returnedProducts || []), {
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
                  await updateOrderEverywhere(order, updates);
                  setOrder(prev => prev ? { ...prev, ...updates } : prev);
                } catch (e) {
                  setError('Failed to request return.');
                } finally {
                  setSavingReturn(false);
                  setReturnOpen(false);
                }
              }}
              sx={{ borderRadius: 2, fontWeight: 600 }}
            >
              {savingReturn ? <CircularProgress size={20} /> : 'Submit Return Request'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default OrderDetailsPage;

