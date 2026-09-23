import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  TextField,
  Typography,
  Box,
  Divider,
  Slide
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Add as AddIcon
} from '@mui/icons-material';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const WishlistDialog = ({
  open,
  onClose,
  mode, // 'manage' or 'add'
  setMode,
  wishlists,
  product,
  selectedOption,
  optionsInWishlists,
  onRemoveFromWishlist,
  onAddToWishlist,
  newWishlistName,
  setNewWishlistName,
  onCreateWishlist
}) => {
  const getOptionLabel = (option) => {
    return `${option.unitSize} ${option.unit}`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      TransitionComponent={Transition}
      PaperProps={{
        elevation: 8,
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', fontWeight: 800, pb: 1 }}>
        {mode === 'manage' ? 'Manage Wishlist' : 'Select Wishlist'}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        {mode !== 'manage' && (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
            Choose a wishlist to add this product
          </Typography>
        )}
        {mode === 'manage' ? (
          <>
            {Object.keys(optionsInWishlists).length === 0 ? (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Not in any wishlist</Typography>
                <Typography color="text.secondary">Add it to keep track and buy later.</Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {Object.entries(optionsInWishlists).map(([wishlistId, options]) => (
                  <React.Fragment key={wishlistId}>
                    <ListItem sx={{ py: 1 }}>
                      <ListItemText
                        primary={wishlists.find(w => w.id === wishlistId)?.name || wishlistId}
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            {options.map((option, idx) => (
                              <Box
                                key={idx}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  mb: 1
                                }}
                              >
                                <Typography variant="body2">
                                  {getOptionLabel(option)}
                                </Typography>
                                <IconButton
                                  edge="end"
                                  aria-label="delete"
                                  onClick={() => onRemoveFromWishlist(wishlistId, option)}
                                  size="small"
                                  color="error"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            ))}
                          </Box>
                        }
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            )}
            <Button
              startIcon={<AddIcon />}
              onClick={() => setMode('add')}
              variant="contained"
              fullWidth
              sx={{ mt: 2, borderRadius: 2 }}
            >
              Add to Another Wishlist
            </Button>
          </>
        ) : (
          <>
            <List dense disablePadding>
              {/* Always show General wishlist first if not already containing the option */}
              {!optionsInWishlists['general']?.find(opt => 
                opt.unit === selectedOption.unit && opt.unitSize === selectedOption.unitSize
              ) && (
                <ListItem
                  secondaryAction={
                    <Button size="small" variant="contained" color="success" onClick={() => onAddToWishlist('general', selectedOption)}>
                      Add
                    </Button>
                  }
                  disablePadding
                >
                  <ListItemButton onClick={() => onAddToWishlist('general', selectedOption)} sx={{ borderRadius: 2, px: 2, py: 1 }}>
                    <ListItemText primary="General" />
                  </ListItemButton>
                </ListItem>
              )}

              {/* Show other wishlists */}
              {wishlists.filter(w => w.id !== 'general').map(wishlist => {
                const hasOption = optionsInWishlists[wishlist.id]?.find(opt =>
                  opt.unit === selectedOption.unit && opt.unitSize === selectedOption.unitSize
                );
                if (hasOption) return null;
                return (
                  <ListItem
                    key={wishlist.id}
                    secondaryAction={
                      <Button size="small" variant="contained" color="success" onClick={() => onAddToWishlist(wishlist.id, selectedOption)}>
                        Add
                      </Button>
                    }
                    disablePadding
                  >
                    <ListItemButton onClick={() => onAddToWishlist(wishlist.id, selectedOption)} sx={{ borderRadius: 2, px: 2, py: 1 }}>
                      <ListItemText primary={wishlist.name} />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
            
            <Divider sx={{ my: 2 }} />
            
            {/* Create new wishlist section */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>
                Create New Wishlist
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Enter wishlist name"
                  value={newWishlistName}
                  onChange={(e) => setNewWishlistName(e.target.value)}
                  inputProps={{ maxLength: 40 }}
                />
                <Button
                  variant="contained"
                  color="success"
                  onClick={onCreateWishlist}
                  disabled={!newWishlistName.trim()}
                  sx={{ borderRadius: 2 }}
                >
                  Create
                </Button>
              </Box>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button fullWidth variant="text" onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default WishlistDialog;
