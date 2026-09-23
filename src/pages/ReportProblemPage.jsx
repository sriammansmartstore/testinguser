import React, { useState } from "react";
import { Box, Typography, TextField, Button, IconButton } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

const ReportProblemPage = () => {
  const [problem, setProblem] = useState("");
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleSubmit = () => {
    // TODO: Send problem report to backend
    setProblem("");
    alert(t('thankYouFeedback') || "Thank you for your feedback!");
  };
  return (
    <Box sx={{ p: 2, background: "#fff", minHeight: "100vh", borderRadius: 4, boxShadow: '0 4px 16px rgba(233,30,99,0.08)' }}>
      <Box display="flex" alignItems="center" mb={1}>
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" color="primary" fontWeight={700} mb={2} sx={{ flex: 1 }}>
          {t('reportProblemTitle') || "Report a Problem"}
        </Typography>
      </Box>
      <TextField
        label={t('describeProblem') || "Describe your problem"}
        multiline
        rows={4}
        variant="outlined"
        fullWidth
        value={problem}
        onChange={e => setProblem(e.target.value)}
        sx={{ mb: 2 }}
      />
      <Button variant="contained" color="primary" onClick={handleSubmit}>
        {t('submit') || "Submit"}
      </Button>
    </Box>
  );
};
export default ReportProblemPage;
