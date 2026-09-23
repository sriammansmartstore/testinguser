import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  IconButton,
  Collapse,
  Alert
} from '@mui/material';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CloseIcon from '@mui/icons-material/Close';
import { fetchPromoByCode } from '../../utils/promoService';

const PromoCodeCard = ({ onApplyPromo }) => {
  const [promoCode, setPromoCode] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');

  const handleApply = async () => {
    setError('');
    setSuccess('');

    if (!promoCode.trim()) {
      setError('Please enter a promo code');
      return;
    }

    try {
      const promo = await fetchPromoByCode(promoCode.trim());
      // success
      setAppliedPromo(promo.code);
      setSuccess('Promo code applied successfully!');
      setError('');
      onApplyPromo && onApplyPromo(promo);
    } catch (err) {
      const message = err?.message || 'Invalid or expired promo code';
      setError(message);
      setSuccess('');
      onApplyPromo && onApplyPromo(null);
    }
  };

  const handleRemove = () => {
    setAppliedPromo('');
    setPromoCode('');
    setSuccess('');
    setError('');
    onApplyPromo && onApplyPromo(null);
  };

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 2, 
        mb: 2, 
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        backgroundColor: 'background.paper',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }
      }}
    >
      {appliedPromo ? (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box display="flex" alignItems="center">
            <LocalOfferIcon color="primary" sx={{ mr: 1.5 }} />
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Promo Code Applied</Typography>
              <Typography variant="body1" fontWeight={600}>
                {appliedPromo}
              </Typography>
            </Box>
          </Box>
          <Button 
            variant="text"
            size="small" 
            color="error"
            onClick={handleRemove}
            startIcon={<CloseIcon fontSize="small" />}
            sx={{ 
              textTransform: 'none',
              borderRadius: 1,
              px: 1,
              py: 0.2,
              minWidth: 0
            }}
          >
            Remove
          </Button>
        </Box>
      ) : (
        <Box>
          <Box 
            display="flex" 
            alignItems="center" 
            justifyContent="space-between"
            sx={{ mb: 1.5 }}
          >
            <Box display="flex" alignItems="center">
              <LocalOfferIcon color="primary" sx={{ mr: 1.5 }} />
              <Typography variant="subtitle1" fontWeight={500}>
                Have a promo code?
              </Typography>
            </Box>
          </Box>
          
          <Box display="flex" gap={1.5} alignItems="center">
            <TextField
              fullWidth
              size="small"
              placeholder="Enter promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleApply()}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: 'background.default',
                  '&:hover fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
              InputProps={{
                sx: {
                  height: 44,
                  '& input': {
                    py: '12px',
                  },
                },
              }}
            />
            <Button 
              variant="contained"
              color="primary"
              onClick={handleApply}
              disabled={!promoCode.trim()}
              sx={{
                height: 44,
                borderRadius: 2,
                px: 3,
                textTransform: 'none',
                fontWeight: 500,
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none',
                  backgroundColor: 'primary.dark',
                },
                '&.Mui-disabled': {
                  backgroundColor: 'action.disabledBackground',
                  color: 'text.disabled',
                },
              }}
            >
              Apply
            </Button>
          </Box>
          
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mt: 1.5,
                borderRadius: 2,
                '& .MuiAlert-message': {
                  py: 0.5,
                },
              }}
              icon={<CloseIcon fontSize="small" />}
            >
              {error}
            </Alert>
          )}
          {success && (
            <Alert 
              severity="success" 
              sx={{ 
                mt: 1.5,
                borderRadius: 2,
                '& .MuiAlert-message': {
                  py: 0.5,
                },
              }}
            >
              {success}
            </Alert>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default PromoCodeCard;
