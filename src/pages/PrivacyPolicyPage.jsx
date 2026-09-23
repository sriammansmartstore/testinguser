import React from 'react';
import { IconButton, Box } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import contactInfo from '../constants/contactInfo';
import { useLanguage } from '../context/LanguageContext';

const PrivacyPolicyPage = () => {
  const { language, t } = useLanguage();
  const isTamil = language === 'tamil';
  const navigate = useNavigate();
  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, py: { xs: 1.5, sm: 2 }, maxWidth: 600, mx: 'auto' }}>
      <IconButton aria-label="back" onClick={() => navigate(-1)} sx={{ mb: 1 }}>
        <ArrowBackIcon />
      </IconButton>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 14, lineHeight: 1.2 }}>{t('privacyPolicy')}</h1>
      <Box sx={{ color: 'text.secondary', fontSize: { xs: '0.98rem', sm: '1.05rem' }, lineHeight: 1.7 }}>
        {isTamil ? (
          <>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: 12, color: '#333' }}>அறிமுகம்</h2>
            <p>ஸ்ரீ அம்மன் ஸ்மார்ட் ஸ்டோர் உங்கள் தனிப்பட்ட தகவல்களை எவ்வாறு சேகரிக்கிறது, பயன்படுத்துகிறது மற்றும் பாதுகாக்கிறது என்பதை இந்தக் கொள்கை விளக்குகிறது. எங்கள் தளத்தைப் பார்வையிடுவதன் மூலம் அல்லது உங்கள் தகவல்களை வழங்குவதன் மூலம், இந்தத் தனியுரிமைக் கொள்கையை நீங்கள் முழுமையாக ஏற்றுக்கொள்கிறீர்கள்.</p>

            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: 24, color: '#333' }}>தகவல் சேகரிப்பு</h2>
            <p>நீங்கள் கணக்கு தொடங்கும் போது அல்லது ஆர்டர் செய்யும் போது உங்கள் பெயர், தொலைபேசி எண், முகவரி மற்றும் மின்னஞ்சல் ஆகியவற்றை நாங்கள் சேகரிக்கிறோம். இவை உங்கள் ஆர்டர்களைச் சரியாக விநியோகிக்கப் பயன்படுத்தப்படுகின்றன.</p>

            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: 24, color: '#333' }}>தகவல்களின் பயன்பாடு</h2>
            <p>உங்கள் ஆர்டர்களைச் செயல்படுத்தவும், டெலிவரி நிலையைத் தெரிவிக்கவும், வாடிக்கையாளர் ஆதரவு வழங்கவும், சிறப்பு சலுகைகள் மற்றும் முக்கிய அறிவிப்புகளைப் பகிரவும் உங்கள் விவரங்கள் பயன்படுகின்றன.</p>

            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: 24, color: '#333' }}>தகவல் பகிர்வு</h2>
            <p>உங்கள் ஆர்டர்களை உங்கள் வீட்டிற்குக் கொண்டு சேர்க்கும் டெலிவரி ஊழியர்கள் மற்றும் சட்டப்பூர்வ தேவைகளுக்கு மட்டுமே தேவையான விவரங்கள் பகிரப்படும். உங்கள் விவரங்கள் எந்தவொரு மூன்றாம் நபருக்கும் விற்கப்படாது.</p>

            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: 24, color: '#333' }}>பாதுகாப்பு நடவடிக்கைகள்</h2>
            <p>உங்கள் தனிப்பட்ட தரவுகளைப் பாதுகாக்க கடுமையான பாதுகாப்பு நெறிமுறைகளைப் பின்பற்றுகிறோம். உங்கள் கணக்கு கடவுச்சொல் மற்றும் OTP விவரங்களை யாருடனும் பகிர வேண்டாம்.</p>

            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: 24, color: '#333' }}>உங்கள் உரிமைகள்</h2>
            <p>உங்கள் கணக்கு விவரங்களை சுயவிவரப் பகுதியில் எப்போது வேண்டுமானாலும் பார்வையிடலாம் அல்லது புதுப்பிக்கலாம்.</p>

            <Box sx={{ background: '#f8f9fa', borderRadius: 2, p: 2, my: 3 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: 0, color: '#333' }}>தொடர்புக்கு</h2>
              <p style={{ margin: 0 }}>
                <b>தொலைபேசி:</b> {contactInfo.phone}<br />
                <b>மின்னஞ்சல்:</b> {contactInfo.email}
              </p>
            </Box>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: 12, color: '#333' }}>Introduction</h2>
            <p>This Privacy Policy describes how Sri Amman Smart Store collects, uses, shares, protects or otherwise processes your personal data through our platform. By visiting this Platform or providing your information, you agree to be bound by the terms of this Privacy Policy.</p>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: 24, color: '#333' }}>Collection</h2>
            <p>We collect personal data such as name, address, phone number, and email ID during registration or when placing an order to ensure timely delivery and service.</p>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: 24, color: '#333' }}>Usage</h2>
            <p>We use your personal data to fulfill orders, enhance customer support, and inform you of order updates, promotions, and new services.</p>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: 24, color: '#333' }}>Sharing</h2>
            <p>We only share necessary delivery details with logistics partners and will never sell your information to third parties.</p>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: 24, color: '#333' }}>Security Precautions</h2>
            <p>We adopt strict security practices to protect your information against unauthorized access, loss, or misuse.</p>
            <Box sx={{ background: '#f8f9fa', borderRadius: 2, p: 2, my: 3 }}>
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

export default PrivacyPolicyPage;
