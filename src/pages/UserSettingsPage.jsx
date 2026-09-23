import React, { useState, useContext } from "react";
import { Box, Typography, TextField, Button, IconButton, Tabs, Tab, Alert } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from "react-router-dom";
import './UserSettingsPage.css';

import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { reauthenticateWithCredential, EmailAuthProvider, updatePassword } from "firebase/auth";
import PermissionsManager from '../components/PermissionsManager';

const UserSettingsPage = () => {
  const { user } = useContext(AuthContext);
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tabValue, setTabValue] = useState(0);
  const navigate = useNavigate();

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    if (!user || !user.email) {
      setError("No user found or user is not email/password account.");
      setLoading(false);
      return;
    }
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err.message || "Failed to change password.");
    }
    setLoading(false);
  };

  return (
    <Box className="settings-root">
      <Box display="flex" alignItems="center" mb={2}>
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" className="settings-title" sx={{ flex: 1 }}>{t('settings') || "Settings"}</Typography>
      </Box>

      <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab label={t('password') || "Password"} />
        <Tab label={t('permissions') || "Permissions"} />
      </Tabs>

      {tabValue === 0 && (
        <Box className="settings-section">
          {(!user?.providerData?.some(p => p.providerId === 'password')) ? (
            <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
              {t('passwordSecurityNotice')}
            </Alert>
          ) : (
            <>
              <TextField
                label={t('currentPassword') || "Current Password"}
                type="password"
                variant="outlined"
                fullWidth
                margin="normal"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
              />
              <TextField
                label={t('newPassword') || "New Password"}
                type="password"
                variant="outlined"
                fullWidth
                margin="normal"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <Button
                variant="contained"
                className="save-btn"
                onClick={handleChangePassword}
                disabled={loading || !currentPassword || !newPassword}
              >
                {loading ? "Changing..." : (t('changePassword') || "Change Password")}
              </Button>
              {error && <Typography color="error" mt={2}>{error}</Typography>}
              {success && <Typography color="success.main" mt={2}>{success}</Typography>}
            </>
          )}
        </Box>
      )}

      {tabValue === 1 && (
        <PermissionsManager />
      )}
    </Box>
  );
};
export default UserSettingsPage;
