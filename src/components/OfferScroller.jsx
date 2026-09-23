import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { keyframes } from '@emotion/react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

// Simple marquee-style animation
const scroll = keyframes`
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`;

function OfferScroller() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const colRef = collection(db, 'offerMessages');
    const unsub = onSnapshot(colRef, (snap) => {
      const items = [];
      snap.forEach((doc) => {
        const data = doc.data() || {};
        if (data.text && typeof data.text === 'string') {
          items.push({
            text: data.text.trim(),
            order: data.order || 0,
            createdAt: data.createdAt
          });
        }
      });
      // Sort messages by order and then by createdAt
      items.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return b.createdAt?.localeCompare(a.createdAt) || 0;
      });
      setMessages(items.map(item => item.text));
    });
    return () => unsub();
  }, []);

  const concatenated = messages.length > 0 ? messages.join('  •  ') : 'Welcome to Sri Amman Smart Store  •  Fresh deals every day  •  Fast delivery';

  // Duplicate content to enable seamless infinite scroll
  const marqueeContent = `${concatenated}     ${concatenated}`;

  return (
    <Box
      sx={{
        position: 'relative', // Changed from fixed to relative
        width: '100%',
        height: 40,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        bgcolor: '#fff',
        color: (theme) => theme.palette.primary.main,
        borderBottom: '1px solid #e0e0e0'
      }}
    >
      <Box
        sx={{
          whiteSpace: 'nowrap',
          display: 'inline-block',
          px: 2,
          animation: `${scroll} 18s linear infinite`,
          '&:hover': { animationPlayState: 'paused' }
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 0.3,
            color: (theme) => theme.palette.primary.main,
            textShadow: 'none'
          }}
        >
          {marqueeContent}
        </Typography>
      </Box>
    </Box>
  );
}

export default OfferScroller;
