import React from 'react';
import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { Link } from 'react-router-dom';

const CoinBalanceCard = ({ onManageCoinsClick }) => {
  const { user } = useContext(AuthContext);
  const [coinBalance, setCoinBalance] = useState(0);

  useEffect(() => {
    let unsub = null;
    (async () => {
      if (!user) return;
      try {
        const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
        const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
        const userRef = doc(db, 'users', userDocId);
        unsub = onSnapshot(userRef, (snap) => {
          const d = snap.exists() ? snap.data() : {};
          setCoinBalance(Number(d?.coins || 0));
        });
      } catch (_) {}
    })();
    return () => { if (unsub) unsub(); };
  }, [user]);

  if (!user) return null;

  return (
    <Card elevation={2} sx={{ mb: 1, borderRadius: 2, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', minHeight: 64, p: 0.5 }}>
      <CardContent sx={{ p: 1.2, '&:last-child': { pb: 1.2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img src="/favicon-32x32.png" alt="Coin" width={32} height={32} style={{ marginRight: 8, marginLeft: 0, display: 'block' }} />
            <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ lineHeight: 1 }}>
              {coinBalance}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, ml: 0.5 }}>
              coins
            </Typography>
          </Box>
          <Button 
            component={onManageCoinsClick ? undefined : Link}
            to={onManageCoinsClick ? undefined : "/coin-management"}
            onClick={onManageCoinsClick}
            variant="contained" 
            color="primary" 
            size="small" 
            sx={{ borderRadius: 2, fontWeight: 600, minWidth: 0, px: 1.8, py: 0.7, fontSize: 13, boxShadow: 1 }}
          >
            Manage
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CoinBalanceCard;
