import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, getDoc, collection, query, orderBy } from 'firebase/firestore';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const CoinManagementPage = () => {
  const { t } = useLanguage();
  const { user } = useContext(AuthContext);
  const [userDocId, setUserDocId] = useState('');
  const [coins, setCoins] = useState(0);
  const [pendingCoins, setPendingCoins] = useState(0);
  const [availableCoins, setAvailableCoins] = useState(0);
  const [releasedSelf, setReleasedSelf] = useState(0);
  const [pendingSelf, setPendingSelf] = useState(0);
  const [releasedReferral, setReleasedReferral] = useState(0);
  const [pendingReferral, setPendingReferral] = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHistoryType, setSelectedHistoryType] = useState('self');

  useEffect(() => {
    let unsubUser = null;
    let unsubHist = null;
    (async () => {
      try {
        setLoading(true);
        if (!user) return;
        const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
        const mappedId = mapSnap.exists() ? (mapSnap.data()?.userDocId || '') : '';
        setUserDocId(mappedId);
        if (!mappedId) { setLoading(false); return; }
        // Subscribe to user doc for availableCoins
        unsubUser = onSnapshot(doc(db, 'users', mappedId), (snap) => {
          const data = snap.data() || {};
          const avail = Number((data.availableCoins ?? data.availableCoins32) || 0);
          setAvailableCoins(avail);
        });
        // Subscribe to coins history and compute totals from history (released vs pending, self vs referral)
        unsubHist = onSnapshot(query(collection(db, 'users', mappedId, 'coinsHistory'), orderBy('createdAt', 'desc')), (snap) => {
          const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setHistory(rows);

          // Calculate aggregates
          let rSelf = 0, pSelf = 0, rRef = 0, pRef = 0;
          rows.forEach(row => {
            const amt = Number(row.amount || 0);
            const type = String(row.type || 'self').toLowerCase();
            const status = String(row.status || 'pending').toLowerCase();
            if (type === 'referral') {
              if (status === 'released') rRef += amt; else pRef += amt;
            } else {
              if (status === 'released') rSelf += amt; else pSelf += amt;
            }
          });

          setReleasedSelf(rSelf);
          setPendingSelf(pSelf);
          setReleasedReferral(rRef);
          setPendingReferral(pRef);
          setCoins(rSelf + rRef); // released/earned total
          setPendingCoins(pSelf + pRef); // pending total
          setLoading(false);
        });
      } catch (_) {
        setLoading(false);
      }
    })();
    return () => { if (unsubUser) unsubUser(); if (unsubHist) unsubHist(); };
  }, [user]);

  const navigate = useNavigate();
  // Gate: require acceptance of Coin terms
  useEffect(() => {
    try {
      const accepted = localStorage.getItem('coinTermsAccepted') === 'true';
      if (!accepted) {
        navigate('/coin-terms', { state: { from: '/coin-management' }, replace: true });
      }
    } catch (_) {
      navigate('/coin-terms', { state: { from: '/coin-management' }, replace: true });
    }
  }, [navigate]);

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', mt: 0, px: 0 }}> {/* Removed horizontal padding here for card to span full width if desired, or adjust as needed */}
      
      {/* --- REVISED MY COINS CARD: Light Theme, New Layout, Integrated Back Button --- */}
      <Card 
        elevation={6} 
        sx={{ 
          borderRadius: { xs: 0, sm: 4 }, // No border radius on small screens, rounded on larger
          background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', // Light green gradient
          color: '#333', 
          mb: 3, 
          position: 'relative', // Needed for absolute positioning of back button
          pt: 4, // Padding top to make space for back button
        }}
      >
        {/* Back Button Integrated */}
        <IconButton 
          onClick={() => navigate('/')} 
          sx={{ 
            position: 'absolute', 
            top: 8, 
            left: 8, 
            color: '#1e3c72', // Dark blue for contrast
          }}
        >
          <ArrowBackIcon />
        </IconButton>

        <CardContent>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
            <MonetizationOnIcon sx={{ fontSize: 36, mr: 1, color: '#007bff' }} /> {/* Primary blue for icon */}
            <Typography variant="h5" fontWeight={700} sx={{ color: '#1e3c72' }}> {/* Dark blue for title */}
              {t('coinManagement')}
            </Typography>
          </Box>
          {/* Available Coins */}
          <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, background: 'rgba(255,255,255,0.85)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', mb: 2 }}>
            <Typography variant="overline" display="block" color="text.secondary">
              {t('availableCoins')}
            </Typography>
            <Typography variant="h3" fontWeight={900} sx={{ color: '#1e3c72', lineHeight: 1.1 }}>
              {availableCoins}
            </Typography>
          </Box>
          
          {/* Main Coin Totals - Redesigned for clarity and premium feel */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 4 }, mb: 3 }}>
            
            {/* Earned Coins */}
            <Box sx={{ flex: 1, textAlign: 'center', p: 2, borderRadius: 2, background: 'rgba(255,255,255,0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <Typography variant="overline" display="block" color="text.secondary">
                {t('totalEarned')}
              </Typography>
              <Typography variant="h3" fontWeight={800} sx={{ color: '#28a745', lineHeight: 1.1, mb: 1 }}> {/* Green for released */}
                {coins}
              </Typography>
              <Stack direction="row" justifyContent="center" spacing={2} divider={<Divider orientation="vertical" flexItem />}>
                <Typography variant="body2" color="text.primary">
                  {t('self')}: <Typography component="span" fontWeight={600}>{releasedSelf}</Typography>
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {t('referral')}: <Typography component="span" fontWeight={600}>{releasedReferral}</Typography>
                </Typography>
              </Stack>
            </Box>

            {/* Pending Coins */}
            <Box sx={{ flex: 1, textAlign: 'center', p: 2, borderRadius: 2, background: 'rgba(255,255,255,0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <Typography variant="overline" display="block" color="text.secondary">
                {t('totalPending')}
              </Typography>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#ffc107', lineHeight: 1.1, mb: 1 }}> {/* Amber for pending */}
                {pendingCoins}
              </Typography>
              <Stack direction="row" justifyContent="center" spacing={2} divider={<Divider orientation="vertical" flexItem />}>
                <Typography variant="body2" color="text.primary">
                  {t('self')}: <Typography component="span" fontWeight={600}>{pendingSelf}</Typography>
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {t('referral')}: <Typography component="span" fontWeight={600}>{pendingReferral}</Typography>
                </Typography>
              </Stack>
            </Box>
          </Box>
          
          <Divider sx={{ backgroundColor: 'rgba(0,0,0,0.1)', mb: 2 }} />

          {/* Explanation Text */}
          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontStyle: 'italic', lineHeight: 1.6 }}>
            <Box component="span" fontWeight={600}>{t('releaseConditions')}</Box>
            <br />
            &bull; {t('selfCoinsReleaseDesc')}
            <br />
            &bull; {t('referralCoinsReleaseDesc')}
          </Typography>
        </CardContent>
      </Card>
      {/* --- END REVISED MY COINS CARD --- */}

      <Card elevation={1} sx={{ borderRadius: 3, mx: 2 }}> {/* Added horizontal margin for history card */}
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{t('coinsHistory')}</Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
          ) : history.length === 0 ? (
            <Typography variant="body2" color="text.secondary">{t('noCoinsHistory')}</Typography>
          ) : (
            <>
              <Paper elevation={0} sx={{ mb: 2, background: 'transparent' }}>
                <Tabs value={selectedHistoryType} onChange={(_, v) => setSelectedHistoryType(v)} indicatorColor="primary" textColor="primary" variant="fullWidth">
                  <Tab label={`${t('selfHistory')} (${history.filter(h => String(h.type || 'self').toLowerCase() === 'self').length})`} value="self" />
                  <Tab label={`${t('referralHistory')} (${history.filter(h => String(h.type || '').toLowerCase() === 'referral').length})`} value="referral" />
                </Tabs>
              </Paper> 
              <Stack spacing={1}>
                {history.filter(h => String(h.type || 'self').toLowerCase() === selectedHistoryType).map(row => {
                  const created = row.createdAt?.toDate ? row.createdAt.toDate() : (row.createdAt?.seconds ? new Date(row.createdAt.seconds * 1000) : null);
                  const released = row.releasedAt?.toDate ? row.releasedAt.toDate() : (row.releasedAt?.seconds ? new Date(row.releasedAt.seconds * 1000) : null);
                  const isReleased = row.status === 'released';
                  const statusLabel = isReleased ? (t('granted') || 'RELEASED') : (row.status === 'pending' ? (t('pendingCoins') || 'PENDING') : String(row.status || '').toUpperCase());
                  
                  return (
                    <Paper key={row.id} elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                      {/* Top row: amount left, status right */}
                      <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                        <Typography variant="body1" sx={{ fontWeight: 800 }}>
                          <span style={{ color: Number(row.amount) > 0 ? 'green' : 'red' }}>{Number(row.amount) > 0 ? '+' : ''}{row.amount} {t('coinsText')}</span>
                        </Typography>
                        <Box>
                          <Chip size="small" label={statusLabel} color={row.status === 'released' ? 'success' : (row.status === 'pending' ? 'warning' : 'default')} />
                        </Box>
                      </Box>

                      {/* Details block full width below */}
                      <Box sx={{ mt: 1, width: '100%' }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ wordBreak: 'break-word' }}>{t('order')}: {row.orderId || row.id}</Typography>
                        {row.type === 'referral' && row.buyerName && (
                          <Typography variant="caption" color="text.secondary" display="block">{t('buyer')}: {row.buyerName}</Typography>
                        )}
                        {created && (
                          <Typography variant="caption" color="text.secondary" display="block">{t('placedOn')}: {created.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Typography>
                        )}
                        {released && row.status === 'released' && (
                          <Typography variant="caption" color="text.secondary" display="block">{t('releasedOn')}: {released.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Typography>
                        )}
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default CoinManagementPage;