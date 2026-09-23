import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Snackbar, Alert, Slide } from '@mui/material';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, app } from '../firebase';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import RequestProductForm from '../components/RequestProductForm';
import { Box, IconButton, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const RequestProductPage = () => {
  const { user } = useContext(AuthContext);
  const { t } = useLanguage();
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const navigate = useNavigate();

  const handleSubmit = async (form) => {
    const { name } = form;

    if (!user) {
      navigate('/login');
      return;
    }

    if (!name || !name.trim()) {
      setSnackbar({ open: true, message: t('pleaseEnterProductName') || 'Please enter a product name', severity: 'error' });
      return;
    }

    // Fire-and-forget: perform upload + addDoc in background so UI can clear and navigate immediately
    (async () => {
      try {
        let imageUrl = null;
        if (form.image) {
          const storage = getStorage(app);
          const fileRef = storageRef(storage, `requested-products/${Date.now()}_${form.image.name}`);
          await uploadBytes(fileRef, form.image);
          imageUrl = await getDownloadURL(fileRef);
        }
        await addDoc(collection(db, 'requested-products'), {
          productName: (form.name || '').trim(),
          description: (form.description || '').trim(),
          brand: (form.brand || '').trim(),
          imageUrl: imageUrl,
          userId: user.uid,
          userEmail: user.email,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      } catch (error) {
        // Log background errors. Optionally surface via global notifier later.
        console.error('Request product submit background error:', error);
      }
    })();

    // Navigate immediately and show success notification on the home page
    navigate('/', { state: { notification: { message: t('productRequestSuccess') || 'Product request submitted successfully!', severity: 'success' } } });
    return;
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'transparent', pt: 2 }}>
      <Box sx={{ maxWidth: 520, mx: 'auto', px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <IconButton size="small" onClick={() => navigate('/') }>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }} color="primary">
              {t('requestProductTitle') || "Request a Product"}
            </Typography>
          </Box>
        </Box>

        <RequestProductForm onSubmit={handleSubmit} />

        <Snackbar
          open={snackbar.open}
          autoHideDuration={snackbar.severity === 'success' ? 4500 : 4000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          TransitionComponent={(props) => <Slide {...props} direction="up" />}
          sx={{ bottom: { xs: '76px', sm: '24px' } }}
        >
          <Alert
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            severity={snackbar.severity}
            variant={snackbar.severity === 'success' ? 'filled' : 'standard'}
            sx={{
              width: '100%',
              boxShadow: 3,
              borderRadius: 2,
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
};

export default RequestProductPage;