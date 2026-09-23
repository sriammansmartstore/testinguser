import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  useTheme,
  useMediaQuery
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

const AuthRequiredPrompt = ({ open, onClose }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleLogin = () => {
    onClose();
    navigate('/login', { state: { from: window.location.pathname } });
  };

  const handleSignup = () => {
    onClose();
    navigate('/signup', { state: { from: window.location.pathname } });
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          m: isMobile ? 0 : 2,
          borderRadius: isMobile ? 0 : 2,
          maxWidth: isMobile ? '100%' : '500px',
          maxHeight: isMobile ? '100%' : 'none',
        }
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 3 }, textAlign: 'center', position: 'relative' }}>
        {isMobile && (
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        )}
        
        <DialogTitle 
          sx={{ 
            fontWeight: 'bold',
            fontSize: isMobile ? '1.25rem' : '1.5rem',
            px: isMobile ? 0 : 2,
            pt: isMobile ? 1 : 0
          }}
        >
          Sign In Required
        </DialogTitle>
        
        <DialogContent sx={{ px: isMobile ? 0 : 2, py: 2 }}>
          <DialogContentText sx={{ fontSize: isMobile ? '0.95rem' : '1rem' }}>
            You need to be signed in to add items to your cart.
            Please sign in or create an account to continue.
          </DialogContentText>
        </DialogContent>
        
        <DialogActions 
          sx={{ 
            flexDirection: isMobile ? 'column' : 'row',
            gap: 2, 
            p: isMobile ? 2 : 0,
            px: isMobile ? 1 : 3,
            pb: isMobile ? 3 : 2,
            '& > *': {
              m: '0 !important',
              width: isMobile ? '100%' : 'auto',
            }
          }}
        >
          <Button
            variant="outlined"
            onClick={handleLogin}
            startIcon={<LoginIcon />}
            fullWidth
            size={isMobile ? 'large' : 'medium'}
            sx={{
              py: isMobile ? 1.5 : 1,
              minHeight: '48px',
              fontSize: isMobile ? '1rem' : '0.9375rem',
            }}
          >
            Sign In
          </Button>
          <Button
            variant="contained"
            onClick={handleSignup}
            startIcon={<PersonAddIcon />}
            fullWidth
            size={isMobile ? 'large' : 'medium'}
            sx={{
              py: isMobile ? 1.5 : 1,
              minHeight: '48px',
              fontSize: isMobile ? '1rem' : '0.9375rem',
            }}
          >
            Create Account
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default AuthRequiredPrompt;
