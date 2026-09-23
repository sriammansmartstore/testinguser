import React, { useContext, useState, useEffect } from "react";
import { Box, Typography, TextField, Button, MenuItem, CircularProgress, Alert } from "@mui/material";
import { RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider, linkWithCredential } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { AuthContext } from "../context/AuthContext";
import { doc, setDoc, getDoc, runTransaction, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";

const genders = ["Male", "Female", "Other"];

const countryCodes = [
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+61", label: "🇦🇺 +61" },
  { code: "+971", label: "🇦🇪 +971" },
  // Add more as needed
];

const UserDataPage = ({ editMode = false, onSave }) => {
  const { user, userDetails } = useContext(AuthContext);
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [number, setNumber] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [inlineMessage, setInlineMessage] = useState(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verificationId, setVerificationId] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [resendActive, setResendActive] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [userId, setUserId] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    // Use device/browser language for reCAPTCHA & SMS localization
    try {
      if (auth && typeof auth.useDeviceLanguage === 'function') {
        auth.useDeviceLanguage();
      }
    } catch (e) {
      // ignore if auth doesn't expose useDeviceLanguage
    }
    // If user signed in via phone provider, auto-mark as verified and prefill phone
    try {
      const hasPhoneProvider = Array.isArray(user?.providerData) && user.providerData.some(p => p.providerId === 'phone');
      if (hasPhoneProvider) {
        const phone = user?.phoneNumber || '';
        if (phone.startsWith('+')) {
          // naive split: take country code up to next digits
          const match = phone.match(/^(\+\d{1,4})(\d*)$/);
          if (match) {
            setCountryCode(match[1]);
            setNumber(match[2]);
          } else {
            setNumber(phone.replace(/\D/g, ''));
          }
        } else if (phone) {
          setNumber(phone.replace(/\D/g, ''));
        }
        setPhoneVerified(true);
      }
    } catch (_) {}
    if (userDetails) {
      setFullName(userDetails.fullName || "");
      setCountryCode(userDetails.countryCode || "+91");
      setNumber(userDetails.number || "");
      setGender(userDetails.gender || "");
      setDob(userDetails.dob || "");
      setPhoneVerified(!!userDetails.phoneVerified); // If previously verified, skip OTP
      setReferralCode(userDetails.referredBy || "");
      setUserId(userDetails.userId || "");
    }
    setLoading(false);
  }, [user, userDetails]);

  // OTP logic
  const sendOtp = async () => {
    try {
      if (!number || number.length < 6) {
        setInlineMessage({ type: 'error', text: 'Please enter a valid mobile number.' });
        return;
      }
      const fullPhone = number.startsWith('+') ? number : (countryCode + number);
      console.log('[UserDataPage] sendOtp requested for', fullPhone);
      let verifier = recaptchaVerifier || window.recaptchaVerifier;
      // If an existing global verifier exists, reuse it. Otherwise create a new one.
      if (!verifier) {
        console.log('[UserDataPage] Creating new RecaptchaVerifier');
        // Attach invisible reCAPTCHA to a hidden container (background/invisible)
        // Hidden container has id="recaptcha-container" in the JSX below
        verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {},
          'expired-callback': () => {
            console.warn('[UserDataPage] reCAPTCHA expired');
            setInlineMessage({ type: 'warning', text: 'Security verification expired. Please try again.' });
          }
        });
        // attach to window so subsequent calls can reuse/clear it
        window.recaptchaVerifier = verifier;
        setRecaptchaVerifier(verifier);
        try {
          const widgetId = await verifier.render();
          console.log('[UserDataPage] reCAPTCHA rendered, widgetId=', widgetId);
        } catch (e) {
          console.warn('[UserDataPage] reCAPTCHA render failed', e);
        }
      } else {
        console.log('[UserDataPage] Reusing existing RecaptchaVerifier');
      }
      setInlineMessage({ type: 'info', text: 'Sending OTP...' });
      let confirmation;
      try {
        confirmation = await signInWithPhoneNumber(auth, fullPhone, verifier);
      } catch (err) {
        console.error('OTP send failed:', err, err?.message, err?.code);
        // If invalid-app-credential, provide actionable guidance
        if (err?.code === 'auth/invalid-app-credential') {
          setInlineMessage({ type: 'error', text: 'OTP send failed: security verification failed (invalid app credential).\nPlease ensure your domain is added to Firebase Auth authorized domains and reCAPTCHA is loading correctly.' });
        } else {
          let errorMsg = 'Failed to send OTP. Please try again.';
          if (err?.message) errorMsg += `\n${err.message}`;
          if (err?.code) errorMsg += `\nError code: ${err.code}`;
          setInlineMessage({ type: 'error', text: errorMsg });
        }
        // Reset verifier so user can retry with a fresh widget
        try { if (window.recaptchaVerifier) { window.recaptchaVerifier.clear(); window.recaptchaVerifier = null; } } catch (e) {}
        setRecaptchaVerifier(null);
        return;
      }
      setConfirmationResult(confirmation);
      setVerificationId(confirmation?.verificationId || null);
      setOtpSent(true);
      setInlineMessage({ type: 'info', text: 'OTP sent. Enter the code to verify.' });
      setResendTimer(30);
      setResendActive(false);
    } catch (err) {
      console.error('OTP send outer catch failed:', err);
      setInlineMessage({ type: 'error', text: 'Failed to send OTP due to an unexpected error.' });
    }
  };

  // Timer effect for resend OTP
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

  const handleResendOtp = () => {
    console.log('[UserDataPage] Resend requested');
    // Clear previous confirmation and create a fresh recaptcha on retry
    setConfirmationResult(null);
    setVerificationId(null);
    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch (e) { console.warn('Failed to clear recaptcha', e); }
      window.recaptchaVerifier = null;
    }
    setRecaptchaVerifier(null);
    setOtp('');
    // Slight delay to ensure old verifier is cleared
    setTimeout(() => {
      sendOtp();
      setResendTimer(30);
      setResendActive(false);
    }, 250);
  };

  const verifyOtp = async () => {
    if (!confirmationResult && !verificationId) {
      setInlineMessage({ type: 'error', text: 'No OTP request found.' });
      return;
    }
    setVerifying(true);
    try {
      const vid = verificationId || confirmationResult?.verificationId;
      if (!vid) throw new Error('Missing verification id');
      const credential = PhoneAuthProvider.credential(vid, otp);
      if (auth && auth.currentUser) {
        await linkWithCredential(auth.currentUser, credential);
      } else {
        await confirmationResult.confirm(otp);
      }
      setPhoneVerified(true);
      setInlineMessage(null);
      if (recaptchaVerifier) {
        try { recaptchaVerifier.clear(); } catch (e) {}
        setRecaptchaVerifier(null);
      }
    } catch (err) {
      console.error('OTP verification failed:', err, err?.message, err?.code);
      let errorMsg = 'Verification failed. Please check the OTP and try again.';
      if (err?.message) errorMsg += `\n${err.message}`;
      if (err?.code) errorMsg += `\nError code: ${err.code}`;
      setInlineMessage({ type: 'error', text: errorMsg });
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async () => {
    const cc = countryCode;
    // Resolve mapping first
    const mapRef = doc(db, 'usersByUid', user.uid);
    const mapSnap = await getDoc(mapRef);
    let currentUserId = mapSnap.exists() ? (mapSnap.data().userDocId || "") : "";

    // Generate sequential userId if missing: SASS0000001, SASS0000002, ...
    if (!currentUserId) {
      const seqRef = doc(db, 'meta', 'userSequence');
      const nextId = await runTransaction(db, async (tx) => {
        const seqSnap = await tx.get(seqRef);
        const curr = seqSnap.exists() ? (seqSnap.data().current || 0) : 0;
        const updated = curr + 1;
        tx.set(seqRef, { current: updated }, { merge: true });
        return updated;
      });
      const pad = String(nextId).padStart(7, '0');
      currentUserId = `SASS${pad}`;
    }

    // Validate referral code if provided and not already set
    let updates = {
      fullName,
      countryCode: cc,
      number,
      gender,
      dob,
      email: user.email,
      uid: user.uid,
      phoneVerified: true,
      userId: currentUserId,
    };

    const enteredCode = (referralCode || "").trim().toUpperCase();
    // Fetch existing referred on the target user doc if needed
    let existingReferred = "";
    if (currentUserId) {
      const existingSnap = await getDoc(doc(db, 'users', currentUserId));
      existingReferred = existingSnap.exists() ? (existingSnap.data().referredBy || "") : "";
    }
    if (enteredCode && !existingReferred && enteredCode !== currentUserId) {
      // Find referring user by userId
      const q = query(collection(db, 'users'), where('userId', '==', enteredCode));
      const qs = await getDocs(q);
      if (!qs.empty) {
        const refDoc = qs.docs[0];
        updates.referredBy = enteredCode;
        updates.referredAt = serverTimestamp();
        // Also add this user under referrer's subcollection 'refferals'
        try {
          await setDoc(
            doc(db, 'users', enteredCode, 'refferals', currentUserId),
            { uid: user.uid, userId: currentUserId, referredAt: serverTimestamp() },
            { merge: true }
          );
        } catch (_) {}
      }
    }
    const targetRef = doc(db, 'users', currentUserId);
    await setDoc(targetRef, updates, { merge: true });
    // Ensure mapping exists
    await setDoc(mapRef, { userDocId: currentUserId, uid: user.uid }, { merge: true });
    setSuccess(true);
    if (onSave) onSave();
    if (!editMode) navigate("/");
  };

  if (loading) return null;

  return (
    <Box sx={{ maxWidth: 400, mx: "auto", mt: 0, p: 3, background: "#fff", borderRadius: 4, boxShadow: '0 4px 16px rgba(67,160,71,0.10)' }}>
      <Typography variant="h5" color="primary" fontWeight={700} mb={2}>{editMode ? "Edit Account Details" : "Complete Your Profile"}</Typography>
      <TextField label="Full Name" variant="outlined" fullWidth margin="normal" value={fullName} onChange={e => setFullName(e.target.value)} />

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1, mb: 1 }}>
        <TextField
          select
          label="Code"
          value={countryCode}
          onChange={e => setCountryCode(e.target.value)}
          sx={{ minWidth: 100 }}
        >
          {countryCodes.map(opt => (
            <MenuItem key={opt.code} value={opt.code}>{opt.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Phone Number"
          variant="outlined"
          fullWidth
          value={number}
          onChange={e => setNumber(e.target.value.replace(/\D/g, ''))}
          inputProps={{ maxLength: 15 }}
          disabled={phoneVerified}
        />
      </Box>
      {/* OTP Verification Section */}
      {!phoneVerified && (
        <Box>
          {otpSent && (
            <TextField
              label="Enter OTP"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              fullWidth
              variant="outlined"
              disabled={verifying || phoneVerified}
              placeholder="Enter 6-digit OTP"
              inputProps={{ maxLength: 6 }}
              sx={{ mb: 2 }}
            />
          )}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            {!otpSent ? (
              <Button
                variant="contained"
                id="send-otp-button"
                onClick={sendOtp}
                disabled={loading || !number || phoneVerified}
              >
                {loading ? <CircularProgress size={20} /> : 'Send OTP'}
              </Button>
            ) : (
              <>
                <Button
                  variant="contained"
                  onClick={verifyOtp}
                  disabled={verifying || !otp || phoneVerified}
                >
                  {verifying ? <CircularProgress size={20} /> : 'Verify OTP'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleResendOtp}
                  disabled={!resendActive}
                >
                  {resendActive ? 'Resend OTP' : `Resend OTP (${resendTimer}s)`}
                </Button>
              </>
            )}
          </Box>
          <Box id="recaptcha-container" sx={{ display: 'none' }} />
        </Box>
      )}
      {inlineMessage && inlineMessage.type !== 'success' && (
        <Alert severity={inlineMessage.type} sx={{ mt: 2 }}>{inlineMessage.text}</Alert>
      )}
      {phoneVerified && (
        <Alert severity="success" sx={{ mt: 2 }}>Phone number verified!</Alert>
      )}
      {/* Referral Code (optional) */}
      <TextField
        label="Referral Code (optional)"
        variant="outlined"
        fullWidth
        margin="normal"
        value={referralCode}
        onChange={e => setReferralCode(e.target.value.replace(/\s/g,'').toUpperCase())}
        placeholder="Enter code like SASS0000001"
        helperText="Enter the referral code of the person who invited you"
        disabled={Boolean(userDetails?.referredBy)}
      />
      <TextField select label="Gender" variant="outlined" fullWidth margin="normal" value={gender} onChange={e => setGender(e.target.value)}>
        {genders.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
      </TextField>
      <TextField label="Date of Birth" type="date" variant="outlined" fullWidth margin="normal" value={dob} onChange={e => setDob(e.target.value)} InputLabelProps={{ shrink: true }} />
      <Button variant="contained" color="primary" fullWidth sx={{ mt: 2 }} onClick={handleSubmit}>{editMode ? "Save Changes" : "Save & Continue"}</Button>
      {success && <Typography color="success.main" mt={2} align="center">Profile updated successfully!</Typography>}
    </Box>
  );
};
export default UserDataPage;
