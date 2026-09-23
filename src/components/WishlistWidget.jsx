import React, { useState, useEffect, useContext } from 'react';
import { IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Button, TextField } from '@mui/material';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { AuthContext } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, addDoc, deleteDoc, getDoc } from 'firebase/firestore';

const WishlistWidget = ({ product, selectedOption, onAdd, inline = false, sx: containerSx }) => {
  const { user } = useContext(AuthContext) || {};
  const [wishlists, setWishlists] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectingCreate, setSelectingCreate] = useState(false);
  const [newWishlistName, setNewWishlistName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isPresent, setIsPresent] = useState(false);
  const [presentWishlists, setPresentWishlists] = useState([]); // ids of wishlists that already have this product
  // per-wishlist quantities removed — single default quantity used

  const getOptionKey = () => {
    if (!product) return null;
    // if a specific option is provided, use it; otherwise if product has a single option, use that
    const opt = selectedOption || (Array.isArray(product.options) && product.options.length === 1 ? product.options[0] : null);
    if (opt && opt.unit && opt.unitSize) {
      return `${product.id}_${opt.unit}_${opt.unitSize}`;
    }
    return product.id;
  };

  const [userDocId, setUserDocId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (!user) { setUserDocId(""); return; }
        const mapSnap = await getDoc(doc(db, 'usersByUid', user.uid));
        setUserDocId(mapSnap.exists() ? (mapSnap.data()?.userDocId || "") : "");
      } catch (_) { setUserDocId(""); }
    })();
  }, [user]);

  useEffect(() => {
    const fetch = async () => {
      if (!user || !userDocId || !product) {
        setWishlists([]);
        setIsPresent(false);
        return;
      }
      try {
        const colRef = collection(db, 'users', userDocId, 'wishlists');
        const snap = await getDocs(colRef);
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setWishlists(fetched);

        // check presence per-wishlist
        const optionKey = getOptionKey();
        let found = false;
        const present = [];
        for (const wl of snap.docs) {
          const prodRef = collection(db, 'users', userDocId, 'wishlists', wl.id, 'products');
          const prodSnap = await getDocs(prodRef);
          if (prodSnap.docs.some(d => d.id === optionKey)) {
            found = true;
            present.push(wl.id);
          }
        }
        setIsPresent(found);
        setPresentWishlists(present);
      } catch (err) {
        setWishlists([]);
        setIsPresent(false);
      }
    };
    fetch();
  }, [user, userDocId, product, selectedOption, open]);

  const handleOpen = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!user) return alert('Please login to use wishlists.');
    setOpen(true);
  };

  // quantity controls removed from dialog UI; keep `quantity` as single numeric state

  const handleSelect = async (wishlistId, qtyArg) => {
    if (!user || !userDocId || !product) return;
    try {
      const optionKey = getOptionKey();
      const optionToSave = selectedOption || (Array.isArray(product.options) && product.options.length === 1 ? product.options[0] : {});
  // normalize quantity: prefer explicit arg, otherwise use shared `quantity`
  const raw = qtyArg ?? quantity;
  const qty = Math.max(1, parseInt(raw, 10) || 1);
  console.debug('WishlistWidget.handleSelect', { wishlistId, raw, qtyArg, sharedQuantity: quantity, finalQty: qty });
      await setDoc(doc(db, 'users', userDocId, 'wishlists', wishlistId, 'products', optionKey), {
        ...product,
        ...optionToSave,
        quantity: qty,
        productId: product.id,
        addedAt: new Date().toISOString(),
      });
      setOpen(false);
  setQuantity('1');
      if (onAdd) onAdd(product);
    } catch (err) {
      console.error('handleSelect error:', err);
      alert('Failed to add to wishlist: ' + (err?.message || err));
    }
  };

  const handleCreateAndAdd = async (qtyArg) => {
    if (!user || !userDocId || !product || !newWishlistName.trim()) return;
    try {
      const colRef = collection(db, 'users', userDocId, 'wishlists');
      const docRef = await addDoc(colRef, { name: newWishlistName.trim(), createdAt: new Date().toISOString() });
      const optionKey = getOptionKey();
      const optionToSave = selectedOption || (Array.isArray(product.options) && product.options.length === 1 ? product.options[0] : {});
  const raw = qtyArg ?? quantity;
  const qty = Math.max(1, parseInt(raw, 10) || 1);
  console.debug('WishlistWidget.handleCreateAndAdd', { raw, qtyArg, sharedQuantity: quantity, finalQty: qty });
      await setDoc(doc(db, 'users', userDocId, 'wishlists', docRef.id, 'products', optionKey), {
        ...product,
        ...optionToSave,
        quantity: qty,
        productId: product.id,
        addedAt: new Date().toISOString(),
      });
      setNewWishlistName('');
      setSelectingCreate(false);
      setOpen(false);
  setQuantity('1');
      if (onAdd) onAdd(product);
    } catch (err) {
      console.error('handleCreateAndAdd error:', err);
      alert('Failed to create wishlist: ' + (err?.message || err));
    }
  };

  const handleAddToGeneral = async (qtyArg) => {
    if (!user || !product) return;
    try {
      const genRef = doc(db, 'users', userDocId, 'wishlists', 'general');
      await setDoc(genRef, { name: 'General', createdAt: new Date().toISOString() }, { merge: true });
      const optionKey = getOptionKey();
      const optionToSave = selectedOption || (Array.isArray(product.options) && product.options.length === 1 ? product.options[0] : {});
  const raw = qtyArg ?? quantity;
  const qty = Math.max(1, parseInt(raw, 10) || 1);
  console.debug('WishlistWidget.handleAddToGeneral', { raw, qtyArg, sharedQuantity: quantity, finalQty: qty });
      await setDoc(doc(db, 'users', userDocId, 'wishlists', 'general', 'products', optionKey), {
        ...product,
        ...optionToSave,
        quantity: qty,
        productId: product.id,
        addedAt: new Date().toISOString(),
      });
      setOpen(false);
  setQuantity('1');
      if (onAdd) onAdd(product);
    } catch (err) {
      console.error('handleAddToGeneral error:', err);
      alert('Failed to add to general wishlist: ' + (err?.message || err));
    }
  };

  const handleRemove = async (wishlistId) => {
    if (!user || !userDocId || !product || !wishlistId) return;
    try {
      const optionKey = getOptionKey();
      await deleteDoc(doc(db, 'users', userDocId, 'wishlists', wishlistId, 'products', optionKey));
      // update UI: remove this wishlist from present list so it disappears from the manage list
      setPresentWishlists(prev => {
        const next = prev.filter(id => id !== wishlistId);
        // update overall presence flag based on the new list
        setIsPresent(next.length > 0);
        return next;
      });
    } catch (err) {
      console.error('handleRemove error:', err);
      alert('Failed to remove from wishlist: ' + (err?.message || err));
    }
  };

  // whether 'general' wishlist already exists and whether it already contains this product
  const generalExists = wishlists.some(w => w.id === 'general');
  const presentSet = new Set(presentWishlists);
  const generalContains = presentSet.has('general');

  return (
    <>
      {/* Heart (wishlist) container */}
      <Box sx={{ position: inline ? 'static' : 'absolute', top: inline ? 'auto' : 8, right: inline ? 'auto' : 8, zIndex: 2, ...(containerSx || {}) }}>
        <IconButton onClick={handleOpen} sx={{ p: 0.5, background: '#fff', boxShadow: 1, borderRadius: '50%' }} aria-label="Add to wishlist">
          {isPresent ? <FavoriteIcon fontSize="small" sx={{ color: '#d32f2f' }} /> : <FavoriteBorderIcon fontSize="small" sx={{ color: '#d32f2f' }} />}
        </IconButton>
        <Dialog open={open} onClose={() => { setOpen(false); setSelectingCreate(false); setNewWishlistName(''); setQuantity('1'); }} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ textAlign: 'center', fontWeight: 700, fontSize: '1.2rem', pb: 1 }}>Select Wishlist</DialogTitle>
          <DialogContent sx={{ px: 2, py: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {wishlists.length === 0 ? (
                <>
                  <Typography variant="body2" sx={{ mb: 2, textAlign: 'center' }}>No wishlists found.</Typography>
                  {!generalContains && (
                    <Button variant="contained" color="primary" sx={{ mb: 2, borderRadius: 2 }} fullWidth onClick={() => handleAddToGeneral()}>Add to General Wishlist</Button>
                  )}
                  {!selectingCreate && (
                    <Button variant="outlined" color="success" sx={{ borderRadius: 2 }} fullWidth onClick={() => setSelectingCreate(true)}>Create New Wishlist</Button>
                  )}
                  {selectingCreate && (
                    <Box sx={{ mt: 2 }}>
                      <TextField label="New Wishlist Name" value={newWishlistName} onChange={e => setNewWishlistName(e.target.value)} fullWidth autoFocus sx={{ mb: 2 }} />
                      <Button variant="contained" color="success" fullWidth sx={{ borderRadius: 2 }} onClick={() => handleCreateAndAdd()}>Create & Add</Button>
                    </Box>
                  )}
                </>
              ) : (
                <>
                  <Typography variant="body2" sx={{ mb: 1, textAlign: 'center', fontWeight: 500 }}>Choose a wishlist to add this product:</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {wishlists.map(wl => (
                      <Box key={wl.id} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{wl.name || 'Unnamed Wishlist'}</Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {presentSet.has(wl.id) ? (
                            // already present: show only Remove
                            <Button variant="outlined" color="error" size="small" sx={{ borderRadius: 2 }} onClick={() => handleRemove(wl.id)}>Remove</Button>
                          ) : (
                            // show Add button for wishlists that don't yet contain the product
                            <Button variant="contained" color="success" size="small" sx={{ borderRadius: 2 }} onClick={() => handleSelect(wl.id)}>Add</Button>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                  {!selectingCreate && (
                    <Button variant="outlined" color="success" sx={{ mt: 2, borderRadius: 2 }} fullWidth onClick={() => setSelectingCreate(true)}>Create New Wishlist</Button>
                  )}
                  {!generalExists && (
                    <Button variant="contained" color="primary" sx={{ mt: 1, borderRadius: 2 }} fullWidth onClick={() => handleAddToGeneral()}>Add to General Wishlist</Button>
                  )}
                  {selectingCreate && (
                    <Box sx={{ mt: 2 }}>
                      <TextField label="New Wishlist Name" value={newWishlistName} onChange={e => setNewWishlistName(e.target.value)} fullWidth autoFocus sx={{ mb: 2 }} />
                      <Button variant="contained" color="success" fullWidth sx={{ borderRadius: 2 }} onClick={() => handleCreateAndAdd()}>Create & Add</Button>
                    </Box>
                  )}
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
            <Button onClick={() => { setOpen(false); setSelectingCreate(false); setNewWishlistName(''); }} color="inherit" sx={{ borderRadius: 2 }}>Cancel</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
};

export default WishlistWidget;
