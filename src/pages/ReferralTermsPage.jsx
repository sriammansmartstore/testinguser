import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, Checkbox, FormControlLabel, Button, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const ReferralTermsPage = () => {
  const { language } = useLanguage();
  const isTamil = language === 'tamil';
  const [accepted, setAccepted] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleAccept = () => {
    try {
      localStorage.setItem('referralTermsAccepted', 'true');
    } catch (_) {}
    const redirectTo = (location.state && location.state.from) || '/refer-and-earn';
    navigate(redirectTo, { replace: true });
  };

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', mt: 0, px: 2 }}>
      <IconButton onClick={() => navigate(-1)} sx={{ mb: 2 }} aria-label="back">
        <ArrowBackIcon />
      </IconButton>
      <Card elevation={4} sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} color="primary.main" gutterBottom>
            {isTamil ? "பரிந்துரைத்து சம்பாதிக்க - விதிமுறைகள் மற்றும் நிபந்தனைகள்" : "Refer & Earn - Terms and Conditions"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {isTamil 
              ? "எங்கள் பரிந்துரை திட்டத்தில் பங்கேற்க பின்வரும் விதிமுறைகளைப் படித்து ஏற்றுக்கொள்ளவும்." 
              : "Please read and accept the following terms to participate in our Refer & Earn program."}
          </Typography>

          <Box component="ul" sx={{ pl: 2, mb: 2, lineHeight: 1.7, color: 'text.primary' }}>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "சரியான கணக்கு கொண்ட பதிவு செய்த பயனர்கள் மட்டுமே நண்பர்களைப் பரிந்துரைக்க முடியும்." 
                : "Only registered users with a valid account can refer friends."}
            </Typography>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "உங்கள் பரிந்துரை குறியீட்டை நண்பர்கள் மற்றும் குடும்பத்தினருடன் பகிருங்கள்." 
                : "Share your unique referral link/code with friends and family. Do not spam or post in unsolicited channels."}
            </Typography>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "பரிந்துரைக்கப்பட்ட பயனர் ₹5000 அல்லது அதற்கு மேற்பட்ட ஆர்டரை டெலிவரி பெற்றுக்கொண்ட பின்னரே பரிந்துரை வெற்றிகரமாகக் கருதப்படும்." 
                : "A referral is successful only after the referred user's order of ₹5000 or more is delivered successfully (received by the customer)."}
            </Typography>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "ஆர்டர் டெலிவரி உறுதி செய்யப்பட்ட பின்னரே நாணயங்கள் உங்கள் கணக்கில் சேர்க்கப்படும்." 
                : "Coins are released/credited only after successful delivery confirmation of the referred user’s qualifying order."}
            </Typography>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "நாணயங்களுக்கு ரொக்க மதிப்பு கிடையாது மற்றும் பிறருக்கு மாற்ற முடியாது." 
                : "Coins have no cash value, are non-transferable, and may be subject to expiry and usage restrictions."}
            </Typography>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "நாணயங்களை இந்த தளத்தில் மட்டுமே வாங்குவதற்கும் செலவழிப்பதற்கும் பயன்படுத்த முடியும்." 
                : "Coins can only be used for purchasing and spending within this app/platform and cannot be withdrawn, transferred, or used outside the app."}
            </Typography>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "போலி கணக்குகள் அல்லது சுய பரிந்துரைகள் அனுமதிக்கப்படாது." 
                : "Self-referrals or fraudulent/duplicate accounts are not eligible and may lead to disqualification."}
            </Typography>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "திட்டத்தை எந்த நேரத்திலும் திருத்த அல்லது இடைநிறுத்த எங்களுக்கு உரிமை உண்டு." 
                : "We reserve the right to modify, suspend, or terminate the program at any time without prior notice."}
            </Typography>
          </Box>

          <FormControlLabel
            control={<Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />}
            label={isTamil ? "பரிந்துரை விதிமுறைகள் மற்றும் நிபந்தனைகளை நான் படித்து ஏற்றுக்கொள்கிறேன்" : "I have read and agree to the Refer & Earn Terms and Conditions"}
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button variant="contained" disabled={!accepted} onClick={handleAccept}>
              {isTamil ? "ஏற்றுக்கொண்டு தொடரவும்" : "Accept & Continue"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ReferralTermsPage;
