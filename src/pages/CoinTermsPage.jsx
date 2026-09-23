import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, Checkbox, FormControlLabel, Button, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const CoinTermsPage = () => {
  const { language } = useLanguage();
  const isTamil = language === 'tamil';
  const [accepted, setAccepted] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleAccept = () => {
    try { localStorage.setItem('coinTermsAccepted', 'true'); } catch (_) {}
    const redirectTo = (location.state && location.state.from) || '/coin-management';
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
            {isTamil ? "நாணயங்கள் - விதிமுறைகள் மற்றும் நிபந்தனைகள்" : "Coins - Terms and Conditions"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {isTamil 
              ? "உங்கள் நாணயங்களைக் காணவும் பயன்படுத்தவும் பின்வரும் விதிமுறைகளைப் படித்து ஏற்றுக்கொள்ளவும்." 
              : "Please read and accept the following terms to view and use your coins."}
          </Typography>

          <Box component="ul" sx={{ pl: 2, mb: 2, lineHeight: 1.7, color: 'text.primary' }}>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "நாணயங்கள் என்பது ஒரு விளம்பர வெகுமதியாகும், அவை சட்டப்பூர்வ பணமல்ல." 
                : "Coins are a promotional reward and are not legal tender."}
            </Typography>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "நாணயங்களுக்கு ரொக்க மதிப்பு கிடையாது மற்றும் எந்த வங்கி அல்லது பணப்பைக்கும் மாற்றவோ திரும்பப் பெறவோ முடியாது." 
                : "Coins have no cash value and cannot be withdrawn or transferred to any bank or wallet."}
            </Typography>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "நாணயங்களை இந்த செயலி/தளத்திற்குள் வாங்குவதற்கும் செலவழிப்பதற்கும் மட்டுமே பயன்படுத்த முடியும் மற்றும் செயலிக்கு வெளியே பயன்படுத்த முடியாது." 
                : "Coins can only be used for purchasing and spending within this app/platform and cannot be used outside the app."}
            </Typography>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "நாணயங்களின் மதிப்பு, மாற்று விகிதம் எங்கள் சொந்த முடிவின்படி எந்த நேரத்திலும் மாற்றப்படலாம்." 
                : "The value, conversion, and redemption rate of coins may be changed at any time and in any situation at our sole discretion."}
            </Typography>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "நாணயங்கள் காலாவதியாதல், குறைந்தபட்ச ஆர்டர் மதிப்பு அல்லது பிற பயன்பாட்டு நிபந்தனைகளுக்கு உட்பட்டிருக்கலாம்." 
                : "Coins may be subject to expiry, category restrictions, minimum order values, or other usage conditions."}
            </Typography>
            <Typography component="li" variant="body2">
              {isTamil 
                ? "முறைகேடு அல்லது மோசடி ஏதேனும் கண்டறியப்பட்டால் நாணயங்கள் ரத்து செய்யப்படும் மற்றும் கணக்கு மீது நடவடிக்கை எடுக்கப்படும்." 
                : "Any suspected abuse, fraud, or misuse may lead to coin reversal and account action."}
            </Typography>
          </Box>

          <FormControlLabel
            control={<Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />}
            label={isTamil ? "நாணயங்கள் விதிமுறைகள் மற்றும் நிபந்தனைகளை நான் படித்து ஏற்றுக்கொள்கிறேன்" : "I have read and agree to the Coins Terms and Conditions"}
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

export default CoinTermsPage;
