import React from 'react';
import { IconButton, Box } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import contactInfo from '../constants/contactInfo';
import { useLanguage } from '../context/LanguageContext';

const ShippingPolicyPage = () => {
  const { language, t } = useLanguage();
  const isTamil = language === 'tamil';
  const navigate = useNavigate();
  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, py: { xs: 1.5, sm: 2 }, maxWidth: 600, mx: 'auto' }}>
      <IconButton aria-label="back" onClick={() => navigate(-1)} sx={{ mb: 1 }}>
        <ArrowBackIcon />
      </IconButton>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 14, lineHeight: 1.2 }}>{t('shippingPolicy')}</h1>
      <Box sx={{ color: 'text.secondary', fontSize: { xs: '0.98rem', sm: '1.05rem' }, lineHeight: 1.7 }}>
        {isTamil ? (
          <>
            <p>எங்கள் டெலிவரி கொள்கை பற்றிய விவரங்கள் கீழே கொடுக்கப்பட்டுள்ளன:</p>
            <ul style={{ marginLeft: 24, marginBottom: 16 }}>
              <li>அனைத்து ஆர்டர்களும் விரைவாகவும் பாதுகாப்பாகவும் எங்கள் டெலிவரி குழு அல்லது பதிவு செய்யப்பட்ட கூரியர் மூலம் அனுப்பப்படும்.</li>
              <li>பொருட்கள் வாங்கும் போது நீங்கள் வழங்கிய முகவரிக்கு மட்டுமே டெலிவரி செய்யப்படும்.</li>
              <li>டெலிவரி தொடர்பான அறிவிப்புகள் உங்கள் பதிவு செய்யப்பட்ட மொபைல் எண் மற்றும் மின்னஞ்சலுக்கு அனுப்பப்படும்.</li>
              <li>ஏதேனும் டெலிவரி கட்டணங்கள் விதிக்கப்பட்டிருந்தால், அவை திரும்பப் பெறப்படமாட்டாது.</li>
            </ul>
            <Box sx={{ background: '#f8f9fa', borderRadius: 2, p: 2, my: 2 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: 0, color: '#333' }}>தொடர்புக்கு</h2>
              <p style={{ margin: 0 }}>
                <b>தொலைபேசி:</b> {contactInfo.phone}<br />
                <b>மின்னஞ்சல்:</b> {contactInfo.email}
              </p>
            </Box>
          </>
        ) : (
          <>
            <p>The orders for the user are shipped through registered domestic courier companies and/or our delivery team. Orders are shipped as per the agreed delivery schedule.</p>
            <ul style={{ marginLeft: 24, marginBottom: 16 }}>
              <li>Delivery of all orders will be made to the address provided by the buyer at the time of purchase.</li>
              <li>Delivery updates will be confirmed on your registered mobile number and email ID.</li>
              <li>Shipping costs, if any, are non-refundable.</li>
            </ul>
            <Box sx={{ background: '#f8f9fa', borderRadius: 2, p: 2, my: 2 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: 0, color: '#333' }}>Contact</h2>
              <p style={{ margin: 0 }}>
                <b>Phone:</b> {contactInfo.phone}<br />
                <b>Email:</b> {contactInfo.email}
              </p>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default ShippingPolicyPage;
