import React, { useEffect, useState, useContext } from "react";
import { Box, Typography, IconButton, Fab, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Menu, MenuItem, Avatar, CircularProgress, Slide, Chip, Card, CardContent } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import withPullToRefresh from '../components/withPullToRefresh';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { AuthContext } from "../context/AuthContext";

const WishlistPage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [wishlists, setWishlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuTargetId, setMenuTargetId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWishlistName, setNewWishlistName] = useState("");
  const [renameWishlistName, setRenameWishlistName] = useState("");
  // Avatar change dialog state
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarTargetId, setAvatarTargetId] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);

  const Transition = React.useMemo(() =>
    React.forwardRef(function Transition(props, ref) {
      return <Slide direction="up" ref={ref} {...props} />;
    }), []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const fetchWishlists = async () => {
      try {
        const colRef = collection(db, "users", user.uid, "wishlists");
        const snapshot = await getDocs(colRef);
        setWishlists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setWishlists([]);
      }
      setLoading(false);
    };
    fetchWishlists();
  }, [user, createDialogOpen, renameDialogOpen, deleteDialogOpen]);

  const handleMenuOpen = (event, id) => {
    setAnchorEl(event.currentTarget);
    setMenuTargetId(id);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
    // Do NOT clear menuTargetId here; let dialogs manage it
  };
  const handleDelete = async () => {
    if (!user || !menuTargetId) return;
    await deleteDoc(doc(db, "users", user.uid, "wishlists", menuTargetId));
    setDeleteDialogOpen(false);
    setMenuTargetId(null);
  };
  const handleRename = async () => {
    console.log("handleRename called", { user, menuTargetId, renameWishlistName });
    if (!user || !menuTargetId || !renameWishlistName.trim()) {
      alert("Missing user, wishlist id, or name!");
      return;
    }
    try {
      await updateDoc(doc(db, "users", user.uid, "wishlists", menuTargetId), { name: renameWishlistName.trim() });
      setRenameDialogOpen(false);
      setMenuTargetId(null);
      setRenameWishlistName("");
      console.log("Rename successful");
    } catch (err) {
      alert("Failed to rename wishlist: " + err.message);
      console.error("Rename error:", err);
    }
  };
  const handleCreate = async () => {
    if (!user || !newWishlistName.trim()) return;
    await addDoc(collection(db, "users", user.uid, "wishlists"), { name: newWishlistName.trim(), createdAt: new Date().toISOString() });
    setCreateDialogOpen(false);
    setNewWishlistName("");
  };

  if (!user) {
    return (
      <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 980, mx: 'auto' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <Typography variant="h5" sx={{ flex: 1, fontWeight: 700 }}>Your Wishlists</Typography>
        </Box>
        <Card sx={{ borderRadius: 2, boxShadow: 2, textAlign: 'center', py: 4 }}>
          <CardContent>
            <FavoriteBorderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Sign in to view your wishlists</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Please log in to access your saved wishlists and favorite items.
            </Typography>
            <Button 
              variant="contained" 
              onClick={() => navigate('/login')}
              sx={{ fontWeight: 600, borderRadius: 2, px: 4, py: 1.5 }}
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 1.5, md: 3 }, py: 3, maxWidth: 980, mx: 'auto', minHeight: '100vh', backgroundColor: 'background.paper' }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Your Wishlists</Typography>
        {!loading && wishlists.length > 0 && (
          <Chip 
            label={`${wishlists.length} list${wishlists.length > 1 ? 's' : ''}`} 
            color="primary" 
            size="small" 
          />
        )}
      </Box>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <CircularProgress />
        </Box>
      ) : wishlists.length === 0 ? (
        <Box sx={{ mt: 8, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>No wishlists yet</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Create your first wishlist to save products for later.</Typography>
          <Button variant="contained" color="success" onClick={() => setCreateDialogOpen(true)} sx={{ borderRadius: 2 }}>Create Wishlist</Button>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
          {wishlists.map(wl => (
            <Box key={wl.id} sx={{ p: 2, borderRadius: 3, boxShadow: 2, background: 'white', display: 'flex', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease', border: '1px solid', borderColor: 'divider', '&:hover': { boxShadow: 6, transform: 'translateY(-2px)', background: '#f8fbff' } }} onClick={() => navigate(`/wishlist/${wl.id}`)}>
              {/* Avatar with custom icon/gradient/emoji if set */}
              {wl.avatar ? (
                <Avatar
                  sx={{
                    mr: 2,
                    fontSize: 26,
                    bgcolor: wl.avatar.type === 'gradient' ? undefined : '#1976d2',
                    background: wl.avatar.type === 'gradient' ? wl.avatar.value : undefined,
                  }}
                >
                  {wl.avatar.type === 'icon' || wl.avatar.type === 'emoji' ? wl.avatar.value : ''}
                </Avatar>
              ) : (
                <Avatar sx={{ bgcolor: '#1976d2', mr: 2 }}>{(wl.name || wl.id)[0]?.toUpperCase()}</Avatar>
              )}
              <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>{wl.name || wl.id}</Typography>
              <IconButton onClick={e => { e.stopPropagation(); handleMenuOpen(e, wl.id); }} sx={{ color: 'text.secondary' }}>
                <MoreVertIcon />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
      <Fab color="success" sx={{ position: 'fixed', bottom: 88, right: 20, zIndex: 1200, boxShadow: 6 }} onClick={() => setCreateDialogOpen(true)}>
        <AddIcon />
      </Fab>
      {/* Menu for each wishlist */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={() => { setRenameDialogOpen(true); setRenameWishlistName(wishlists.find(w => w.id === menuTargetId)?.name || ""); handleMenuClose(); }}>Rename</MenuItem>
        <MenuItem onClick={() => { setAvatarDialogOpen(true); setAvatarTargetId(menuTargetId); handleMenuClose(); }}>Change Avatar</MenuItem>
        <MenuItem onClick={() => { setDeleteDialogOpen(true); handleMenuClose(); }}>Delete</MenuItem>
      </Menu>
      {/* Create Wishlist Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="xs" TransitionComponent={Transition} PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center', pb: 1 }}>Create New Wishlist</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Wishlist Name" value={newWishlistName} onChange={e => setNewWishlistName(e.target.value)} variant="outlined" autoFocus sx={{ mt: 2 }} inputProps={{ maxLength: 40 }} />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button fullWidth variant="text" onClick={() => setCreateDialogOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button fullWidth variant="contained" color="success" onClick={handleCreate} disabled={!newWishlistName.trim()} sx={{ borderRadius: 2 }}>Create</Button>
        </DialogActions>
      </Dialog>
      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => { setRenameDialogOpen(false); setMenuTargetId(null); }} fullWidth maxWidth="xs" TransitionComponent={Transition} PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center', pb: 1 }}>Rename Wishlist</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Wishlist Name" value={renameWishlistName} onChange={e => setRenameWishlistName(e.target.value)} variant="outlined" autoFocus sx={{ mt: 2 }} inputProps={{ maxLength: 40 }} />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button fullWidth variant="text" onClick={() => setRenameDialogOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button fullWidth variant="contained" color="success" onClick={handleRename} disabled={!renameWishlistName.trim()} sx={{ borderRadius: 2 }}>Rename</Button>
        </DialogActions>
      </Dialog>
      {/* Avatar Dialog */}
      <Dialog open={avatarDialogOpen} onClose={() => { setAvatarDialogOpen(false); setAvatarTargetId(null); setSelectedAvatar(null); }} fullWidth maxWidth="xs" TransitionComponent={Transition} PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center', pb: 1 }}>Choose an Avatar</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', mt: 1 }}>
            {[
              // Emojis
              { type: 'emoji', value: '😀' }, { type: 'emoji', value: '😎' }, { type: 'emoji', value: '🤩' },
              { type: 'emoji', value: '🎉' }, { type: 'emoji', value: '🦄' }, { type: 'emoji', value: '🐱' },
              { type: 'emoji', value: '🐶' }, { type: 'emoji', value: '🍕' }, { type: 'emoji', value: '🍔' },
              { type: 'emoji', value: '🍦' }, { type: 'emoji', value: '🌟' }, { type: 'emoji', value: '🍀' },
              // Icons (using emojis for now, can swap to MUI icons if needed)
              { type: 'icon', value: '❤️' }, { type: 'icon', value: '⭐' }, { type: 'icon', value: '🛒' },
              { type: 'icon', value: '🎁' }, { type: 'icon', value: '📦' }, { type: 'icon', value: '📝' },
              // Gradients
              { type: 'gradient', value: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)' },
              { type: 'gradient', value: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' },
              { type: 'gradient', value: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)' },
              { type: 'gradient', value: 'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)' },
              { type: 'gradient', value: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
              { type: 'gradient', value: 'linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%)' },
              { type: 'gradient', value: 'linear-gradient(135deg, #cfd9df 0%, #e2ebf0 100%)' },
            ].map((avatar, idx) => (
              <Box
                key={idx}
                sx={{
                  width: 54, height: 54, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, cursor: 'pointer', border: selectedAvatar === JSON.stringify(avatar) ? '3px solid #1976d2' : '2px solid #eee',
                  background: avatar.type === 'gradient' ? avatar.value : '#fff',
                  transition: 'border 0.2s',
                }}
                onClick={() => setSelectedAvatar(JSON.stringify(avatar))}
              >
                {avatar.type !== 'gradient' ? avatar.value : ''}
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button fullWidth variant="text" onClick={() => { setAvatarDialogOpen(false); setAvatarTargetId(null); setSelectedAvatar(null); }} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button fullWidth variant="contained" color="success" onClick={async () => {
            if (!user || !avatarTargetId || !selectedAvatar) return;
            const avatarObj = JSON.parse(selectedAvatar);
            await updateDoc(doc(db, "users", user.uid, "wishlists", avatarTargetId), { avatar: avatarObj });
            // Update local wishlists state for live UI update
            setWishlists(prev => prev.map(wl => wl.id === avatarTargetId ? { ...wl, avatar: avatarObj } : wl));
            setAvatarDialogOpen(false);
            setAvatarTargetId(null);
            setSelectedAvatar(null);
          }} disabled={!selectedAvatar} sx={{ borderRadius: 2 }}>Save</Button>
        </DialogActions>
      </Dialog>
      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => { setDeleteDialogOpen(false); setMenuTargetId(null); }} maxWidth="xs" fullWidth TransitionComponent={Transition} PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center', pb: 1 }}>Delete Wishlist</DialogTitle>
        <DialogContent>
          <Typography align="center">Are you sure you want to delete this wishlist?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button fullWidth variant="text" onClick={() => setDeleteDialogOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button fullWidth variant="contained" color="error" onClick={handleDelete} sx={{ borderRadius: 2 }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Create a fetch function to be used by pull-to-refresh
const fetchWishlists = async (user, setWishlists, setLoading) => {
  if (!user) return;
  setLoading(true);
  try {
    const colRef = collection(db, "users", user.uid, "wishlists");
    const snapshot = await getDocs(colRef);
    setWishlists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err) {
    setWishlists([]);
  }
  setLoading(false);
};

const WishlistPageWithPullToRefresh = withPullToRefresh(WishlistPage, async () => {
  try {
    if (user) {
      await fetchWishlists(user, setWishlists, setLoading);
    }
  } catch (error) {
    console.error('Error refreshing wishlists:', error);
  }
});

export default WishlistPageWithPullToRefresh;
