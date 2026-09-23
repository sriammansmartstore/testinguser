import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Stack,
  Alert
} from '@mui/material';
import { ReceiptLong } from '@mui/icons-material';

export default function GSTDetailsCard({ gstDetails, onGSTDetailsChange }) {
  const [includeGST, setIncludeGST] = useState(false);

  const handleGSTToggle = (event) => {
    const checked = event.target.checked;
    setIncludeGST(checked);
    if (!checked) {
      // Reset GST details when toggled off
      onGSTDetailsChange({
        gstNumber: '',
        businessName: '',
        businessAddress: ''
      });
    }
  };

  const handleGSTDetailsChange = (field) => (event) => {
    onGSTDetailsChange({
      ...gstDetails,
      [field]: event.target.value
    });
  };

  // GST number validation (basic format check)
  const isValidGSTNumber = (gstNumber) => {
    const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstPattern.test(gstNumber);
  };

  const hasGSTError = includeGST && gstDetails?.gstNumber && !isValidGSTNumber(gstDetails.gstNumber);

  return (
    <Card sx={{ mb: 2, bgcolor: '#fff' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <ReceiptLong sx={{ color: '#388e3c', mr: 1 }} />
          <Typography variant="h6" component="div">
            GST Details
          </Typography>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={includeGST}
              onChange={handleGSTToggle}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: '#388e3c',
                  '&:hover': { backgroundColor: 'rgba(56, 142, 60, 0.08)' }
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#388e3c'
                }
              }}
            />
          }
          label="Claim GST for this order"
        />

        {includeGST && (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="GST Number"
              value={gstDetails?.gstNumber || ''}
              onChange={handleGSTDetailsChange('gstNumber')}
              error={hasGSTError}
              helperText={hasGSTError ? 'Please enter a valid GST number' : ''}
              placeholder="e.g., 27AAPFU0939F1ZV"
              inputProps={{ maxLength: 15 }}
            />

            <TextField
              fullWidth
              label="Business/Company Name"
              value={gstDetails?.businessName || ''}
              onChange={handleGSTDetailsChange('businessName')}
              placeholder="Enter your registered business name"
            />

            <TextField
              fullWidth
              label="Business Address"
              value={gstDetails?.businessAddress || ''}
              onChange={handleGSTDetailsChange('businessAddress')}
              multiline
              rows={3}
              placeholder="Enter your registered business address"
            />

            <Alert severity="info" sx={{ mt: 2 }}>
              A valid GST Invoice will be generated for this order with the provided details.
            </Alert>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}