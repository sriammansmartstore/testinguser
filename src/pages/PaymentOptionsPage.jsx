import React, { useState, useEffect } from "react";
import { Box, Typography, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Card, CardContent, Link, Alert, Divider, Radio, RadioGroup, FormControlLabel, FormControl } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";

import { useNotification } from '../components/NotificationProvider';
import CreditCardIcon from "@mui/icons-material/CreditCard";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
import QrCode2Icon from '@mui/icons-material/QrCode2';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useNavigate, useLocation, Link as RouterLink } from "react-router-dom";
import './PaymentOptionsPage.css';
import { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp, updateDoc, getDoc, runTransaction, onSnapshot, increment } from "firebase/firestore";
import { db } from '../firebase';
import { auth } from '../firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider, linkWithCredential } from 'firebase/auth';
import OrderSuccessAnimation from '../animations/OrderSuccessAnimation';
import ClearIcon from '@mui/icons-material/Clear';

const paymentOptions = [
  { id: 'upi', name: 'UPI', icon: <QrCode2Icon fontSize="small" color="action" />, type: 'upi', subtitle: 'Pay via UPI apps (GPay, PhonePe, BHIM, etc.)' },
  { id: 'netbanking', name: 'Netbanking', icon: <AccountBalanceIcon fontSize="small" color="action" />, type: 'netbanking', subtitle: 'Pay using your internet banking' },
  { id: 'card', name: 'Cards', icon: <CreditCardIcon fontSize="small" color="action" />, type: 'card', subtitle: 'Pay with credit/debit cards' },
  { id: 'wallet', name: 'Wallet', icon: <AccountBalanceWalletIcon fontSize="small" color="action" />, type: 'wallet', subtitle: 'Pay with popular wallets' },
  { id: 'cod', name: 'Cash on Delivery', icon: <CurrencyRupeeIcon fontSize="small" color="success" />, type: 'cod', subtitle: 'Pay with cash on delivery' },
];

const PaymentOptionsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useNotification() || { notify: () => {} };
  
  // Get order details from location.state (passed from checkout)
  const orderSummary = location.state?.orderSummary || {
    items: [],
    total: 0,
  };
  const selectedAddress = location.state?.selectedAddress || null;
  const userProfile = location.state?.userProfile || null;
  const cartItems = location.state?.cartItems || [];
  const gstDetails = location.state?.gstDetails || null;
  const claimGST = location.state?.claimGST || false;
  // Prefer deliveryCharge sent from Cart, but recompute from baseTotal to avoid mismatch when promos set item total to 0
  const baseTotal = typeof location.state?.baseTotal === 'number' ? Number(location.state.baseTotal) : (Number(orderSummary.total || 0) + Number(orderSummary.discount || 0));
  const storedDeliveryCharge = typeof location.state?.deliveryCharge === 'number' ? Number(location.state.deliveryCharge) : null;
  // determine delivery option: prefer the value passed from Cart (location.state), fall back to localStorage
  let deliveryOptionRaw = typeof location.state?.deliveryOption === 'string' ? location.state.deliveryOption : null;
  if (!deliveryOptionRaw) {
    try {
      const stored = localStorage.getItem('deliveryOption');
      if (stored === 'standard' || stored === 'express' || stored === 'fast') {
        deliveryOptionRaw = stored === 'fast' ? 'express' : stored;
      }
    } catch (_) {}
  }
  const deliveryOption = deliveryOptionRaw || 'standard';
  const computedDeliveryCharge = deliveryOption === 'standard' ? (baseTotal > 500 ? 0 : 49) : (baseTotal > 2000 ? 0 : 99);
  const deliveryCharge = storedDeliveryCharge !== null ? storedDeliveryCharge : computedDeliveryCharge;

  const finalAmount = typeof location.state?.finalAmount !== 'undefined' ? Number(location.state.finalAmount) : (Number(orderSummary.total || 0) + Number(deliveryCharge || 0));

  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMsg, setDialogMsg] = useState("");
  const [latestOrderId, setLatestOrderId] = useState(null);

  const [phone, setPhone] = useState(userProfile?.number || "");
  const [countryCode, setCountryCode] = useState("+91");
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verificationId, setVerificationId] = useState(null);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [inlineMessage, setInlineMessage] = useState(null);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [lastRequestedPhone, setLastRequestedPhone] = useState(null);
  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState('cod');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTitle, setSuccessTitle] = useState('Order Confirmed!');
  const [successSubtitle, setSuccessSubtitle] = useState('Thank you for your purchase.');

  // Coins usage state
  const [coinValue, setCoinValue] = useState(0); // rupees per coin
  const [availableCoins, setAvailableCoins] = useState(0);
  const [coinsToUse, setCoinsToUse] = useState('');
  const [coinsError, setCoinsError] = useState(null);
  const [showCoins, setShowCoins] = useState(false);

  // Fetch CoinValue from Firestore: Settings/CoinValue (field CoinValue as string)
  useEffect(() => {
    let unsub = null;
    try {
      const ref = doc(db, 'Settings', 'CoinValue');
      unsub = onSnapshot(ref, (snap) => {
        const data = snap.exists() ? (snap.data() || {}) : {};
        // Support multiple field names: CoinValue, value, text
        const raw = (data.CoinValue ?? data.value ?? data.text ?? '0');
        // Trim and normalize
        const str = String(raw).trim();
        // Parse decimal/number; allow comma decimal by replacing comma with dot
        const parsed = parseFloat(str.replace(',', '.'));
        console.log('[Coins][Settings/CoinValue] doc:', data, 'raw:', raw, 'string:', str, 'parsed:', parsed);
        setCoinValue(Number.isFinite(parsed) ? parsed : 0);
      });
    } catch (_) {}
    return () => { if (unsub) unsub(); };
  }, []);

  // Fetch availableCoins for the user
  useEffect(() => {
    let unsub = null;
    (async () => {
      try {
        const uid = (userProfile && (userProfile.uid || userProfile.userUid)) || (auth && auth.currentUser ? auth.currentUser.uid : null);
        if (!uid) return;
        const mapSnap = await getDoc(doc(db, 'usersByUid', uid));
        const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || uid) : uid;
        const userRef = doc(db, 'users', userDocId);
        unsub = onSnapshot(userRef, (snap) => {
          const d = snap.exists() ? snap.data() : {};
          const avail = Number((d.availableCoins ?? d.availableCoins32) || 0);
          console.log('[Coins][users] availableCoins snapshot:', { userDocId, data: d, parsed: avail });
          setAvailableCoins(isNaN(avail) ? 0 : avail);
        });
      } catch (_) {}
    })();
    return () => { if (unsub) unsub(); };
  }, [userProfile]);

  // Derived amounts
  const preCoinsTotal = Number(finalAmount || 0);
  const maxCoinsByMoney = coinValue > 0 ? Math.floor(preCoinsTotal / coinValue) : 0;
  const maxUsableCoins = Math.max(0, Math.min(availableCoins, maxCoinsByMoney));
  const coinsToUseNum = Math.max(0, parseInt(coinsToUse, 10) || 0);
  const safeCoinsToUse = Math.max(0, Math.min(coinsToUseNum, maxUsableCoins));
  const coinsDiscount = Number((safeCoinsToUse * coinValue).toFixed(2));
  const payableAmount = Math.max(0, Number((preCoinsTotal - coinsDiscount).toFixed(2)));

  useEffect(() => {
    // Validate entry
    if (coinsToUseNum > availableCoins) {
      setCoinsError('Exceeds available coins');
    } else if (coinsToUseNum > maxCoinsByMoney) {
      setCoinsError('Exceeds payable limit');
    } else {
      setCoinsError(null);
    }
    console.log('[Coins][calc] coinValue=', coinValue, 'availableCoins=', availableCoins, 'coinsToUse(raw)=', coinsToUse, 'coinsToUseNum=', coinsToUseNum, 'maxByMoney=', maxCoinsByMoney, 'safeCoinsToUse=', safeCoinsToUse, 'discount=', coinsDiscount, 'preTotal=', preCoinsTotal, 'payable=', payableAmount);
  }, [coinsToUse, coinsToUseNum, availableCoins, maxCoinsByMoney]);

  useEffect(() => {
    console.log('[Coins][derived] preCoinsTotal=', preCoinsTotal, 'coinValue=', coinValue, 'maxUsableCoins=', maxUsableCoins, 'safeCoinsToUse=', safeCoinsToUse, 'coinsDiscount=', coinsDiscount, 'payableAmount=', payableAmount);
  }, [preCoinsTotal, coinValue, maxUsableCoins, safeCoinsToUse, coinsDiscount, payableAmount]);

  // Ensure the page starts at the top when opened from Checkout
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      // Fallbacks for some browsers
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    } catch (_) {}
  }, []);

  // Derive a display phone number for the verified banner from the most reliable sources
  const displayVerifiedNumber = (
    verifiedPhoneNumber ||
    (auth && auth.currentUser ? auth.currentUser.phoneNumber : null) ||
    (phoneVerified ? (phone?.startsWith('+') ? phone : (countryCode + (phone || ''))) : null) ||
    userProfile?.number ||
    ''
  );

  // If the signed-in user already has a phone credential, treat as verified
  useEffect(() => {
    try {
      if (auth && auth.currentUser) {
        const currentPhone = auth.currentUser.phoneNumber || null;
        const providerPhone = (auth.currentUser.providerData || []).find(p => p.providerId === 'phone');
        if (currentPhone || providerPhone) {
          const existingVerifiedPhone = currentPhone || providerPhone?.phoneNumber || userProfile?.number;
          setPhoneVerified(true);
          setVerifiedPhoneNumber(existingVerifiedPhone); // Store the verified phone
          setPhone(existingVerifiedPhone || ''); // Set the phone field to show the verified number
          setInlineMessage(null);
          setShowPaymentOptions(true);
          setEditingPhone(false);
        } else {
          // No phone verification found, allow user to verify
          setPhoneVerified(false);
          setEditingPhone(true);
          setShowPaymentOptions(false);
        }
      } else {
        // No user signed in, allow phone verification
        setPhoneVerified(false);
        setEditingPhone(true);
        setShowPaymentOptions(false);
      }
    } catch (e) {
      console.debug('Phone verification check failed', e);
      // On error, allow phone verification
      setPhoneVerified(false);
      setEditingPhone(true);
      setShowPaymentOptions(false);
    }
  }, []);

  // Show payment options when phone is verified
  useEffect(() => {
    if (phoneVerified) {
      setShowPaymentOptions(true);
      setEditingPhone(false);
    }
  }, [phoneVerified]);

  // Cleanup function to clear recaptcha on unmount
  useEffect(() => {
    return () => {
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (e) {
          console.debug('Error clearing recaptcha on unmount:', e);
        }
      }
    };
  }, [recaptchaVerifier]);

  // Reset transient flags when switching payment method
  useEffect(() => {
    // Ensure the action button never remains stuck after switching methods
    if (loading) setLoading(false);
  }, [selectedPayment]);

  // Save order to Firestore
  const saveOrder = async (paymentMethod, paymentStatus, razorpayDetails = null) => {
    setLoading(true);
    const db = getFirestore();
    try {
      const newOrderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      // Resolve authenticated UID reliably (accept many possible fields)
      const resolvedUid = (
        (userProfile && (userProfile.uid || userProfile.userUid || userProfile.userId || userProfile.id || userProfile.SASSid || userProfile.sassId || userProfile.sass_id))
        || (auth && auth.currentUser ? auth.currentUser.uid : null)
      );

      const finalPhoneNumber = verifiedPhoneNumber || (phoneVerified ? (countryCode + phone) : null) || userProfile?.number;
      const deliveryMethod = (deliveryOption === 'express') ? 'express' : 'standard';

      // Resolve users/{userDocId} mapping (SASS id) if possible
      let resolvedUserDocId = null;
      try {
        if (resolvedUid) {
          const mapSnapEarly = await getDoc(doc(db, 'usersByUid', resolvedUid));
          if (mapSnapEarly.exists()) {
            resolvedUserDocId = mapSnapEarly.data()?.userDocId || mapSnapEarly.data()?.userId || mapSnapEarly.data()?.id || resolvedUid;
          } else {
            resolvedUserDocId = userProfile?.userDocId || userProfile?.userId || userProfile?.id || userProfile?.SASSid || userProfile?.sassId || resolvedUid;
          }
        } else {
          resolvedUserDocId = userProfile?.userDocId || userProfile?.userId || userProfile?.id || userProfile?.SASSid || userProfile?.sassId || null;
        }
      } catch (e) {
        console.debug('Failed to resolve usersByUid mapping early:', e);
        resolvedUserDocId = userProfile?.userDocId || userProfile?.userId || userProfile?.id || userProfile?.SASSid || userProfile?.sassId || resolvedUid;
      }

      const updatedUserProfile = {
        ...userProfile,
        uid: resolvedUid || userProfile?.uid || null,
        userDocId: resolvedUserDocId || userProfile?.userDocId || userProfile?.userId || userProfile?.id || null,
        number: finalPhoneNumber
      };

      // Resolve referrer (if any) from the user's document so we can store it on the order
      let resolvedReferrerId = null;
      try {
        const buyerDocIdForRef = resolvedUserDocId || null;
        if (buyerDocIdForRef) {
          const buyerSnapForRef = await getDoc(doc(db, 'users', buyerDocIdForRef));
          if (buyerSnapForRef.exists()) {
            resolvedReferrerId = buyerSnapForRef.data()?.referredBy || null;
          }
        }
      } catch (e) {
        console.debug('Failed to resolve referrer for order:', e);
        resolvedReferrerId = null;
      }

      // compute subtotal and totals
      const subtotal = Number(orderSummary.total || 0) + Number(orderSummary.discount || 0);
      const deliveryFee = Number(deliveryCharge || 0);
      const baseFinal = Number(typeof location.state?.finalAmount !== 'undefined' ? location.state.finalAmount : (Number(orderSummary.total || 0) + deliveryFee));
      const finalTotal = Math.max(0, Number((baseFinal - coinsDiscount).toFixed(2)));

      const orderData = {
        orderId: newOrderId,
        userProfile: updatedUserProfile,
        buyerUid: resolvedUid || null,
        buyerId: resolvedUserDocId || null,
        referrerId: resolvedReferrerId || null,
        address: selectedAddress,
        cartItems,
        subtotal,
        discount: Number(orderSummary.discount || 0),
        promo: orderSummary.promo || null,
        deliveryFee,
        total: finalTotal,
        paymentMethod,
        paymentStatus,
        razorpayDetails,
        deliveryMethod,
        verifiedPhoneNumber,
        gstDetails: claimGST ? gstDetails : null,
        claimGST,
        coinsApplied: safeCoinsToUse > 0,
        usedCoins: safeCoinsToUse,
        coinValue,
        coinsDiscount,
        createdAt: serverTimestamp(),
        status: 'Pending'
      };

      // write main orders collection
      const ref = await addDoc(collection(db, 'orders'), orderData);

      // duplicate under users/{userDocId}/orders when possible
      try {
        const userDocId = resolvedUserDocId || resolvedUid;
        if (userDocId) {
          await setDoc(doc(db, 'users', userDocId, 'orders', ref.id), { id: ref.id, ...orderData }, { merge: true });
          console.debug('[Orders] duplicated order to users/{id}/orders with id=', ref.id, 'userDocId=', userDocId);
        }
      } catch (e) {
        console.error('Failed to write user subcollection order copy', e);
      }

      // Deduct used coins and grant referral/self coins atomically (buyer + referrer when applicable)
      try {
  // Award coins only for the product amount (exclude delivery charges) — use subtotal (pre-promo total)
  const coinAmount = Math.round(Number(subtotal || 0));
  const buyerId = resolvedUserDocId || resolvedUid;
  const buyerUid = resolvedUid || null;
  const buyerName = updatedUserProfile?.fullName || updatedUserProfile?.name || userProfile?.fullName || userProfile?.name || (auth && auth.currentUser ? auth.currentUser.displayName : null) || null;
  console.log('[Coins][order] applying coins:', { safeCoinsToUse, coinValue, coinsDiscount, coinAmount, buyerId, subtotal });

        if (buyerId) {
          let coinsDeducted = false;
          await runTransaction(db, async (transaction) => {
            const buyerDocRef = doc(db, 'users', buyerId);
            const buyerCoinRef = doc(db, 'users', buyerId, 'coinsHistory', orderData.orderId);

            // Read required docs first (Firestore requires all reads before writes in a transaction)
            const buyerDocSnap = await transaction.get(buyerDocRef);
            const existingBuyerCoin = coinAmount > 0 ? await transaction.get(buyerCoinRef) : null;

            // Derive the buyer's display name from the freshest source available (transaction read wins)
            const resolvedBuyerName = buyerName || (buyerDocSnap.exists() ? (buyerDocSnap.data()?.fullName || buyerDocSnap.data()?.name || buyerDocSnap.data()?.displayName) : null) || null;

            // Read any referrer coin doc BEFORE any writes
            const referrerId = buyerDocSnap.exists() ? (buyerDocSnap.data()?.referredBy || null) : null;
            let existingRefCoin = null;
            const referrerDocRef = referrerId ? doc(db, 'users', referrerId) : null;
            const referrerCoinRef = referrerId ? doc(db, 'users', referrerId, 'coinsHistory', `${orderData.orderId}_ref`) : null;
            if (coinAmount > 0 && referrerId && referrerCoinRef) {
              existingRefCoin = await transaction.get(referrerCoinRef);
            }

            // All reads are done above. Now perform writes.
            if (safeCoinsToUse > 0) {
              const currentAvail = Number((buyerDocSnap.exists() ? (buyerDocSnap.data()?.availableCoins ?? buyerDocSnap.data()?.availableCoins32) : availableCoins) || 0);
              const newAvail = Math.max(0, currentAvail - safeCoinsToUse);
              console.log('[Coins][tx] deducting coins', { currentAvail, safeCoinsToUse, newAvail, buyerId });
              transaction.set(buyerDocRef, { availableCoins: newAvail }, { merge: true });
              coinsDeducted = true;
            }

            const referAndEarnRef = doc(db, 'refer and earn', orderData.orderId);

            // Now perform writes based on reads
            if (coinAmount > 0 && existingBuyerCoin && !existingBuyerCoin.exists()) {
              transaction.set(buyerCoinRef, {
                id: orderData.orderId,
                amount: coinAmount,
                type: 'self',
                status: 'pending',
                orderAmount: coinAmount,
                orderId: orderData.orderId,
                buyerName: resolvedBuyerName,
                buyerUid: buyerUid || null,
                createdAt: serverTimestamp(),
                releasedAt: null,
                referralOf: null,
                idempotencyKey: `${orderData.orderId}:self`
              }, { merge: true });
            }

            if (coinAmount > 0 && referrerId && referrerId !== buyerId && referrerCoinRef && existingRefCoin && !existingRefCoin.exists()) {
              transaction.set(referrerCoinRef, {
                id: `${orderData.orderId}_ref`,
                amount: coinAmount,
                type: 'referral',
                status: 'pending',
                orderAmount: coinAmount,
                orderId: orderData.orderId,
                buyerName: resolvedBuyerName,
                buyerUid: buyerUid || null,
                referralOf: buyerId,
                createdAt: serverTimestamp(),
                releasedAt: null,
                idempotencyKey: `${orderData.orderId}:ref`
              }, { merge: true });
              // Record referral relationship under referrer's subcollection
              transaction.set(doc(db, 'users', referrerId, 'refferals', buyerId), {
                uid: buyerUid || null,
                userId: buyerId,
                referredAt: serverTimestamp()
              }, { merge: true });
            }

            // Central refer-and-earn tracking doc (idempotent)
            transaction.set(referAndEarnRef, {
              orderId: orderData.orderId,
              buyerId,
              buyerUid,
              amount: coinAmount,
              createdAt: serverTimestamp()
            }, { merge: true });
          });

          // Fallback: if somehow not deducted in transaction, decrement with atomic increment
          if (!coinsDeducted && safeCoinsToUse > 0) {
            try {
              const buyerDocRef = doc(db, 'users', buyerId);
              console.log('[Coins][fallback] decrementing with increment()', { safeCoinsToUse, buyerId });
              await updateDoc(buyerDocRef, { availableCoins: increment(-safeCoinsToUse) });
            } catch (e) {
              console.error('[Coins][fallback] failed to decrement availableCoins:', e);
            }
          }
        }
      } catch (e) {
        console.error('[ReferralCoins] Failed to grant referral coins:', e);
      }

      // expire promo if requested
      try {
        const promo = orderData.promo;
        const expireOnUse = promo && (promo.expireOnUse || promo.raw?.expireOnUse);
        if (promo && promo.id && expireOnUse) {
          const promoRef = doc(db, 'promos', promo.id);
          await updateDoc(promoRef, { isExpired: true });
        }
      } catch (e) {
        console.error('Failed to mark promo as expired:', e);
      }

      // show success
      setSuccessTitle(paymentMethod === 'COD' ? 'Order Placed' : 'Payment Successful');
      setSuccessSubtitle(paymentMethod === 'COD' ? 'Please pay cash on delivery.' : 'Your order has been placed.');
      setShowSuccess(true);
      setLatestOrderId(orderData.orderId);
    } catch (err) {
      console.error('Failed to place order:', err);
      setDialogMsg('Failed to place order. Please try again.');
      setDialogOpen(true);
    } finally {
      setLoading(false);
    }
  };

