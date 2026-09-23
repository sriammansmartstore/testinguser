import React from 'react';
import { Box, Card, CardContent, Typography, RadioGroup, FormControlLabel, Radio, Chip, LinearProgress, Stack, Button } from '@mui/material';
import { useLanguage } from '../../context/LanguageContext';

const DeliveryOptionsCard = ({ orderTotal = 0 }) => {
  const { t } = useLanguage();
  const [option, setOption] = React.useState(() => {
    try { return localStorage.getItem('deliveryOption') || 'standard'; } catch (_) { return 'standard'; }
  });

  const handleChange = (e) => {
    const val = e.target.value;
    if (!val) return;
    setOption(val);
    try { localStorage.setItem('deliveryOption', val); } catch (_) {}
    // Notify other components (same tab) that option changed
    window.dispatchEvent(new CustomEvent('deliveryOptionChanged', { detail: { option: val } }));
  };

  const standardThreshold = 500;
  const expressThreshold = 2000;
  const total = Number(orderTotal || 0);
  const remainingForStandard = Math.max(0, standardThreshold - total);
  const remainingForExpress = Math.max(0, expressThreshold - total);

  // Determine next tier and progress toward it
  const nextTier = total < standardThreshold ? 'standard' : (total < expressThreshold ? 'express' : null);
  const progressPct = (() => {
    if (!nextTier) return 100;
    if (nextTier === 'standard') return Math.min(100, Math.round((total / standardThreshold) * 100));
    // progress from standard to express
    const span = expressThreshold - standardThreshold;
    const val = Math.max(0, total - standardThreshold);
    return Math.min(100, Math.round((val / span) * 100));
  })();

  return (
    <Card sx={{ borderRadius: { xs: 0, sm: 2 }, boxShadow: { xs: 'none', sm: 2 }, mt: 1 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{t('deliveryOptions', 'Delivery Options')}</Typography>

        {/* Clean savings message and progress — progress bar moved below chips, removed small captions */}
        <Box sx={{ mb: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              {nextTier === 'standard' && (
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {t('addMoreStandard', `Add ₹${remainingForStandard} more to get FREE Standard Delivery`, { amount: remainingForStandard })}
                </Typography>
              )}
              {nextTier === 'express' && (
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {t('addMoreExpress', `You're close — add ₹${remainingForExpress} more to unlock FREE Express Delivery`, { amount: remainingForExpress })}
                </Typography>
              )}
              {!nextTier && (
                <Typography variant="body2" sx={{ fontWeight: 800, color: 'success.main' }}>
                  {t('congratsFreeExpress', 'Congratulations — you have FREE Express Delivery!')}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Stack spacing={0.5} alignItems="flex-end">
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip label={t('freeStandardOver', `Free standard over ₹${standardThreshold}`, { amount: standardThreshold })} size="small" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }} />
                  <Chip label={t('freeExpressOver', `Free express over ₹${expressThreshold}`, { amount: expressThreshold })} size="small" color="warning" variant="outlined" />
                </Box>
              </Stack>
            </Box>
          </Box>

          {/* Progress bar moved below chips for cleaner layout; small captions removed */}
          <Box sx={{ mt: 1 }}>
            <LinearProgress variant="determinate" value={progressPct} sx={{ height: 8, borderRadius: 2 }} />
          </Box>
        </Box>

        <RadioGroup value={option} onChange={handleChange}>
          <FormControlLabel
            value="standard"
            control={<Radio color="primary" />}
            sx={{
              m: 0,
              p: 0,
              border: '1px solid',
              borderColor: option === 'standard' ? 'primary.main' : 'divider',
              borderRadius: 2,
              px: 2,
              py: 1.2,
              mb: 1,
              alignItems: 'flex-start'
            }}
            label={
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="body1" sx={{ fontWeight: 800 }}>{t('standardDelivery', 'Standard')}</Typography>
                <Typography variant="caption" color="text.secondary">{t('deliveredIn24Hrs', 'Delivered in 24 hrs')}</Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip size="small" label="₹49" sx={{ mr: 0.5 }} />
                  <Chip size="small" color="success" variant="outlined" label={t('freeAbove', `Free above ₹${standardThreshold}`, { amount: standardThreshold })} />
                </Box>
              </Box>
            }
          />
          <FormControlLabel
            value="express"
            control={<Radio color="primary" />}
            sx={{
              m: 0,
              p: 0,
              border: '1px solid',
              borderColor: option === 'express' ? 'primary.main' : 'divider',
              borderRadius: 2,
              px: 2,
              py: 1.2,
              alignItems: 'flex-start'
            }}
            label={
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="body1" sx={{ fontWeight: 800 }}>{t('expressDelivery', 'Express')}</Typography>
                <Typography variant="caption" color="text.secondary">{t('deliveredIn1Hr', 'Delivered within 1 hr')}</Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip size="small" label="₹99" sx={{ mr: 0.5 }} />
                  <Chip size="small" color="success" variant="outlined" label={t('freeAbove', `Free above ₹${expressThreshold}`, { amount: expressThreshold })} />
                </Box>
              </Box>
            }
          />
        </RadioGroup>
      </CardContent>
    </Card>
  );
};

export default DeliveryOptionsCard;
