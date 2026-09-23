import React, { useState } from 'react';
import { Box, Typography, Button, TextField, Paper } from '@mui/material';
import { useLanguage } from '../context/LanguageContext';

const RequestProductForm = ({ onSubmit }) => {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: '',
    description: '',
    brand: '',
    image: null,
  });
  const [imagePreview, setImagePreview] = useState(null);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image' && files && files[0]) {
      setForm((prev) => ({ ...prev, image: files[0] }));
      setImagePreview(URL.createObjectURL(files[0]));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(form);
    setForm({ name: '', description: '', brand: '', image: null });
    setImagePreview(null);
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'transparent', py: 4 }}>
      <Box sx={{ maxWidth: 520, mx: 'auto', px: 2 }}>
        {/* Form only: header handled by page */}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            margin="dense"
            fullWidth
            label={t('productNameLabel')}
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            variant="outlined"
            sx={{ background: '#fff', borderRadius: 1 }}
          />

          <TextField
            margin="dense"
            fullWidth
            label={t('descriptionOptional')}
            name="description"
            value={form.description}
            onChange={handleChange}
            multiline
            rows={3}
            variant="outlined"
            sx={{ background: '#fff', borderRadius: 1 }}
          />

          <TextField
            margin="dense"
            fullWidth
            label={t('brandOptional')}
            name="brand"
            value={form.brand}
            onChange={handleChange}
            variant="outlined"
            sx={{ background: '#fff', borderRadius: 1 }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
            <Button variant="outlined" component="label" sx={{ borderRadius: 2, textTransform: 'none' }}>
              {t('uploadImage')}
              <input type="file" name="image" accept="image/*" hidden onChange={handleChange} />
            </Button>
            {imagePreview && (
              <Box sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: 1 }}>
                <img src={imagePreview} alt="Preview" style={{ width: 96, height: 96, objectFit: 'cover' }} />
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button fullWidth variant="outlined" onClick={() => setForm({ name: '', description: '', brand: '', image: null })}>
              {t('reset')}
            </Button>
            <Button fullWidth type="submit" variant="contained" sx={{ fontWeight: 700 }}>
              {t('submitRequest')}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default RequestProductForm;
