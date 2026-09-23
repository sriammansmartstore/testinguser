import React from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Box, Tooltip } from '@mui/material';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';

/**
 * ShareButton
 * - Renders a top-left circular button like the wishlist heart but for sharing
 * - Opens a menu with multiple share options: Native Share, WhatsApp, Facebook, Twitter, Copy Link
 * - Ensures high z-index so it isn't hidden by the product image/link
 */
export default function ShareButton({ product, sx = {} }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { url, title, text } = getShare();
    // Try native share first
    if (navigator?.share) {
      try {
        await navigator.share({ title, text, url });
        return; // Done
      } catch (err) {
        // If user cancels, just return silently; if unsupported error, fall back
        // Some browsers may throw; we'll fallback to menu in that case
      }
    }
    // Fallback to menu for manual share options
    setAnchorEl(e.currentTarget);
  };
  const handleClose = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setAnchorEl(null);
  };

  const getShare = () => {
    const path = `/product/${product?.category}/${product?.id}`;
    const url = window.location?.origin ? `${window.location.origin}${path}` : path;
    const title = product?.name || 'Product';
    const text = `Check this out: ${title}`;
    return { url, title, text };
  };

  const shareNative = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { url, title, text } = getShare();
      if (navigator?.share) {
        await navigator.share({ title, text, url });
      } else {
        await copyLink();
      }
    } catch (_) {}
    handleClose(e);
  };

  const copyLink = async () => {
    const { url } = getShare();
    try {
      if (navigator?.clipboard && window?.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const tmp = document.createElement('input');
        tmp.value = url;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        document.body.removeChild(tmp);
      }
      alert('Link copied!');
    } catch (_) {
      alert('Copy failed.');
    }
  };

  const shareTo = (platform) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { url, text } = getShare();
    let shareUrl = '';
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        break;
      default:
        break;
    }
    if (shareUrl) window.open(shareUrl, '_blank', 'noopener,noreferrer');
    handleClose(e);
  };

  return (
    <Box
      sx={(theme) => ({
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: (theme?.zIndex?.modal ?? 1300) + 2,
        pointerEvents: 'auto',
        ...sx,
      })}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <Tooltip title="Share">
        <IconButton
          onClick={handleClick}
          sx={(theme) => ({ p: 0.5, background: '#fff', boxShadow: 1, borderRadius: '50%', zIndex: (theme?.zIndex?.modal ?? 1300) + 3 })}
          aria-label="Share product"
          size="small"
        >
          <ReplyRoundedIcon fontSize="small" sx={{ color: '#2e7d32', transform: 'scaleX(-1)' }} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        MenuListProps={{ 'aria-labelledby': 'share-button' }}
      >
        <MenuItem onClick={shareNative}>
          <ListItemIcon>
            <ReplyRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share...</ListItemText>
        </MenuItem>
        <MenuItem onClick={shareTo('whatsapp')}>
          <ListItemIcon>
            <WhatsAppIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>WhatsApp</ListItemText>
        </MenuItem>
        <MenuItem onClick={shareTo('facebook')}>
          <ListItemIcon>
            <FacebookIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Facebook</ListItemText>
        </MenuItem>
        <MenuItem onClick={shareTo('twitter')}>
          <ListItemIcon>
            <TwitterIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Twitter/X</ListItemText>
        </MenuItem>
        <MenuItem onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await copyLink(); handleClose(e); }}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy link</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
