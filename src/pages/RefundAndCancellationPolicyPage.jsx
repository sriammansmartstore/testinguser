import React from 'react';
import { IconButton, Box } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import contactInfo from '../constants/contactInfo';
import { useLanguage } from '../context/LanguageContext';

const RefundAndCancellationPolicyPage = () => {
  const { language, t } = useLanguage();
  const isTamil = language === 'tamil';
  const navigate = useNavigate();
  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, py: { xs: 1.5, sm: 2 }, maxWidth: 600, mx: 'auto' }}>
      <IconButton aria-label="back" onClick={() => navigate(-1)} sx={{ mb: 1 }}>
        <ArrowBackIcon />
      </IconButton>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 14, lineHeight: 1.2 }}>{t('refundAndCancellation')}</h1>
      <Box sx={{ color: 'text.secondary', fontSize: { xs: '0.98rem', sm: '1.05rem' }, lineHeight: 1.7 }}>
        {isTamil ? (
          <>
            <p>எங்கள் தளத்தின் மூலம் நீங்கள் வாங்கிய பொருட்களுக்கான ரத்து செய்தல் மற்றும் பணத்தைத் திரும்பப் பெறுதல் கொள்கை கீழே கொடுக்கப்பட்டுள்ளது:</p>
            <ul style={{ marginLeft: 24, marginBottom: 16 }}>
              <li>ஆர்டர் செய்த 10 நாட்களுக்குள் கோரிக்கை வைத்தால் மட்டுமே ரத்து செய்தல் ஏற்றுக்கொள்ளப்படும்.</li>
              <li>பொருட்கள் ஏற்கனவே அனுப்பப்பட்டுவிட்டாலோ அல்லது டெலிவரிக்கு புறப்பட்டுவிட்டாலோ ரத்து செய்ய இயலாது. அத்தகைய சூழலில் வீட்டு வாசலில் பொருட்களை நிராகரிக்கலாம்.</li>
              <li>காய்கறிகள், உணவுப் பொருட்கள் போன்ற அழுகும் பொருட்களின் தரம் குறைவாக இருந்தால் மட்டுமே மாற்றித் தரப்படும் அல்லது பணம் திரும்ப அளிக்கப்படும்.</li>
              <li>சேதமடைந்த அல்லது பழுதடைந்த பொருட்கள் வந்தால் உடனடியாக எங்கள் வாடிக்கையாளர் ஆதரவுக் குழுவிடம் தெரிவிக்க வேண்டும்.</li>
              <li>பொருட்கள் தங்களின் எதிர்பார்ப்பிற்கு ஏற்ப இல்லையெனில், 10 நாட்களுக்குள் எங்களுக்குத் தெரிவிக்க வேண்டும்.</li>
              <li>அங்கீகரிக்கப்பட்ட பணத்தைத் திரும்பப் பெறுதல் 10 வேலை நாட்களுக்குள் உங்கள் வங்கிக் கணக்கிற்குச் செலுத்தப்படும்.</li>
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
            <p>This refund and cancellation policy outlines how you can cancel or seek a refund for a product/service that you have purchased through the Platform. Under this policy:</p>
            <ul style={{ marginLeft: 24, marginBottom: 16 }}>
              <li>Cancellations will only be considered if the request is made within 10 days of placing the order.</li>
              <li>Cancellation requests may not be entertained if the orders have been communicated to sellers and they have initiated shipping. In such an event, you may choose to reject the product at the doorstep.</li>
              <li>Sri Amman Smart Store does not accept cancellation requests for perishable items. However, replacement or refund can be made if the quality is defective.</li>
              <li>In case of receipt of damaged or defective items, please report to our customer service team within 10 days.</li>
              <li>In case of any refunds approved by Sri Amman Smart Store, it will take 10 days for the refund to be processed to you.</li>
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

export default RefundAndCancellationPolicyPage;
