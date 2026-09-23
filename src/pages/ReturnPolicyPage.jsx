import React from 'react';
import { IconButton, Box } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import contactInfo from '../constants/contactInfo';
import { useLanguage } from '../context/LanguageContext';

const ReturnPolicyPage = () => {
  const { language, t } = useLanguage();
  const isTamil = language === 'tamil';
  const navigate = useNavigate();
  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, py: { xs: 1.5, sm: 2 }, maxWidth: 600, mx: 'auto' }}>
      <IconButton aria-label="back" onClick={() => navigate(-1)} sx={{ mb: 1 }}>
        <ArrowBackIcon />
      </IconButton>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 14, lineHeight: 1.2 }}>{t('returnPolicy')}</h1>
      <Box sx={{ color: 'text.secondary', fontSize: { xs: '0.98rem', sm: '1.05rem' }, lineHeight: 1.7 }}>
        {isTamil ? (
          <>
            <p>பொருட்களை வாங்கிய முதல் 10 நாட்களுக்குள் திருப்பி அனுப்புதல் அல்லது மாற்றுப் பொருள் கோரிக்கையை நீங்கள் சமர்ப்பிக்கலாம்.</p>
            <ul style={{ marginLeft: 24, marginBottom: 16 }}>
              <li>திருப்பி அனுப்புவதற்கான தகுதிகள்:
                <ul style={{ marginLeft: 16 }}>
                  <li>பொருட்கள் பயன்படுத்தப்படாமல், நீங்கள் பெற்ற அதே நிலையில் இருக்க வேண்டும்.</li>
                  <li>அசல் பேக்கேஜிங் மற்றும் லேபிள்கள் அப்படியே இருக்க வேண்டும்.</li>
                  <li>சேதமடைந்த அல்லது தவறான தயாரிப்புகள் மட்டுமே மாற்றிக் கொடுக்கப்படும்.</li>
                </ul>
              </li>
              <li>பொருட்கள் ஆய்வு செய்யப்பட்டு தரம் உறுதி செய்யப்பட்ட பின்னர், உடனடியாக மாற்றுப் பொருள் அல்லது பணத்தைத் திரும்பப் பெறுதல் செயல்முறை தொடங்கப்படும்.</li>
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
            <p>We offer refund/exchange within first 10 days from the date of your purchase. If 10 days have passed, you will not be offered a return or refund.</p>
            <ul style={{ marginLeft: 24, marginBottom: 16 }}>
              <li>To become eligible for a return or an exchange:
                <ul style={{ marginLeft: 16 }}>
                  <li>The purchased item should be unused and in the same condition as you received it.</li>
                  <li>The item must have original packaging.</li>
                  <li>Only such items are replaced by us if found defective or damaged.</li>
                </ul>
              </li>
              <li>Once inspected and approved, your return/exchange will be processed in accordance with our policies.</li>
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

export default ReturnPolicyPage;