// Razorpay payment handler with secure serverless order creation & verification
const handleRazorpay = async () => {
  try {
    setLoading(true);

    const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;

    // Ensure Razorpay script is loaded
    if (!window.Razorpay) {
      throw new Error('Razorpay script not loaded. Please ensure it is included in your HTML.');
    }
    
    // Validate key
    if (!keyId || keyId.includes('YourRazorpayKey')) {
      setDialogMsg("Razorpay key is not configured. Please set a valid key and reload.");
      setDialogOpen(true);
      setLoading(false);
      return;
    }

    if (!auth || !auth.currentUser) {
      setDialogMsg("Please log in to complete your order.");
      setDialogOpen(true);
      setLoading(false);
      return;
    }

    // 1. Get Firebase Auth ID Token
    const idToken = await auth.currentUser.getIdToken();

    // 2. Call backend /api/create-razorpay-order to calculate prices and create Razorpay order
    const createRes = await fetch('/api/create-razorpay-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        cartItems,
        deliveryOption,
        address: selectedAddress,
        coinsToUse: safeCoinsToUse,
        promoCode: orderSummary.promo?.code || null,
        claimGST,
        gstDetails,
        verifiedPhoneNumber: displayVerifiedNumber
      })
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
      throw new Error(createData.error || 'Failed to initialize payment with server.');
    }

    // Handle 100% Zero-Total checkout (fully paid by coins or promo)
    if (createData.zeroTotal) {
      setLatestOrderId(createData.internalOrderId);
      setSuccessTitle('Order Confirmed!');
      setSuccessSubtitle(`Order #${createData.internalOrderId} placed successfully.`);
      setShowSuccess(true);
      setLoading(false);
      return;
    }

    const { orderId, amount, currency, internalOrderId } = createData;

    // 3. Open Razorpay Checkout modal with the server-created order_id
    const options = {
      key: keyId,
      order_id: orderId, // Crucial: Server-created Razorpay order ID
      amount: amount,
      currency: currency || "INR",
      name: "Sri Amman Smart Store",
      description: `Order Payment #${internalOrderId}`,
      image: "/logo.png",
      handler: async function (response) {
        console.log('[Razorpay] Payment response received:', response);
        setLoading(true);

        try {
          // 4. Verify payment HMAC signature and captured status on server
          const verifyRes = await fetch('/api/verify-razorpay-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              internalOrderId
            })
          });

          const verifyData = await verifyRes.json();
          if (!verifyRes.ok) {
            throw new Error(verifyData.error || 'Payment signature verification failed.');
          }

          // Payment confirmed!
          setLatestOrderId(internalOrderId);
          setSuccessTitle('Payment Successful!');
          setSuccessSubtitle(`Order #${internalOrderId} confirmed successfully.`);
          setShowSuccess(true);
        } catch (verifyErr) {
          console.error('[Razorpay] Verification error:', verifyErr);
          setDialogMsg(verifyErr.message || 'Payment verification failed. Please contact customer support.');
          setDialogOpen(true);
        } finally {
          setLoading(false);
        }
      },
      prefill: {
        name: userProfile?.fullName || "",
        email: userProfile?.email || "",
        contact: displayVerifiedNumber || userProfile?.number || ""
      },
      notes: {
        internalOrderId,
        address: selectedAddress?.address || "Sri Amman Smart Store"
      },
      theme: {
        color: "#388e3c"
      },
      modal: {
        ondismiss: function() {
          console.log('[Razorpay] Payment modal dismissed');
          setLoading(false);
          try { notify('Payment cancelled', 'info'); } catch (e) {
            console.error('Notification failed:', e);
          }
        },
        confirm_close: true
      },
      retry: {
        enabled: true,
        max_count: 3
      }
    };

    const rzp = new window.Razorpay(options);

    rzp.on('payment.failed', function (response) {
      console.error('[Razorpay] Payment failed event:', response.error);
      setDialogMsg(`Payment failed: ${response.error?.description || 'Please try again.'}`);
      setDialogOpen(true);
      setLoading(false);
    });

    rzp.open();

  } catch (e) {
    console.error('Razorpay process failed:', e);
    setDialogMsg(e.message || "Unable to start payment. Please try again.");
    setDialogOpen(true);
    setLoading(false);
  }
};
  // Load Razorpay script if not present
  React.useEffect(() => {
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Cash on Delivery handler
  const handleCOD = async () => {
    // require phone verification before confirming COD
    if (!phoneVerified) {
      const txt = 'Please verify your mobile number before placing the order.';
  setInlineMessage({ type: 'warning', text: txt });
      notify(txt, 'warning');
      return;
    }
    await saveOrder("COD", "Pending");
  };

  const handlePay = (opt) => {
    if (!phoneVerified) {
      const txt = 'Please verify your mobile number before proceeding to payment.';
  setInlineMessage({ type: 'warning', text: txt });
      notify(txt, 'warning');
      return;
    }
    if (opt.type === "razorpay") {
      handleRazorpay();
    } else {
      handleCOD();
    }
  };


  const handleDialogClose = () => {
    setDialogOpen(false);
    const highlightId = latestOrderId;
    setLatestOrderId(null);
    if (highlightId) {
      navigate('/orders', { state: { highlightOrderId: highlightId } });
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleLinkAnotherNumber = () => {
    setEditingPhone(true);
    setShowPaymentOptions(false);
    setPhoneVerified(false);
    setInlineMessage(null);
    setOtp('');
    setOtpSent(false);
    setPhone('');
    setVerifiedPhoneNumber(null);
    setConfirmationResult(null);
    setVerificationId(null);
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
      } catch (e) {
        console.debug('Error clearing recaptcha:', e);
      }
      setRecaptchaVerifier(null);
    }
  };

  const sendOtp = async () => {
    try {
      if (!phone || phone.length < 6) { 
        setInlineMessage({ type: 'error', text: 'Please enter a valid mobile number.' }); 
        notify('Please enter a valid mobile number', 'warning');
        return; 
      }
      const fullPhone = phone.startsWith('+') ? phone : (countryCode + phone);

      if (auth && auth.currentUser) {
        const currentPhone = auth.currentUser.phoneNumber;
        if (currentPhone && currentPhone === fullPhone) {
          setPhoneVerified(true);
          setInlineMessage(null);
          // Success toast suppressed to avoid duplicate banners
          return;
        }
      }

      let verifier = recaptchaVerifier;
      if (!verifier) {
        verifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 
          size: 'invisible',
          callback: () => {},
          'expired-callback': () => {
            setInlineMessage({ type: 'warning', text: 'Security verification expired. Please try again.' });
            notify('Security verification expired', 'warning');
          }
        });
        await verifier.render();
        setRecaptchaVerifier(verifier);
      }
      
      setInlineMessage({ type: 'info', text: 'Sending OTP...' });
      const confirmation = await signInWithPhoneNumber(auth, fullPhone, verifier);
      setConfirmationResult(confirmation);
      setVerificationId(confirmation?.verificationId || null);
      setOtpSent(true);
      setInlineMessage({ type: 'info', text: 'OTP sent. Enter the code to verify.' });
      notify('OTP sent successfully', 'success');
    } catch (err) {
      console.error('OTP send failed', err);
      let errorMessage = 'Failed to send OTP. Please try again.';
      setInlineMessage({ type: 'error', text: errorMessage });
      notify(errorMessage, 'error');
    }
  };

  const verifyOtp = async () => {
    if (!confirmationResult && !verificationId) { 
      setInlineMessage({ type: 'error', text: 'No OTP request found.' }); 
      notify('No OTP request found', 'error');
      return; 
    }
    setVerifying(true);
    
    try {
      const vid = verificationId || confirmationResult?.verificationId;
      if (!vid) throw new Error('Missing verification id');
      const credential = PhoneAuthProvider.credential(vid, otp);
      
      if (auth && auth.currentUser) {
        await linkWithCredential(auth.currentUser, credential);
        setPhoneVerified(true);
        setVerifiedPhoneNumber(countryCode + phone);
        setInlineMessage(null);
        setShowPaymentOptions(true);
        setEditingPhone(false);
        // Success toast suppressed to avoid duplicate banners
        if (recaptchaVerifier) {
          try { recaptchaVerifier.clear(); } catch (e) { console.debug('Error clearing recaptcha after verify:', e); }
          setRecaptchaVerifier(null);
        }
      } else {
        const res = await confirmationResult.confirm(otp);
        setPhoneVerified(true);
        setVerifiedPhoneNumber(countryCode + phone);
        setInlineMessage(null);
        setShowPaymentOptions(true);
        setEditingPhone(false);
        // Clear reCAPTCHA instance after successful verification
        if (recaptchaVerifier) {
          try { recaptchaVerifier.clear(); } catch (e) { console.debug('Error clearing recaptcha after verify:', e); }
          setRecaptchaVerifier(null);
        }
      }
    } catch (err) {
      // Use debug to avoid alarming logs when provider is already linked
      console.debug('OTP verify handler caught:', err);
      if (err && (err.code === 'auth/provider-already-linked' || (err.message && err.message.includes('provider-already-linked')))) {
        // Treat as success if phone provider already linked to this account
        setPhoneVerified(true);
        setVerifiedPhoneNumber(countryCode + phone);
        setInlineMessage(null);
        setShowPaymentOptions(true);
        setEditingPhone(false);
        if (recaptchaVerifier) {
          try { recaptchaVerifier.clear(); } catch (e) { console.debug('Error clearing recaptcha after verify:', e); }
          setRecaptchaVerifier(null);
        }
      } else if (err && (err.code === 'auth/credential-already-in-use' || (err.message && err.message.includes('credential-already-in-use')))) {
        const msg = 'This phone number is already linked to another account. Please sign in with that number or use a different phone.';
        setInlineMessage({ type: 'error', text: msg });
        notify(msg, 'error');
      } else {
        let verifyErrorMessage = 'Verification failed. Please check the OTP and try again.';
        setInlineMessage({ type: 'error', text: verifyErrorMessage });
        notify('OTP verification failed', 'error');
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 0, sm: 2, md: 3 }, maxWidth: '100%', mx: 'auto', minHeight: '100vh' }}>
      {/* Title (no back button) */}
      <Box mb={{ xs: 2, sm: 3 }} sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 0 } }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Payment & Verification</Typography>
      </Box>

      <Box sx={{ maxWidth: { sm: 1200 }, mx: { xs: 0, sm: 'auto' } }}>
        {/* ...Contact & Verification card removed... */}

        {/* Order Summary */}
        <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
          <Card sx={{ borderRadius: { xs: 0, sm: 2 }, boxShadow: 2, width: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Order Summary</Typography>
              
              <Box sx={{ mb: 2 }}>
                {/* Show pre-discount item total, discount line, delivery and taxes */}
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Items ({orderSummary.items.length})</Typography>
                  <Typography variant="body2">₹{(Number(orderSummary.total || 0) + Number(orderSummary.discount || 0)).toLocaleString('en-IN')}</Typography>
                </Box>
                {orderSummary?.discount > 0 && (
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Promo ({orderSummary.promo?.code || ''})</Typography>
                    <Typography variant="body2" color="error">-₹{Number(orderSummary.discount || 0).toLocaleString('en-IN')}</Typography>
                  </Box>
                )}
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Delivery</Typography>
                  <Typography variant="body2">{deliveryCharge === 0 ? 'Free' : `₹${Number(deliveryCharge).toLocaleString('en-IN')}`}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Taxes</Typography>
                  <Typography variant="body2">Included</Typography>
                </Box>
              </Box>

              {!showCoins ? (
                <Box sx={{ mb: 2 }}>
                  <Button size="small" variant="outlined" onClick={() => setShowCoins(true)} sx={{ borderRadius: 2, fontWeight: 700 }}>Use Coins</Button>
                </Box>
              ) : (
                <Box sx={{
                  mb: 2,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'background.default',
                  border: '1px solid',
                  borderColor: 'divider'
                }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Use Coins</Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="caption" color="text.secondary">Available: <b>{availableCoins}</b></Typography>
                      <Button size="small" variant="text" onClick={() => setShowCoins(false)} sx={{ minWidth: 0, px: 1, fontWeight: 700 }}>Close</Button>
                    </Box>
                  </Box>
                  <Box display="flex" gap={1} alignItems="center">
                    <TextField
                      size="small"
                      type="tel"
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                      value={coinsToUse}
                      onChange={(e) => setCoinsToUse((e.target.value || '').replace(/[^0-9]/g, ''))}
                      label="Coins to use"
                      sx={{ maxWidth: 200 }}
                      InputProps={{
                        endAdornment: (
                          coinsToUse ? (
                            <InputAdornment position="end">
                              <IconButton size="small" edge="end" onClick={() => setCoinsToUse('')} aria-label="clear coins input">
                                <ClearIcon fontSize="small" />
                              </IconButton>
                            </InputAdornment>
                          ) : null
                        )
                      }}
                    />
                    <Button size="small" variant="contained" color="success" onClick={() => setCoinsToUse(String(maxUsableCoins))} sx={{ fontWeight: 800 }}>Use All</Button>
                  </Box>
                  {coinsError && (
                    <Box mt={1}><Alert severity="warning">{coinsError}</Alert></Box>
                  )}
                  {safeCoinsToUse > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Applying <b>{safeCoinsToUse}</b> coins gives discount of <b>₹{coinsDiscount.toLocaleString('en-IN')}</b>
                    </Typography>
                  )}
                </Box>
              )}
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ 
                borderRadius: 2,
                p: 2.5
              }}>
                <Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Typography variant="body2" color="text.secondary">Total (incl. delivery)</Typography>
                    <Typography variant="body2">₹{Number(preCoinsTotal || 0).toLocaleString('en-IN')}</Typography>
                  </Box>
                  {safeCoinsToUse > 0 && (
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="body2" color="text.secondary">Coins Discount</Typography>
                      <Typography variant="body2" color="error">-₹{coinsDiscount.toLocaleString('en-IN')}</Typography>
                    </Box>
                  )}
                  <Divider sx={{ my: 1 }} />
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>Payable</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1.4rem' }}>
                      ₹{Number(payableAmount || 0).toLocaleString('en-IN')}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
            <Card sx={{ borderRadius: { xs: 0, sm: 2 }, boxShadow: 2, width: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Payment Options</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Choose a payment method. You will be prompted to complete payment for online methods.</Typography>

                <FormControl component="fieldset" sx={{ width: '100%' }}>
                  <RadioGroup
                    aria-label="payment-method"
                    name="payment-method"
                    value={selectedPayment}
                    onChange={(e) => setSelectedPayment(e.target.value)}
                  >
                    {paymentOptions.map(opt => {
                      const isOnlineDisabled = opt.type !== 'cod' && import.meta.env.VITE_ENABLE_ONLINE_PAYMENT !== 'true';
                      return (
                        <FormControlLabel
                          key={opt.id}
                          value={opt.type}
                          disabled={isOnlineDisabled}
                          control={<Radio />}
                          labelPlacement="start"
                          label={
                            <Box display="flex" alignItems="center" gap={1.25}>
                              {opt.icon}
                              <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  {opt.name}
                                  {isOnlineDisabled && (
                                    <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary', fontWeight: 400 }}>
                                      (Temporarily Unavailable)
                                    </Typography>
                                  )}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {isOnlineDisabled ? 'Please use Cash on Delivery while online payment is being set up.' : opt.subtitle}
                                </Typography>
                              </Box>
                            </Box>
                          }
                          sx={{
                            m: 0,
                            py: 1,
                            px: 1,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                            opacity: isOnlineDisabled ? 0.6 : 1
                          }}
                        />
                      );
                    })}
                  </RadioGroup>
                </FormControl>

                <Button
                  fullWidth
                  color="success"
                  variant="contained"
                  disabled={loading}
                  onClick={() => {
                    if (selectedPayment === 'cod') {
                      handleCOD();
                    } else if (import.meta.env.VITE_ENABLE_ONLINE_PAYMENT !== 'true') {
                      setDialogMsg("Online payment is temporarily unavailable. Please place your order using Cash on Delivery.");
                      setDialogOpen(true);
                    } else {
                      handleRazorpay();
                    }
                  }}
                  sx={{
                    mt: 2,
                    borderRadius: 2,
                    fontWeight: 800,
                    py: 1.3,
                    boxShadow: '0 6px 16px rgba(56,142,60,0.35)'
                  }}
                >
                  {loading ? <CircularProgress size={22} /> : 'PLACE ORDER'}
                </Button>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">Need help? <Link component={RouterLink} to="/contact">Contact us</Link></Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">By placing an order you agree to our policies. <Link component={RouterLink} to="/refund-cancellation">Refund &amp; Cancellation</Link> • <Link component={RouterLink} to="/shipping">Shipping policy</Link> • <Link component={RouterLink} to="/return">Return policy</Link></Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
      </Box>

      <Dialog open={dialogOpen} onClose={handleDialogClose}>
        <DialogTitle>Order Status</DialogTitle>
        <DialogContent>
          <Typography>{dialogMsg}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} autoFocus>OK</Button>
        </DialogActions>
      </Dialog>
      {/* Hidden reCAPTCHA container for Firebase RecaptchaVerifier (invisible/background) */}
      <Box id="recaptcha-container" sx={{ display: 'none' }} />
      {showSuccess && latestOrderId && (
        <OrderSuccessAnimation
          title={successTitle}
          subtitle={successSubtitle}
          orderId={latestOrderId}
        />
      )}
    </Box>
  );
};

export default PaymentOptionsPage;