import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Paper,
  Divider,
} from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const SearchSuggestions = ({ suggestions, onSelect, onClose }) => {
  const navigate = useNavigate();
  const { t, getProductName, getCategoryName } = useLanguage();

  // Navigation is handled by parent via onSelect

  const handleItemClick = (item, type) => {
    if (onClose) onClose();
    if (onSelect) onSelect(item, type);
    // Navigation is handled by the parent (HomePage or CategoriesPage)
  };

  // Show empty state message when both lists are empty
  if (suggestions.categories.length === 0 && suggestions.products.length === 0) {
    return (
      <>
        <Paper 
          elevation={3} 
          sx={{ 
            position: 'absolute', 
            top: '100%', 
            left: 0, 
            right: 0, 
            mt: 1,
            backgroundColor: 'white',
            border: '1px solid',
            borderColor: 'divider',
            zIndex: 1400
          }}
        >
          <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            {t('noMatchingItems', 'No matching items found')}
          </Box>
          <Box 
            sx={{ 
              p: 2, 
              borderTop: '1px solid', 
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'center'
            }}
            onClick={() => navigate('/request-product')}
          >
            <Typography
              variant="body2"
              color="primary"
              sx={{
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              {t('cantFindRequestProduct', "Can't find what you're looking for? Request a product")}
            </Typography>
          </Box>
        </Paper>
      </>
    );
  }

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        position: 'absolute', 
        top: '100%', 
        left: 0, 
        right: 0, 
        mt: 1, 
        maxHeight: '60vh',
        overflowY: 'auto',
        zIndex: 1400,
        borderRadius: 2,
        backgroundColor: 'white',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      {suggestions.categories.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ p: 1, pl: 2, bgcolor: 'grey.100', fontWeight: 600 }}>
            {t('categories', 'Categories')}
          </Typography>
          <List dense>
            {suggestions.categories.map((category) => (
              <ListItem 
                key={category.id} 
                button 
                onMouseDown={(e) => { e.preventDefault(); handleItemClick(category, 'category'); }}
                sx={{
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar 
                    src={category.imageUrl}
                    alt={getCategoryName(category)}
                    sx={{ bgcolor: 'grey.200' }}
                  >
                    <CategoryIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary={getCategoryName(category)}
                  primaryTypographyProps={{ fontWeight: 500 }}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}

      {suggestions.products.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ p: 1, pl: 2, bgcolor: 'grey.100', fontWeight: 600 }}>
            {t('products', 'Products')}
          </Typography>
          <List dense>
            {suggestions.products.map((product) => (
              <ListItem 
                key={product.id} 
                button 
                onMouseDown={(e) => { e.preventDefault(); handleItemClick(product, 'product'); }}
                sx={{
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar 
                    src={product.imageUrl} 
                    alt={getProductName(product)}
                    variant="rounded"
                    sx={{ 
                      width: 48,
                      height: 48,
                      borderRadius: 1
                    }}
                  >
                    <ShoppingBagIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary={getProductName(product)}
                  secondary={
                    <Box>
                      <Typography variant="body2" component="span" color="text.secondary">
                        {getCategoryName(product.category)}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        component="div" 
                        sx={{ 
                          color: 'success.main',
                          fontWeight: 600,
                          mt: 0.5
                        }}
                      >
                        ₹{product.price}
                      </Typography>
                    </Box>
                  }
                  primaryTypographyProps={{ fontWeight: 500 }}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Paper>
  );
};

export default SearchSuggestions;