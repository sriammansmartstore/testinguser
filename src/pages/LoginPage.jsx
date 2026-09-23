import React, { useState, useEffect } from "react";
import { Box, Typography, TextField, Button, Divider, Alert, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import { auth, db } from "../firebase";
import './LoginPage.css';

// Modern Google 'G' mark as inline SVG to keep crisp rendering
const GoogleGIcon = ({ className }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path fill="#4285F4" d="M46.5 24.5c0-1.5-.1-3-.3-4.5H24v8.5h12.7c-.6 3-2.9 5.4-6 6.9v5.7h9.7c5.7-5.3 8.1-13 8.1-16.6z"/>
    <path fill="#34A853" d="M24 46c6.5 0 11.9-2 15.9-5.4l-9.7-5.7c-2.4 1.6-5.4 2.6-8.9 2.6-6.8 0-12.5-4.6-14.6-10.8H0.8v6.9C4.8 40.9 13.9 46 24 46z"/>
    <path fill="#FBBC05" d="M9.4 28.6C8.9 27 8.6 25.4 8.6 24s.3-3 1-4.6V12.5H0.8C-1.1 16.8-1.1 24 0.8 28.6l8.6-0z"/>
    <path fill="#EA4335" d="M24 9.4c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.5 30.5 0 24 0 13.9 0 4.8 5.1.8 12.5l8.6 6.9C11.5 13.9 17.2 9.4 24 9.4z"/>
  </svg>
);

const LoginPage = () => {
  const [countryCode, setCountryCode] = useState("+91");
  const [number, setNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [resendActive, setResendActive] = useState(false);
  const navigate = useNavigate();

  const flagFor = (cc) => (cc === '+91' ? '🇮🇳' : cc === '+1' ? '🇺🇸' : cc === '+44' ? '🇬🇧' : cc === '+61' ? '🇦🇺' : cc === '+971' ? '🇦🇪' : '🌐');

  useEffect(() => {
    let timer;
    if (otpSent && resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setResendActive(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpSent, resendTimer]);

  const initRecaptcha = async () => {
    try { if (auth && typeof auth.useDeviceLanguage === 'function') auth.useDeviceLanguage(); } catch (_) {}
    if (!window.recaptchaVerifierLogin) {
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container-login', {
        size: 'invisible',
        callback: () => {},
        'expired-callback': () => { setInfo('Security verification expired. Please try again.'); }
      });
      try { await verifier.render(); } catch (_) {}
      window.recaptchaVerifierLogin = verifier;
    }
    return window.recaptchaVerifierLogin;
  };

  const sendOtp = async () => {
    setError("");
    setInfo("");
    setSending(true);
    try {
      if (!number || number.replace(/\D/g, '').length < 6) {
        setError('Please enter a valid phone number.');
        return;
      }
      const verifier = await initRecaptcha();
      const phone = number.startsWith('+') ? number : (countryCode + number);
      const confirmation = await signInWithPhoneNumber(auth, phone, verifier);
      setConfirmationResult(confirmation);
      setOtpSent(true);
      setInfo('OTP sent. Enter the code to login.');
      setResendTimer(30);
      setResendActive(false);
    } catch (err) {
      setError(err?.message || 'Failed to send OTP. Please try again.');
      try { if (window.recaptchaVerifierLogin) { window.recaptchaVerifierLogin.clear(); window.recaptchaVerifierLogin = null; } } catch (_) {}
    } finally { setSending(false); }
  };

  const handleResendOtp = async () => {
    setConfirmationResult(null);
    setOtp('');
    if (window.recaptchaVerifierLogin) {
      try { window.recaptchaVerifierLogin.clear(); } catch (_) {}
      window.recaptchaVerifierLogin = null;
    }
    setResendActive(false);
    setResendTimer(30);
    await sendOtp();
  };

  const verifyOtpAndLogin = async () => {
    if (!confirmationResult) { setError('No OTP request found.'); return; }
    setVerifying(true);
    setError("");
    try {
      const result = await confirmationResult.confirm(otp);
      const user = result.user;
      const userDocId = await ensureUserDocId(user.uid, user.email || null);
      await setDoc(doc(db, 'users', userDocId), {
        uid: user.uid,
        userId: userDocId,
        number: number.replace(/\D/g, ''),
        countryCode,
        phoneVerified: true,
        email: user.email || null
      }, { merge: true });
      await handlePostLogin(user);
    } catch (err) {
      setError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getRedirectResult(auth)
      .then(async (result) => {
        if (isMounted && result && result.user) {
          await handlePostLogin(result.user);
        }
      })
      .catch((err) => {
        console.error("Redirect login error:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleGoogleLogin = async () => {
    setError("");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      await handlePostLogin(result.user);
    } catch (err) {
      console.error("Google login error:", err);
      if (err?.code === 'auth/unauthorized-domain') {
        setError("This domain is not authorized in Firebase Console (Authentication -> Settings -> Authorized Domains).");
      } else if (err?.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          console.error("Redirect fallback error:", redirectErr);
          setError("Browser blocked the login popup and redirect. Please enable popups or redirects in your browser settings.");
        }
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setError("Login popup was closed before completion.");
      } else {
        setError(err?.message || "Google login failed.");
      }
    }
  };

  const ensureUserDocId = async (uid, email) => {
    const mapRef = doc(db, 'usersByUid', uid);
    const mapSnap = await getDoc(mapRef);
    if (mapSnap.exists() && mapSnap.data()?.userDocId) {
      return mapSnap.data().userDocId;
    }
    // allocate new sequential id
    const seqRef = doc(db, 'meta', 'userSequence');
    const nextId = await runTransaction(db, async (tx) => {
      const seqSnap = await tx.get(seqRef);
      const curr = seqSnap.exists() ? (seqSnap.data().current || 0) : 0;
      const updated = curr + 1;
      tx.set(seqRef, { current: updated }, { merge: true });
      return updated;
    });
    const userDocId = `SASS${String(nextId).padStart(7, '0')}`;
    await setDoc(doc(db, 'users', userDocId), { uid, email: email || null, userId: userDocId }, { merge: true });
    await setDoc(mapRef, { userDocId, uid }, { merge: true });
    return userDocId;
  };

  const handlePostLogin = async (user) => {
    // Resolve custom doc id
    const userDocId = await ensureUserDocId(user.uid, user.email || null);
    const userRef = doc(db, 'users', userDocId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists() || !userSnap.data().fullName || !userSnap.data().number || !userSnap.data().gender || !userSnap.data().dob) {
      await setDoc(userRef, { email: user.email || null, uid: user.uid, userId: userDocId }, { merge: true });
      navigate("/userdata");
    } else {
      navigate("/");
    }
  };

  return (
    <Box className="login-root">
      <Box className="login-box" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="h5" className="login-title">Welcome Back</Typography>
        {(error || info) && (
          <Alert severity={error ? 'error' : 'info'} sx={{ mb: 2 }}>{error || info}</Alert>
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            label="Code"
            value={countryCode}
            onChange={e => setCountryCode(e.target.value)}
            size="small"
            sx={{ width: 110, '& .MuiOutlinedInput-root': { borderRadius: 2, height: 44 } }}
            InputProps={{
              className: 'login-input',
              startAdornment: <Box sx={{ mr: 1 }}>{flagFor(countryCode)}</Box>
            }}
            disabled={otpSent}
          />
          <TextField 
            label="Phone Number" 
            placeholder="Enter your phone number" 
            variant="outlined" 
            fullWidth 
            size="small"
            value={number} 
            onChange={e => setNumber(e.target.value.replace(/\D/g, ''))} 
            InputProps={{ className: 'login-input' }} 
            disabled={otpSent}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: 44 } }}
          />
        </Box>
        {otpSent && (
          <TextField label="Enter OTP" placeholder="6-digit code" variant="outlined" fullWidth margin="normal" value={otp} onChange={e => setOtp(e.target.value)} inputProps={{ maxLength: 6 }} />
        )}
        {!otpSent ? (
          <Button variant="contained" className="login-btn" fullWidth onClick={sendOtp} disabled={sending}>
            {sending ? <><CircularProgress size={20} sx={{ mr: 1 }} /> Sending...</> : 'Send OTP'}
          </Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button variant="contained" className="login-btn" fullWidth onClick={verifyOtpAndLogin} disabled={verifying || !otp}>{verifying ? <CircularProgress size={20} /> : 'Verify & Login'}</Button>
            <Button variant="outlined" onClick={handleResendOtp} disabled={!resendActive}>{resendActive ? 'Resend OTP' : `Resend (${resendTimer}s)`}</Button>
          </Box>
        )}
        <Box id="recaptcha-container-login" style={{ display: 'none' }} />
        <Divider className="login-divider">OR</Divider>
        <Button variant="outlined" className="login-google-btn" fullWidth onClick={handleGoogleLogin}>
          <Box className="login-google-icon">
            <GoogleGIcon className="login-google-icon-svg" />
          </Box>
          <Box sx={{ textTransform: 'none', fontWeight: 700 }}>Login with Google</Box>
        </Button>
        <Typography className="switch-link" onClick={() => navigate("/signup")}>Don't have an account? Sign Up</Typography>
      </Box>
    </Box>
  );
};
export default LoginPage;
