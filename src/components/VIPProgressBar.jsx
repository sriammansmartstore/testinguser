import React, { useMemo, useState } from 'react';
import { Box, Typography, LinearProgress, Button, Dialog, DialogTitle, DialogContent, DialogActions, Chip, Stack, Slide } from '@mui/material';
import DiamondIcon from '@mui/icons-material/Diamond';
import StarIcon from '@mui/icons-material/Star';

// Local helpers (duplicated intentionally to avoid tight coupling)
const normalizeStatus = (s) => {
  if (!s) return 'pending';
  const v = String(s).trim().toLowerCase();
  if (v === 'in transist' || v === 'in-transit' || v === 'in_transit' || v === 'transit') return 'in transit';
  return v;
};

const rupee = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

const VIPProgressBar = ({ orders = [], threshold = 5000, compact = false }) => {
  const [open, setOpen] = useState(false);
  const Transition = React.useMemo(() =>
    React.forwardRef(function Transition(props, ref) {
      return <Slide direction="up" ref={ref} {...props} />;
    })
  , []);

  const deliveredTotal = useMemo(() => {
    try {
      return (orders || [])
        .filter((o) => normalizeStatus(o?.status) === 'delivered')
        .reduce((sum, o) => sum + (Number(o?.total ?? o?.amount ?? o?.subtotal ?? 0) || 0), 0);
    } catch (_) {
      return 0;
    }
  }, [orders]);

  const progress = Math.min(100, Math.round((deliveredTotal / threshold) * 100));
  const isVIP = deliveredTotal >= threshold;
  const remaining = Math.max(0, threshold - deliveredTotal);

  return (
    <Box sx={{
      position: 'relative',
      p: compact ? { xs: 1, sm: 1.25 } : { xs: 1.5, sm: 2 },
      borderRadius: 3,
      overflow: 'hidden',
      mb: compact ? 1.5 : 2.5,
      boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
      border: '1px solid rgba(255,255,255,0.15)',
      background: isVIP
        ? 'linear-gradient(135deg, #2e7d32 0%, #00c853 60%, #b2ff59 100%)'
        : 'linear-gradient(135deg, #1a237e 0%, #3949ab 60%, #7c4dff 100%)',
      color: 'white',
    }}>
      {/* Glow accents */}
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <Box sx={{ position: 'absolute', width: 180, height: 180, filter: 'blur(60px)', opacity: 0.35, borderRadius: '50%', bgcolor: 'white', top: -50, left: -30 }} />
        <Box sx={{ position: 'absolute', width: 140, height: 140, filter: 'blur(60px)', opacity: 0.25, borderRadius: '50%', bgcolor: 'white', bottom: -40, right: -20 }} />
      </Box>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: compact ? 0.5 : 1 }}>
        <DiamondIcon sx={{ color: 'gold', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))', fontSize: compact ? 18 : undefined }} />
        <Typography variant={compact ? 'subtitle2' : 'subtitle1'} sx={{ fontWeight: 800, letterSpacing: 0.3 }}>
          VIP Progress
        </Typography>
        {isVIP ? (
          <Chip size="small" color="success" variant="filled" icon={<StarIcon />} label="VIP Unlocked" sx={{ ml: 1, fontWeight: 700 }} />
        ) : (
          <Chip size="small" color="warning" variant="filled" label={`Goal: ${rupee(threshold)}`} sx={{ ml: 1, fontWeight: 700 }} />
        )}
      </Box>

      {/* Summary line */}
      <Typography variant="body2" sx={{ opacity: 0.95, mb: compact ? 0.75 : 1 }}>
        {isVIP
          ? `You're a VIP! Total delivered: ${rupee(deliveredTotal)}`
          : `Total from delivered orders: ${rupee(deliveredTotal)}`}
      </Typography>

      {/* Progress bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: compact ? 8 : 12,
              borderRadius: 999,
              bgcolor: 'rgba(255,255,255,0.25)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 999,
                background: isVIP
                  ? 'linear-gradient(90deg, #fff176, #ffd54f, #ffb300)'
                  : 'linear-gradient(90deg, #81d4fa, #b388ff, #f48fb1)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
              },
            }}
          />
        </Box>
        <Typography variant="body2" sx={{ width: compact ? 40 : 44, textAlign: 'right', fontWeight: 700, fontSize: compact ? '0.78rem' : undefined }}>{progress}%</Typography>
      </Box>

      {/* Actions */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: compact ? 0.75 : 1.5 }}>
        <Button
          size="small"
          variant="contained"
          onClick={() => setOpen(true)}
          sx={{
            bgcolor: 'rgba(255,255,255,0.15)',
            color: 'white',
            borderRadius: 999,
            textTransform: 'none',
            fontWeight: 700,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
            boxShadow: 'none',
          }}
        >
          See VIP Benefits
        </Button>
        {!isVIP && (
          <Chip size="small" label={`Spend ${rupee(remaining)} more`} sx={{ fontWeight: 700, bgcolor: 'rgba(0,0,0,0.2)', color: 'white', fontSize: compact ? '0.75rem' : undefined }} />
        )}
      </Stack>

      {/* Benefits Modal */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="xs"
        TransitionComponent={Transition}
        sx={{ zIndex: (t) => t.zIndex.modal + 2 }}
        BackdropProps={{
          sx: {
            background: 'rgba(10, 14, 23, 0.5)',
            backdropFilter: 'blur(6px)'
          }
        }}
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            mt: { xs: '56px', sm: '64px' }, // below app bar
            mb: { xs: '80px', sm: '96px' }, // above bottom nav
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)'
          }
        }}
      >
        <DialogTitle sx={{
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          background: 'linear-gradient(135deg, #1a237e 0%, #7c4dff 100%)',
          color: 'white',
          py: 1.5,
        }}>
          <DiamondIcon color="primary" /> VIP Benefits
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: 'background.paper' }}>
          <Box>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Unlock exclusive perks when your delivered orders cross {rupee(threshold)}.
            </Typography>
            <Stack spacing={1.25}>
              <BenefitItem title="Free Delivery" desc="Enjoy free delivery on all your future orders as a VIP." />
              <BenefitItem title="VIP Pricing on All Products" desc="Get special VIP prices across the catalog—no coupon needed." />
              <BenefitItem title="24-Hour Fast Delivery" desc="Orders are prioritized to reach you within 24 hours (where available)." />
              <BenefitItem title="Priority Support" desc="Get faster assistance for your orders and queries." />
              <BenefitItem title="Exclusive Offers" desc="Access VIP-only discounts and seasonal deals." />
              <BenefitItem title="Early Access" desc="Be the first to try new products and features." />
              <BenefitItem title="Special Gifts" desc="Surprise goodies with select purchases." />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: 'background.paper' }}>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const BenefitItem = ({ title, desc }) => (
  <Box sx={{
    p: 1.25,
    borderRadius: 2,
    bgcolor: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(0,0,0,0.06)'
  }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <StarIcon sx={{ color: '#ffb300' }} /> {title}
    </Typography>
    <Typography variant="body2" color="text.secondary">{desc}</Typography>
  </Box>
);

export default VIPProgressBar;
