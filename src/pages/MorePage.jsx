import React, { useContext, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { 
  Box, 
  Typography, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Button, 
  IconButton, 
  Divider, 
  Collapse, 
  Paper,
  alpha,
  CircularProgress,
  Chip
} from "@mui/material";
import { styled } from '@mui/material/styles';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TranslateIcon from '@mui/icons-material/Translate';
import {
  Close as CloseIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  
  Home as HomeIcon,
  Lock as LockIcon,
  ShoppingBag as ShoppingBagIcon,
  Payment as PaymentIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Info as InfoIcon,
  Report as ReportIcon,
  ExitToApp as LogoutIcon,
  
  LocationOn as AddressIcon,
  LocalShipping as ShippingIcon,
  AssignmentReturn as ReturnIcon,
  Gavel as GavelIcon,
  Policy as PolicyIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';

import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import UserDataPage from "./UserDataPage";
import CoinBalanceCard from '../components/CoinBalanceCard';

const getMenuItems = (t) => [
  { key: "home", label: t("home"), path: "/", icon: <HomeIcon color="primary" /> },
  { key: "myOrders", label: t("myOrders"), path: "/orders", icon: <ShoppingBagIcon sx={{ color: '#ff6d00' }} /> },
  { key: "addresses", label: t("addresses"), path: "/addresses", icon: <AddressIcon sx={{ color: '#00c853' }} /> },
  { key: "settings", label: t("settings"), path: "/settings", icon: <LockIcon sx={{ color: '#c51162' }} /> },
  { key: "contactUs", label: t("contactUs"), path: "/contact", icon: <EmailIcon sx={{ color: '#00b8d4' }} /> },
  { key: "aboutUs", label: t("aboutUs"), path: "/about", icon: <InfoIcon sx={{ color: '#0091ea' }} /> },
  { key: "reportProblem", label: t("reportProblem"), path: "/report", icon: <ReportIcon color="error" /> },
  { key: "requestProduct", label: t("requestProduct"), path: "/request-product", icon: <ShoppingBagIcon sx={{ color: '#673ab7' }} /> },
];

import ShareButtonIcon from '@mui/icons-material/Share';
import contactInfo from '../constants/contactInfo';

const getPolicyItems = (t) => [
  { key: "termsAndConditions", label: t("termsAndConditions"), path: "/terms", icon: <GavelIcon sx={{ color: '#7b1fa2' }} /> },
  { key: "privacyPolicy", label: t("privacyPolicy"), path: "/privacy", icon: <PolicyIcon sx={{ color: '#455a64' }} /> },
  { key: "refundAndCancellation", label: t("refundAndCancellation"), path: "/refund-cancellation", icon: <ReceiptIcon sx={{ color: '#ff6d00' }} /> },
  { key: "shippingPolicy", label: t("shippingPolicy"), path: "/shipping", icon: <ShippingIcon sx={{ color: '#00c853' }} /> },
  { key: "returnPolicy", label: t("returnPolicy"), path: "/return", icon: <ReturnIcon sx={{ color: '#0091ea' }} /> },
];

const StyledListItem = styled(ListItem)(({ theme }) => ({
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    borderRadius: theme.shape.borderRadius,
  },
  marginBottom: theme.spacing(0.5),
}));

const MorePage = ({ onClose }) => {
  const navigate = useNavigate();
  const { user, userDetails } = useContext(AuthContext);
  const { language, setLanguage, t } = useLanguage();
  const menuItems = getMenuItems(t);
  const policyItems = getPolicyItems(t);
  const referAndEarnItem = { label: t("referAndEarn"), path: "/refer-and-earn", icon: <ShareButtonIcon sx={{ color: '#43a047' }} /> };

  const [langAnchorEl, setLangAnchorEl] = useState(null);
  const openLangMenu = Boolean(langAnchorEl);
  const handleLangMenuOpen = (event) => setLangAnchorEl(event.currentTarget);
  const handleLangMenuClose = () => setLangAnchorEl(null);
  const handleLangSelect = (lang) => {
    setLanguage(lang);
    setLangAnchorEl(null);
  };
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [profile, setProfile] = useState({ fullName: '', number: '', countryCode: '+91' });

  useEffect(() => {
    if (userDetails) {
      setProfile({
        fullName: userDetails.fullName || '',
        number: userDetails.number || '',
        countryCode: userDetails.countryCode || '+91',
      });
    } else {
      setProfile({ fullName: '', number: '', countryCode: '+91' });
    }
  }, [userDetails]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (onClose) onClose();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleLogin = () => {
    if (onClose) onClose();
    navigate("/login");
  };

  // handleEditProfile removed per design — greeting-only header

  const handleCallToOrder = () => {
    const phone = contactInfo.phone.replace(/\s+/g, '');
    window.open(`tel:${phone}`, '_self');
    if (onClose) onClose();
  };

  // Filter menu items based on user login status
  const filteredMenuItems = user ? menuItems : [];

  return (
    <>
      <Menu
        anchorEl={langAnchorEl}
        open={openLangMenu}
        onClose={handleLangMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        style={{ zIndex: 2000 }}
        transitionDuration={200}
        PopoverClasses={{
          root: 'MuiPopover-root',
          paper: 'MuiPopover-paper'
        }}
        MenuListProps={{
          sx: { py: 0.5 }
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 160,
              backgroundColor: 'background.paper',
              backgroundImage: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.03)} 0%, ${alpha(theme.palette.primary.main, 0.01)} 100%)`,
              border: '1px solid',
              borderColor: (theme) => alpha(theme.palette.primary.main, 0.08),
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              '& .MuiMenuItem-root': {
                px: 2,
                py: 1.2,
                my: 0.2,
                mx: 0.5,
                borderRadius: 1,
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
                },
                '&.Mui-selected': {
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.12),
                  '&:hover': {
                    backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.16),
                  }
                }
              }
            }
          }
        }}
      >
        <MenuItem selected={language === 'english'} onClick={() => handleLangSelect('english')}>
          <Typography variant="body2" sx={{ fontWeight: language === 'english' ? 600 : 500, color: language === 'english' ? 'primary.main' : 'text.primary', fontSize: '0.9rem', letterSpacing: 0.2 }}>English</Typography>
        </MenuItem>
        <MenuItem selected={language === 'tamil'} onClick={() => handleLangSelect('tamil')}>
          <Typography variant="body2" sx={{ fontWeight: language === 'tamil' ? 600 : 500, color: language === 'tamil' ? 'primary.main' : 'text.primary', fontSize: '0.9rem', letterSpacing: 0.2 }}>தமிழ் (Tamil)</Typography>
        </MenuItem>
      </Menu>
      <Box sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        minWidth: 320,
        maxWidth: 400,
        position: 'relative',
      }}>
      {/* Header */}
      <Box sx={{ 
        px: 2, 
        pt: 2, 
        pb: 1,
        position: 'sticky',
        top: 0,
        zIndex: 1,
        bgcolor: 'background.paper',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
      <Box display="flex" alignItems="center">
          <IconButton 
            onClick={onClose} 
            sx={{ mr: 1, color: 'text.primary' }}
            size="large"
          >
            <CloseIcon />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700 }}>
              {t('hello') || 'Hello'}!
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary', mt: 0.1 }} noWrap>
              {profile.fullName || (language === 'tamil' ? 'பயனர்' : 'Guest')}
            </Typography>
          </Box>
          {/* Language selection dropdown in header (top right) */}
          <Box sx={{ ml: 1, position: 'relative' }}>
            <Button
              startIcon={<TranslateIcon sx={{ fontSize: 20, color: 'primary.main' }} />}
              endIcon={<ExpandMoreIcon sx={{ fontSize: 18, ml: -0.5, color: 'text.secondary' }} />}
              onClick={handleLangMenuOpen}
              sx={{
                minWidth: 0,
                px: 1.5,
                py: 0.8,
                fontWeight: 600,
                borderRadius: 2,
                textTransform: 'none',
                color: 'text.primary',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                border: '1px solid',
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.1),
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                position: 'relative',
                zIndex: 1400,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.05)'
                },
                '&:active': {
                  transform: 'translateY(0)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }
              }}
            >
              <Typography variant="body2" sx={{ fontSize: '0.9rem', fontWeight: 600, letterSpacing: 0.2 }}>
                {language === 'tamil' ? 'தமிழ்' : 'English'}
              </Typography>
            </Button>
          </Box>
        </Box>
      </Box>
      
      <Divider />

      {/* Phone Order - compact card, visible for all users */}
      <Box sx={{ px: 1, pb: 0 }}>
        <StyledListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton 
            onClick={handleCallToOrder}
            sx={{ 
              px: 1.5, // reduced left/right padding
              py: 1.0,
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, #43a047 0%, #2e7d32 100%)',
              color: 'common.white',
              boxShadow: 2,
              '&:hover': { boxShadow: 4, transform: 'translateY(-0.5px)' }
            }}
          >
            <ListItemText 
              primary={t('callToOrder') || "Order Instantly by Phone"}
              primaryTypographyProps={{
                variant: 'body1',
                fontWeight: 600,
                color: 'common.white'
              }}
            />
            <IconButton
              onClick={handleCallToOrder}
              aria-label="Call store"
              sx={{
                ml: 1,
                bgcolor: 'rgba(255,255,255,0.12)',
                color: 'common.white',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
                width: 40,
                height: 40,
                borderRadius: 1.5
              }}
              size="large"
            >
              <PhoneIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </ListItemButton>
        </StyledListItem>
      </Box>

      {user === undefined ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : user ? (
        <React.Fragment>
          

          {/* All scrollable content below profile */}
          <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Phone Order - compact card, fix padding to match */}
            <Box sx={{ px: 1, pb: 0 }}>
              <List disablePadding>
                  {filteredMenuItems.map((item, idx) => {
                    // Insert Refer & Earn after Addresses
                    if (item.key === 'addresses') {
                      return [
                        <StyledListItem key={item.path} disablePadding sx={{ mb: 0.2 }}>
                          <ListItemButton 
                            onClick={() => { if (onClose) onClose(); navigate(item.path); }}
                            sx={{ px: 1.5, py: 0.6 }}
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              {item.icon}
                            </ListItemIcon>
                            <ListItemText 
                              primary={item.label}
                              primaryTypographyProps={{
                                variant: 'body1',
                                fontWeight: 500,
                                color: 'text.primary'
                              }}
                            />
                          </ListItemButton>
                        </StyledListItem>,
                        <StyledListItem key="refer-and-earn" disablePadding sx={{ mb: 0.2 }}>
                          <ListItemButton
                            onClick={() => {
                              if (onClose) onClose();
                              let accepted = false;
                              try { accepted = localStorage.getItem('referralTermsAccepted') === 'true'; } catch (_) {}
                              if (accepted) {
                                navigate(referAndEarnItem.path);
                              } else {
                                navigate('/refer-terms', { state: { from: referAndEarnItem.path } });
                              }
                            }}
                            sx={{ px: 1.5, py: 0.6 }}
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              {referAndEarnItem.icon}
                            </ListItemIcon>
                            <ListItemText
                              primary={referAndEarnItem.label}
                              primaryTypographyProps={{
                                variant: 'body1',
                                fontWeight: 500,
                                color: 'text.primary'
                              }}
                            />
                          </ListItemButton>
                        </StyledListItem>
                      ];
                    }
                    // Insert Language selection as a settings option (removed, now at bottom)
                    if (item.label === 'Change Password') {
                      return (
                        <StyledListItem key={item.path} disablePadding sx={{ mb: 0.2 }}>
                          <ListItemButton 
                            onClick={() => { if (onClose) onClose(); navigate(item.path); }}
                            sx={{ px: 2, py: 0.7 }}
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              {item.icon}
                            </ListItemIcon>
                            <ListItemText 
                              primary={item.label}
                              primaryTypographyProps={{
                                variant: 'body1',
                                fontWeight: 500,
                                color: 'text.primary'
                              }}
                            />
                          </ListItemButton>
                        </StyledListItem>
                      );
                    }
                    return (
                      <StyledListItem key={item.path} disablePadding sx={{ mb: 0.2 }}>
                        <ListItemButton 
                          onClick={() => { if (onClose) onClose(); navigate(item.path); }}
                          sx={{ px: 2, py: 0.7 }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            {item.icon}
                          </ListItemIcon>
                          <ListItemText 
                            primary={item.label}
                            primaryTypographyProps={{
                              variant: 'body1',
                              fontWeight: 500,
                              color: 'text.primary'
                            }}
                          />
                        </ListItemButton>
                      </StyledListItem>
                    );
                  })}
                  {/* Add Coin Management as a normal menu item at the end */}
                  <StyledListItem key="coin-management" disablePadding sx={{ mb: 0.2 }}>
                    <ListItemButton
                      onClick={() => {
                        if (onClose) onClose();
                        let accepted = false;
                        try { accepted = localStorage.getItem('coinTermsAccepted') === 'true'; } catch (_) {}
                        if (accepted) {
                          navigate('/coin-management');
                        } else {
                          navigate('/coin-terms', { state: { from: '/coin-management' } });
                        }
                      }}
                      sx={{ px: 2, py: 0.7 }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <ReceiptIcon sx={{ color: '#ff6d00' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={language === 'tamil' ? 'நாணயங்கள் மேலாண்மை' : 'Coin Management'}
                        primaryTypographyProps={{
                          variant: 'body1',
                          fontWeight: 500,
                          color: 'text.primary'
                        }}
                      />
                    </ListItemButton>
                  </StyledListItem>

                {/* Policies Section */}
                <StyledListItem disablePadding>
                  <ListItemButton 
                    onClick={() => setPoliciesOpen(!policiesOpen)}
                    sx={{ px: 2, py: 1.25 }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <GavelIcon sx={{ color: '#7b1fa2' }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={t('policies') || "Policies"}
                      primaryTypographyProps={{
                        variant: 'body1',
                        fontWeight: 500,
                        color: 'text.primary'
                      }}
                    />
                    {policiesOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </ListItemButton>
                </StyledListItem>
                <Collapse in={policiesOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {policyItems.map((item) => (
                      <StyledListItem key={item.path} disablePadding>
                        <ListItemButton
                          onClick={() => {
                            if (onClose) onClose();
                            navigate(item.path);
                          }}
                          sx={{ pl: 6, py: 0.8 }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            {item.icon}
                          </ListItemIcon>
                          <ListItemText 
                            primary={item.label}
                            primaryTypographyProps={{
                              variant: 'body2',
                              color: 'text.secondary'
                            }}
                          />
                        </ListItemButton>
                      </StyledListItem>
                    ))}
                  </List>
                </Collapse>
              </List>

              </Box>

            {/* Logout Button at bottom */}
            <Box sx={{
              p: 1.5,
              bgcolor: 'background.paper',
              borderTop: '1px solid',
              borderColor: 'divider',
              mt: 'auto'
            }}>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{
                  py: 1.2,
                  fontWeight: 600,
                  borderRadius: 2,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: 'error.light',
                    color: 'error.contrastText',
                  }
                }}
              >
                {t('logout') || "Logout"}
              </Button>
            </Box>
          </Box>
          {/* Edit Profile Dialog removed: navigating to /userdata instead for better UX */}

  </React.Fragment>
      ) : (
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          p: 4,
          textAlign: 'center'
        }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: 'action.hover', mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="h4" sx={{ color: 'text.secondary', fontWeight: 700 }}>S</Typography>
          </Box>
          <Typography variant="h6" color="text.primary" fontWeight={600} gutterBottom>
            Welcome to Sri Amman Smart Store
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 320 }}>
            {language === 'tamil' ? 'உங்கள் ஆர்டர்கள், முகவரிகள் மற்றும் கணக்கு விவரங்களை அணுக உள்நுழையவும்.' : 'Login to access your orders, addresses, payment options, and more.'}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            onClick={handleLogin}
            sx={{
              py: 1.5,
              fontWeight: 600,
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '1rem',
              maxWidth: 280,
              '&:hover': {
                boxShadow: 4,
                transform: 'translateY(-1px)',
                transition: 'all 0.2s'
              }
            }}
          >
            {language === 'tamil' ? 'உள்நுழைய / பதிவு செய்ய' : 'Login / Sign Up'}
          </Button>
        </Box>
      )}
    </Box>
  </>
);

};

export default MorePage;