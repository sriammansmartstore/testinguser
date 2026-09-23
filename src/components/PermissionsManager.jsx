import React, { useState, useEffect, useContext } from 'react';
import { Box, Typography, Button, Switch, FormControlLabel, Card, CardContent, Alert, CircularProgress, Divider } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CameraIcon from '@mui/icons-material/Camera';
import MicIcon from '@mui/icons-material/Mic';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import { AuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const PermissionsManager = () => {
  const { user } = useContext(AuthContext);
  const { t } = useLanguage();
  const [permissions, setPermissions] = useState({
    notification: 'default',
    sound: false,
    geolocation: 'default',
    camera: 'default',
    microphone: 'default',
    storage: 'default',
  });
  const [loading, setLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [errors, setErrors] = useState({});

  const resolveUserDocId = async (uid) => {
    try {
      const mapSnap = await getDoc(doc(db, 'usersByUid', uid));
      return mapSnap.exists() ? (mapSnap.data()?.userDocId || uid) : uid;
    } catch (_) {
      return uid;
    }
  };

  // Load permissions from Firestore on mount
  useEffect(() => {
    if (!user) return;
    const loadPermissions = async () => {
      try {
        const userDocId = await resolveUserDocId(user.uid);
        const userRef = doc(db, 'users', userDocId);
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().permissions) {
          setPermissions(snap.data().permissions);
        }
      } catch (err) {
        console.error('Error loading permissions:', err);
      }
    };
    loadPermissions();
  }, [user]);

  // Request notification permission
  const requestNotificationPermission = async () => {
    try {
      if (!('Notification' in window)) {
        setErrors({ notification: 'Notifications not supported' });
        return;
      }
      const permission = await Notification.requestPermission();
      setPermissions(p => ({ ...p, notification: permission }));
      if (permission === 'granted') {
        new Notification('Sri Amman Smart Store', { body: 'Notifications enabled!' });
      }
    } catch (err) {
      setErrors(e => ({ ...e, notification: err.message }));
    }
  };

  // Request geolocation permission
  const requestGeolocationPermission = async () => {
    try {
      if (!('geolocation' in navigator)) {
        setErrors({ geolocation: 'Geolocation not supported' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => {
          setPermissions(p => ({ ...p, geolocation: 'granted' }));
        },
        (err) => {
          setPermissions(p => ({ ...p, geolocation: 'denied' }));
          setErrors(e => ({ ...e, geolocation: err.message }));
        }
      );
    } catch (err) {
      setErrors(e => ({ ...e, geolocation: err.message }));
    }
  };

  // Request camera permission
  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissions(p => ({ ...p, camera: 'granted' }));
    } catch (err) {
      setPermissions(p => ({ ...p, camera: 'denied' }));
      setErrors(e => ({ ...e, camera: err.message }));
    }
  };

  // Request microphone permission
  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissions(p => ({ ...p, microphone: 'granted' }));
    } catch (err) {
      setPermissions(p => ({ ...p, microphone: 'denied' }));
      setErrors(e => ({ ...e, microphone: err.message }));
    }
  };

  // Save permissions to Firestore
  const savePermissions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userDocId = await resolveUserDocId(user.uid);
      const userRef = doc(db, 'users', userDocId);
      await setDoc(userRef, { permissions }, { merge: true });
      setSavedMessage(t('permissionsSavedSuccess') || 'Permissions saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err) {
      setErrors(e => ({ ...e, save: err.message }));
    }
    setLoading(false);
  };

  const permissionStatus = (perm) => {
    if (perm === 'granted') return { color: 'success', label: t('granted') || 'Granted' };
    if (perm === 'denied') return { color: 'error', label: t('denied') || 'Denied' };
    return { color: 'warning', label: t('defaultPrompt') || 'Default/Prompt' };
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t('managePermissions') || "Manage Permissions"}</Typography>
      
      {savedMessage && <Alert severity="success" sx={{ mb: 2 }}>{savedMessage}</Alert>}

      {/* Notifications */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center">
              <NotificationsIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('pushNotifications') || "Push Notifications"}</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: permissionStatus(permissions.notification).color }}>{permissionStatus(permissions.notification).label}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('pushNotificationsDesc')}</Typography>
          <Button variant="contained" size="small" onClick={requestNotificationPermission} sx={{ mr: 1 }}>{t('enableNotifications') || "Enable Notifications"}</Button>
          {errors.notification && <Typography variant="caption" color="error">{errors.notification}</Typography>}
        </CardContent>
      </Card>

      {/* Sound */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              <VolumeUpIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('notificationSound') || "Notification Sound"}</Typography>
            </Box>
            <Switch checked={permissions.sound} onChange={(e) => setPermissions(p => ({ ...p, sound: e.target.checked }))} />
          </Box>
          <Typography variant="body2" color="text.secondary">{t('notificationSoundDesc')}</Typography>
        </CardContent>
      </Card>

      {/* Geolocation */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center">
              <LocationOnIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('geolocation') || "Location"}</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: permissionStatus(permissions.geolocation).color }}>{permissionStatus(permissions.geolocation).label}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('geolocationDesc')}</Typography>
          <Button variant="contained" size="small" onClick={requestGeolocationPermission}>{t('enableLocation') || "Enable Location"}</Button>
          {errors.geolocation && <Typography variant="caption" color="error">{errors.geolocation}</Typography>}
        </CardContent>
      </Card>

      {/* Camera */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center">
              <CameraIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('camera') || "Camera"}</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: permissionStatus(permissions.camera).color }}>{permissionStatus(permissions.camera).label}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('cameraDesc')}</Typography>
          <Button variant="contained" size="small" onClick={requestCameraPermission}>{t('enableCamera') || "Enable Camera"}</Button>
          {errors.camera && <Typography variant="caption" color="error">{errors.camera}</Typography>}
        </CardContent>
      </Card>

      {/* Microphone */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center">
              <MicIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('microphone') || "Microphone"}</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: permissionStatus(permissions.microphone).color }}>{permissionStatus(permissions.microphone).label}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('microphoneDesc')}</Typography>
          <Button variant="contained" size="small" onClick={requestMicrophonePermission}>{t('enableMicrophone') || "Enable Microphone"}</Button>
          {errors.microphone && <Typography variant="caption" color="error">{errors.microphone}</Typography>}
        </CardContent>
      </Card>

      <Divider sx={{ my: 2 }} />
      
      <Button 
        variant="contained" 
        onClick={savePermissions} 
        disabled={loading}
        fullWidth
        sx={{ mt: 2 }}
      >
        {loading ? <CircularProgress size={24} sx={{ mr: 1 }} /> : (t('savePermissions') || 'Save Permissions')}
      </Button>
      {errors.save && <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>{errors.save}</Typography>}
    </Box>
  );
};

export default PermissionsManager;
