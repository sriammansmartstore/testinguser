import React from 'react';
import { Box, Typography, Button, IconButton, Menu, MenuItem, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PhoneIcon from '@mui/icons-material/Phone';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection } from 'firebase/firestore';
import { AuthContext } from '../context/AuthContext';

const NotificationDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { user } = React.useContext(AuthContext) || {};
  const initialNote = location.state?.note || null;
  const [note, setNote] = React.useState(initialNote);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (note) return; // already have from state
      const id = params.id;
      try {
        const gRef = doc(db, 'notifications', id);
        const gSnap = await getDoc(gRef);
        if (!cancelled && gSnap.exists()) {
          setNote({ id: gSnap.id, ...gSnap.data() });
          return;
        }
      } catch (_) {}
      try {
        if (!user) return;
        // try mapped userDocId
        const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
        const userDocId = mapSnap.exists() ? (mapSnap.data()?.userDocId || user.uid) : user.uid;
        const uRef = doc(collection(db, 'users', userDocId, 'notifications'), params.id);
        const uSnap = await getDoc(uRef);
        if (!cancelled && uSnap.exists()) {
          setNote({ id: uSnap.id, ...uSnap.data() });
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [params.id, user, note]);

  const title = note?.title || 'Notification';
  const body = note?.body || '';
  const timeStr = note?.createdAt ? new Date(note.createdAt).toLocaleString() : '';

  const onShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: body });
      } else {
        await navigator.clipboard.writeText(`${title}\n\n${body}`);
      }
    } catch (_) {}
    handleMenuClose();
  };

  const onCopy = async () => {
    try { await navigator.clipboard.writeText(`${title}\n\n${body}`); } catch (_) {}
    handleMenuClose();
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" mb={1}>
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
      </Box>
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.light}33 0%, ${theme.palette.primary.main}22 100%)`,
          border: (theme) => `1px solid ${theme.palette.primary.main}33`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
        }}
      >
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={1}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
          <IconButton onClick={handleMenuOpen} size="large">
            <MoreVertIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={open} onClose={handleMenuClose} keepMounted>
            <MenuItem onClick={onShare}><ShareIcon fontSize="small" style={{ marginRight: 8 }} /> Share</MenuItem>
            <MenuItem onClick={onCopy}><ContentCopyIcon fontSize="small" style={{ marginRight: 8 }} /> Copy</MenuItem>
          </Menu>
        </Box>
        {timeStr && (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>{timeStr}</Typography>
        )}
        <Divider sx={{ my: 1.5 }} />
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: 'text.primary' }}>
          {body}
        </Typography>
        <Box display="flex" gap={1.5} mt={2}>
          <Button variant="contained" color="primary" startIcon={<PhoneIcon />} onClick={() => navigate('/contact')}>
            Contact Us
          </Button>
          <Button variant="outlined" onClick={handleMenuOpen} endIcon={<MoreVertIcon />}>
            More
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default NotificationDetailPage;
