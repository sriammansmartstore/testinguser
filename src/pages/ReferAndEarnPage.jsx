import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { doc, collection, query, onSnapshot, getDoc } from 'firebase/firestore';
import useReferralProgress from '../hooks/useReferralProgress';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import IconButton from '@mui/material/IconButton';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../components/NotificationProvider';
import { db } from '../firebase'; // Adjust the import based on your project structure

import { useLanguage } from '../context/LanguageContext';

const ReferAndEarnPage = () => {
  const { language, t } = useLanguage();
  const isTamil = language === 'tamil';
  const { user } = useContext(AuthContext);
  const [userReferralCode, setUserReferralCode] = useState('');
  const [referredFriends, setReferredFriends] = useState([]);
  const navigate = useNavigate();
  const { notify } = useNotification() || { notify: () => {} };

  useEffect(() => {
    if (!user?.uid) {
      notify(isTamil ? 'பரிந்துரை குறியீட்டைக் காண தயவுசெய்து உள்நுழையவும்.' : 'User not logged in. Please log in to view your referral code.', 'warning');
      return;
    }

    const fetchUserData = async () => {
      try {
        // Fetch userDocId from usersByUid
        const userByUidDoc = await getDoc(doc(db, 'usersByUid', user.uid));
        if (userByUidDoc.exists()) {
          const userDocId = userByUidDoc.data().userDocId;

          // Fetch user document using userDocId
          const userDoc = await getDoc(doc(db, 'users', userDocId));
          if (userDoc.exists()) {
            setUserReferralCode(userDoc.data().userId || '');

            // Fetch refferals (note the spelling)
            const refferalsQuery = query(collection(db, 'users', userDocId, 'refferals'));
            const unsubscribe = onSnapshot(refferalsQuery, async (snapshot) => {
              try {
                const friendsPromises = snapshot.docs.map(async docSnapshot => {
                  // Get the referred user's details using their userId
                  const referredUserId = docSnapshot.data().userId;
                  const referredUserDoc = await getDoc(doc(db, 'users', referredUserId));
                  
                  return {
                    id: docSnapshot.id,
                    fullName: referredUserDoc.exists() ? referredUserDoc.data().fullName : (isTamil ? 'பயனர்' : 'Unknown User'),
                    referredAt: docSnapshot.data().referredAt?.toDate?.() 
                      ? docSnapshot.data().referredAt.toDate().toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '',
                  };
                });
                
                const friends = await Promise.all(friendsPromises);
                setReferredFriends(friends);
              } catch (error) {
                console.error('Error fetching referral details:', error);
                notify(isTamil ? 'விவரங்களை ஏற்றுவதில் பிழை' : 'Error loading referral details', 'error');
              }
            });

            return () => unsubscribe();
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchUserData();
  }, [user?.uid, isTamil]);

  const storeUrl = window.location.origin;
  const makeShareText = () => isTamil
    ? `ஸ்ரீ அம்மன் ஸ்மார்ட் ஸ்டோரில் என்னுடன் இணையுங்கள்! பதிவு செய்யும் போது அல்லது வாங்கும் போது எனது பரிந்துரை குறியீட்டைப் பயன்படுத்துங்கள்: ${userReferralCode} - ${storeUrl}`
    : `Join me on Sri Amman Smart Store and use my referral code ${userReferralCode} when signing up or purchasing: ${storeUrl}`;

  const handleShareWeb = async () => {
    const text = makeShareText();
    try {
      if (navigator?.share) {
        await navigator.share({ title: 'Sri Amman Smart Store', text, url: storeUrl });
        return;
      }
    } catch (e) {
      console.debug('Web share failed', e);
    }
    // Fallback to clipboard copy of the full message
    try {
      if (navigator?.clipboard && window?.isSecureContext) {
        await navigator.clipboard.writeText(text);
        notify(isTamil ? 'பரிந்துரை செய்தி நகலெடுக்கப்பட்டது' : 'Referral message copied to clipboard', 'success');
      }
    } catch (e) {
      notify(isTamil ? 'பரிந்துரையைப் பகிர முடியவில்லை.' : 'Unable to share referral. Please copy the code manually.', 'error');
    }
  };

  // Gate: require acceptance of Refer & Earn terms
  useEffect(() => {
    try {
      const accepted = localStorage.getItem('referralTermsAccepted') === 'true';
      if (!accepted) {
        navigate('/refer-terms', { state: { from: '/refer-and-earn' }, replace: true });
      }
    } catch (_) {
      navigate('/refer-terms', { state: { from: '/refer-and-earn' }, replace: true });
    }
  }, [navigate]);

  const handleCopyCode = async () => {
    if (!userReferralCode) {
      notify(isTamil ? 'பரிந்துரை குறியீடு கிடைக்கவில்லை' : 'No referral code available', 'warning');
      return;
    }
    try {
      if (navigator?.clipboard && window?.isSecureContext) {
        await navigator.clipboard.writeText(userReferralCode);
        notify(isTamil ? 'பரிந்துரை குறியீடு நகலெடுக்கப்பட்டது' : 'Referral code copied to clipboard', 'success');
        return;
      }
      const temp = document.createElement('textarea');
      temp.value = userReferralCode;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
      notify(isTamil ? 'பரிந்துரை குறியீடு நகலெடுக்கப்பட்டது' : 'Referral code copied to clipboard', 'success');
    } catch (e) {
      console.error('Copy failed', e);
      notify(isTamil ? 'குறியீட்டை நகலெடுக்க முடியவில்லை' : 'Unable to copy referral code. Please share it manually.', 'error');
    }
  };

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', mt: 0, px: 2 }}>
      <IconButton onClick={() => navigate('/')} sx={{ mb: 2 }}>
        <ArrowBackIcon />
      </IconButton>
      <Card elevation={4} sx={{ borderRadius: 4, background: 'linear-gradient(135deg, #f5f7fa 0%, #e0eafc 100%)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <GroupAddIcon color="primary" sx={{ fontSize: 36, mr: 1 }} />
            <Typography variant="h5" fontWeight={700} color="primary.main">
              {isTamil ? "பரிந்துரைத்து சம்பாதிக்க" : "Refer & Earn"}
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {isTamil 
              ? "உங்கள் பரிந்துரை குறியீட்டை நண்பர்களுடன் பகிருங்கள். உங்கள் நண்பர் ₹5000 அல்லது அதற்கு மேல் ஆர்டர் பெற்றுக்கொண்டால் உங்களுக்கு நாணயங்கள் கிடைக்கும்!"
              : "Share your referral code with friends. You will earn coins for each friend who places and receives an order worth ₹5000 or more!"}
          </Typography>
          <Box sx={{ mb: 2, p: 2, background: '#f5f5f5', borderRadius: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              {isTamil ? "உங்கள் பரிந்துரை குறியீடு:" : "Your Referral Code:"}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Box sx={{ px: 2, py: 1, borderRadius: 2, background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }}>
                <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: 2 }}>{userReferralCode}</Typography>
              </Box>
              <Button onClick={handleCopyCode} variant="outlined" size="medium" startIcon={<ContentCopyIcon />} sx={{ ml: 1, borderRadius: 2, px: 2 }}>
                {isTamil ? "நகலெடுக்க" : "Copy Code"}
              </Button>
              <Button onClick={handleShareWeb} variant="contained" color="success" size="medium" startIcon={<ShareIcon />} sx={{ ml: 1, borderRadius: 2, px: 2 }}>
                {isTamil ? "பகிர்க" : "Share"}
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {isTamil ? "நண்பர்கள் பதிவு செய்யும் போது அல்லது வாங்கும் போது இந்த குறியீட்டை உள்ளிடுமாறு சொல்லுங்கள்." : "Ask friends to enter this code when they sign up or use it during purchase."}
            </Typography>
          </Box>
          <Typography variant="h6" fontWeight={600} sx={{ mt: 2, mb: 1 }}>
            {isTamil ? "உங்கள் பரிந்துரைகள்" : "Your Referrals"}
          </Typography>
          <Box component="ul" sx={{ pl: 2, mb: 0 }}>
            {referredFriends.length === 0 && (
              <Typography component="li" color="text.secondary">
                {isTamil ? "பரிந்துரைகள் எதுவும் இல்லை." : "No referrals yet."}
              </Typography>
            )}
            {referredFriends.map(friend => (
              <Typography component="li" key={friend.id} sx={{ mb: 0.5 }}>
                {friend.fullName} {friend.referredAt ? `- ${isTamil ? 'இணைந்த தேதி:' : 'Joined on'} ${friend.referredAt}` : ''}
              </Typography>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ReferAndEarnPage;
