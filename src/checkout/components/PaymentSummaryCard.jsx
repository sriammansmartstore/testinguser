import React from 'react';
import { Box, Typography, Button, Card, CardContent, Divider, CircularProgress } from '@mui/material';

const PaymentSummaryCard = ({ summary, onProceed, isProceedDisabled }) => (
  <Card
    sx={{
      // Normal flow on mobile; sticky on large screens
      position: { xs: 'static', sm: 'static', md: 'static', lg: 'sticky' },
      top: { lg: 20 },
      // Fill column width with no horizontal margins
      width: { xs: '100%', sm: '100%', md: 'auto' },
      mx: 0,
      borderRadius: { xs: 0, sm: 2 },
      boxShadow: { xs: 0, sm: 2 },
      bgcolor: 'background.paper'
    }}
  >
    <CardContent sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Payment Details</Typography>

      <Box display="flex" justifyContent="space-between" mb={1}>
        <Typography>Subtotal</Typography>
        <Typography>₹{summary.total}</Typography>
      </Box>
      <Box display="flex" justifyContent="space-between" mb={1}>
        <Typography>Taxes</Typography>
        <Typography>Included</Typography>
      </Box>
      <Box display="flex" justifyContent="space-between" mb={1}>
        <Typography>Delivery Fee</Typography>
        <Typography color="success.main">FREE</Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box display="flex" justifyContent="space-between" mb={3}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Total Amount</Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>₹{summary.total}</Typography>
      </Box>

      <Button
        variant="contained"
        fullWidth
        size="large"
        disabled={isProceedDisabled}
        onClick={onProceed}
        sx={{ fontWeight: 600, borderRadius: 2, py: 1.5 }}
      >
        {isProceedDisabled && summary.total > 0 ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          'Proceed to Payment'
        )}
      </Button>
    </CardContent>
  </Card>
);

export default PaymentSummaryCard;