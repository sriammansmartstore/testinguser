import React from "react";
import { Box, Typography, IconButton } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

const AboutUsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <Box sx={{ p: 2, background: "#fff", minHeight: "100vh", borderRadius: 4, boxShadow: '0 4px 16px rgba(67,160,71,0.08)' }}>
      <Box display="flex" alignItems="center" mb={1}>
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" color="primary" fontWeight={700} sx={{ flex: 1 }}>
          {t('aboutUsTitle') || "About Us"}
        </Typography>
      </Box>
      <Typography variant="body1" mb={2} sx={{ lineHeight: 1.8 }}>
        {t('aboutUsDesc')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('aboutUsContact')}
      </Typography>
    </Box>
  );
};
export default AboutUsPage;
