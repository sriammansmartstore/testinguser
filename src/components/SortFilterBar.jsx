import React, { useState } from "react";
import { Box, Button, Slider, Typography, Checkbox, FormControlLabel, Chip, Stack } from "@mui/material";
import { KeyboardArrowDown as KeyboardArrowDownIcon } from '@mui/icons-material';
import { useLanguage } from "../context/LanguageContext";

export default function SortFilterBar({
  sort, setSort,
  filters, setFilters,
  units, brands,
  minPrice, maxPrice,
  minDiscount, maxDiscount,
  minRating, maxRating,
  onApply,
  compact = false,
}) {
  const { t } = useLanguage();
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const sortOptions = [
    { value: "priceLowHigh", label: t("priceLowHigh", "Price: Low to High") },
    { value: "priceHighLow", label: t("priceHighLow", "Price: High to Low") },
    { value: "newest", label: t("newestFirst", "Newest First") },
    { value: "oldest", label: t("oldestFirst", "Oldest First") },
    { value: "nameAZ", label: t("nameAZ", "Name: A to Z") },
    { value: "nameZA", label: t("nameZA", "Name: Z to A") },
    { value: "discount", label: t("highestDiscount", "Highest Discount") },
    { value: "rating", label: t("topRated", "Top Rated") },
    { value: "popularity", label: t("mostPopular", "Most Popular") },
    { value: "featured", label: t("featured", "Featured") },
  ];
  
  const handleSortClose = () => setIsSortOpen(false);
  const handleFilterClose = () => setIsFilterOpen(false);

  const toggleUnit = (u) => setFilters(f => ({ ...f, unit: f.unit.includes(u) ? f.unit.filter(x => x !== u) : [...f.unit, u] }));
  const toggleBrand = (b) => setFilters(f => ({ ...f, brand: f.brand.includes(b) ? f.brand.filter(x => x !== b) : [...f.brand, b] }));
  const resetFilters = () => setFilters({
    price: [minPrice, maxPrice],
    discount: [minDiscount, maxDiscount],
    rating: [minRating, maxRating],
    unit: [],
    brand: [],
    available: false,
  });

  // Allow global control via events from BottomNavbar
  React.useEffect(() => {
    const open = () => setIsFilterOpen(true);
    const close = () => setIsFilterOpen(false);
    const toggle = () => setIsFilterOpen(prev => !prev);
    window.addEventListener('open-filters', open);
    window.addEventListener('close-filters', close);
    window.addEventListener('toggle-filters', toggle);
    return () => {
      window.removeEventListener('open-filters', open);
      window.removeEventListener('close-filters', close);
      window.removeEventListener('toggle-filters', toggle);
    };
  }, []);

  // Active filters count for header badge
  const activeCount = (
    (filters.price[0] > minPrice || filters.price[1] < maxPrice ? 1 : 0) +
    (filters.discount[0] > minDiscount || filters.discount[1] < maxDiscount ? 1 : 0) +
    (filters.rating[0] > minRating || filters.rating[1] < maxRating ? 1 : 0) +
    (filters.unit.length > 0 ? 1 : 0) +
    (filters.brand.length > 0 ? 1 : 0) +
    (filters.available ? 1 : 0)
  );

  // Compact mode renders simple buttons
  if (compact) {
    return (
      <>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, 
          p: 0,
          m: 0,
          width: '100%'
        }}>
          {/* Sort Button - Left Side (legacy style) */}
          <Button
            size="medium"
            variant="contained"
            onClick={() => { setIsSortOpen(true); setIsFilterOpen(false); }}
            sx={{ 
              flex: 1,
              textTransform: 'none',
              bgcolor: '#1b5e20',
              boxShadow: '0 6px 16px rgba(27,94,32,0.28)',
              borderRadius: 1,
              fontWeight: 600,
              py: 0.6,
              minHeight: 36,
              fontSize: '0.9rem',
              '&:hover': { bgcolor: '#154a19' }
            }}
          >
            {t("sort", "Sort")}
          </Button>
          
          {/* Filter Button - Right Side (legacy style) */}
          <Button
            size="medium"
            variant="contained"
            onClick={() => { setIsFilterOpen(true); setIsSortOpen(false); }}
            sx={{ 
              flex: 1,
              textTransform: 'none',
              bgcolor: '#2e7d32',
              boxShadow: '0 6px 16px rgba(46,125,50,0.25)',
              borderRadius: 1,
              fontWeight: 600,
              py: 0.6,
              minHeight: 36,
              fontSize: '0.9rem',
              '&:hover': { bgcolor: '#27692a' }
            }}
          >
            {t("filter", "Filter")}
          </Button>
        </Box>

        {/* Sort Panel anchored above buttons (no modal) */}
        {isSortOpen && (
          <Box sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: '100%',
            mx: 'auto',
            width: '95%',
            maxWidth: 380,
            bgcolor: 'rgba(255,255,255,0.98)',
            backdropFilter: 'saturate(180%) blur(4px)',
            borderRadius: 2,
            border: '1px solid #eee',
            px: 1.25,
            pb: 1.25,
            pt: 0,
            maxHeight: '24vh',
            overflow: 'hidden',
            boxShadow: '0 8px 20px rgba(0,0,0,0.14)',
            zIndex: 2
          }}>
            <Box sx={{ 
              position: 'sticky', 
              top: 0, 
              zIndex: 3,
              bgcolor: 'rgba(255,255,255,0.98)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'flex-start', 
              mb: 0, 
              minHeight: 36,
              pt: 0,
              pb: 0,
              borderBottom: '1px solid #eee',
              px: 1.25
            }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t("sort", "Sort")}</Typography>
              <Button 
                size="small"
                onClick={handleSortClose}
                aria-label="Close sort panel"
                sx={{ 
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  textTransform: 'none',
                  fontWeight: 800,
                  color: 'text.primary',
                  bgcolor: 'rgba(0,0,0,0.04)',
                  borderRadius: 2,
                  px: 1,
                  py: 0.25,
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.08)' }
                }}
              >
                <KeyboardArrowDownIcon fontSize="small" />
              </Button>
              <Button 
                size="small"
                onClick={() => setSort(null)}
                sx={{ 
                  position: 'absolute',
                  right: 0,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: 'error.main'
                }}
              >
                {t("clearAll", "Clear")}
              </Button>
            </Box>
            <Box sx={{ overflowY: 'auto', maxHeight: 'calc(24vh - 36px)', pr: 0.25 }}>
            <Stack direction="column" spacing={0.75}>
              {sortOptions.map(opt => (
                <Button
                  key={opt.value}
                  size="small"
                  variant={sort === opt.value ? 'contained' : 'outlined'}
                  onClick={() => {
                    setSort(opt.value);
                    handleSortClose();
                  }}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    py: 0.5,
                    fontSize: '0.85rem',
                    bgcolor: sort === opt.value ? '#388e3c' : 'transparent',
                    color: sort === opt.value ? 'white' : '#333',
                    borderColor: sort === opt.value ? '#388e3c' : '#ddd',
                    '&:hover': {
                      bgcolor: sort === opt.value ? '#2e7d32' : 'rgba(56, 142, 60, 0.04)'
                    }
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </Stack>
            </Box>
          </Box>
        )}

        {/* Filter Panel anchored above buttons (no modal) */}
        {isFilterOpen && (
          <Box sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: '100%',
            mx: 'auto',
            width: '95%',
            maxWidth: 420,
            bgcolor: 'rgba(255,255,255,0.98)',
            backdropFilter: 'saturate(180%) blur(4px)',
            borderRadius: 2,
            border: '1px solid #eee',
            px: 1.25,
            pb: 1.25,
            pt: 0,
            maxHeight: '34vh',
            overflow: 'hidden',
            boxShadow: '0 8px 20px rgba(0,0,0,0.14)',
            zIndex: 2
          }}>
            <Box sx={{ 
              position: 'sticky', 
              top: 0, 
              zIndex: 3,
              bgcolor: 'rgba(255,255,255,0.98)',
              display: 'flex', 
              justifyContent: 'flex-start', 
              alignItems: 'center', 
              mb: 0, 
              minHeight: 36,
              pt: 0,
              pb: 0,
              borderBottom: '1px solid #eee',
              px: 1.25
            }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t("filter", "Filters")}{activeCount > 0 ? ` (${activeCount})` : ''}
              </Typography>
              <Button 
                size="small"
                onClick={handleFilterClose}
                aria-label="Close filter panel"
                sx={{ 
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  textTransform: 'none',
                  fontWeight: 800,
                  color: 'text.primary',
                  bgcolor: 'rgba(0,0,0,0.04)',
                  borderRadius: 2,
                  px: 1,
                  py: 0.25,
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.08)' }
                }}
              >
                <KeyboardArrowDownIcon fontSize="small" />
              </Button>
              <Button 
                size="small"
                onClick={resetFilters}
                sx={{ 
                  position: 'absolute',
                  right: 0,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: 'error.main'
                }}
              >
                {t("clearAll", "Clear")}
              </Button>
            </Box>
            
            <Box sx={{ overflowY: 'auto', maxHeight: 'calc(34vh - 36px)', pr: 0.25 }}>
            <Stack direction="column" spacing={0.75}>
              {/* Price Range Filter */}
              <Box sx={{ p: 1.25, bgcolor: 'rgba(76, 175, 80, 0.05)', borderRadius: 2, border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 600, color: '#333' }}>
                  {t("priceRange", "Price Range")}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 500, color: '#4caf50' }}>₹{filters.price[0]}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 500, color: '#4caf50' }}>₹{filters.price[1]}</Typography>
                </Box>
                <Slider 
                  value={filters.price} 
                  min={minPrice} 
                  max={maxPrice} 
                  onChange={(_, v) => setFilters(f => ({ ...f, price: v }))} 
                  valueLabelDisplay="auto" 
                  size="small"
                  sx={{ 
                    '& .MuiSlider-thumb': { 
                      width: 16, 
                      height: 16,
                      bgcolor: '#4caf50',
                      '&:hover': { boxShadow: '0 0 0 8px rgba(76, 175, 80, 0.16)' }
                    }, 
                    '& .MuiSlider-track': { 
                      height: 4,
                      bgcolor: '#4caf50'
                    },
                    '& .MuiSlider-rail': { 
                      height: 4,
                      bgcolor: 'rgba(76, 175, 80, 0.2)'
                    }
                  }} 
                />
              </Box>

              {/* Discount Filter */}
              <Box sx={{ p: 1.25, bgcolor: 'rgba(255, 87, 34, 0.05)', borderRadius: 2, border: '1px solid rgba(255, 87, 34, 0.2)' }}>
                <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 600, color: '#333' }}>
                  {t("discount", "Discount")}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 500, color: '#ff5722' }}>{filters.discount[0]}%</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 500, color: '#ff5722' }}>{filters.discount[1]}%</Typography>
                </Box>
                <Slider 
                  value={filters.discount} 
                  min={minDiscount} 
                  max={maxDiscount} 
                  onChange={(_, v) => setFilters(f => ({ ...f, discount: v }))} 
                  valueLabelDisplay="auto" 
                  size="small"
                  sx={{ 
                    '& .MuiSlider-thumb': { 
                      width: 16, 
                      height: 16,
                      bgcolor: '#ff5722',
                      '&:hover': { boxShadow: '0 0 0 8px rgba(255, 87, 34, 0.16)' }
                    }, 
                    '& .MuiSlider-track': { 
                      height: 4,
                      bgcolor: '#ff5722'
                    },
                    '& .MuiSlider-rail': { 
                      height: 4,
                      bgcolor: 'rgba(255, 87, 34, 0.2)'
                    }
                  }} 
                />
              </Box>

              {/* Rating Filter */}
              <Box sx={{ p: 1.25, bgcolor: 'rgba(255, 193, 7, 0.05)', borderRadius: 2, border: '1px solid rgba(255, 193, 7, 0.2)' }}>
                <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 600, color: '#333' }}>
                  {t("topRated", "Rating Range")}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 500, color: '#ffc107' }}>{filters.rating[0]}★</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 500, color: '#ffc107' }}>{filters.rating[1]}★</Typography>
                </Box>
                <Slider 
                  value={filters.rating} 
                  min={minRating} 
                  max={maxRating} 
                  step={0.1} 
                  onChange={(_, v) => setFilters(f => ({ ...f, rating: v }))} 
                  valueLabelDisplay="auto" 
                  size="small"
                  sx={{ 
                    '& .MuiSlider-thumb': { 
                      width: 16, 
                      height: 16,
                      bgcolor: '#ffc107',
                      '&:hover': { boxShadow: '0 0 0 8px rgba(255, 193, 7, 0.16)' }
                    }, 
                    '& .MuiSlider-track': { 
                      height: 4,
                      bgcolor: '#ffc107'
                    },
                    '& .MuiSlider-rail': { 
                      height: 4,
                      bgcolor: 'rgba(255, 193, 7, 0.2)'
                    }
                  }} 
                />
              </Box>

              {/* Units Filter */}
              {units?.length > 0 && (
                <Box sx={{ p: 1.25, bgcolor: 'rgba(255, 152, 0, 0.05)', borderRadius: 2, border: '1px solid rgba(255, 152, 0, 0.2)' }}>
                  <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 600, color: '#333' }}>
                    {t("units", "Product Units")}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {units.map(u => (
                      <Chip 
                        key={u} 
                        label={u} 
                        size="small"
                        onClick={() => toggleUnit(u)} 
                        color={filters.unit.includes(u) ? 'warning' : 'default'} 
                        variant={filters.unit.includes(u) ? 'filled' : 'outlined'} 
                        sx={{ 
                          mb: 0.75,
                          fontWeight: filters.unit.includes(u) ? 600 : 400,
                          '&:hover': {
                            bgcolor: filters.unit.includes(u) ? undefined : 'rgba(255, 152, 0, 0.08)',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          },
                          transition: 'all 0.2s ease'
                        }} 
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Brands Filter */}
              {brands?.length > 0 && (
                <Box sx={{ p: 1.25, bgcolor: 'rgba(156, 39, 176, 0.05)', borderRadius: 2, border: '1px solid rgba(156, 39, 176, 0.2)' }}>
                  <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 600, color: '#333' }}>
                    {t("brands", "Brands")}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {brands.map(b => (
                      <Chip 
                        key={b} 
                        label={b} 
                        size="small"
                        onClick={() => toggleBrand(b)} 
                        color={filters.brand.includes(b) ? 'secondary' : 'default'} 
                        variant={filters.brand.includes(b) ? 'filled' : 'outlined'} 
                        sx={{ 
                          mb: 0.75,
                          fontWeight: filters.brand.includes(b) ? 600 : 400,
                          '&:hover': {
                            bgcolor: filters.brand.includes(b) ? undefined : 'rgba(156, 39, 176, 0.08)',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          },
                          transition: 'all 0.2s ease'
                        }} 
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Availability Filter */}
              <Box sx={{ p: 1.25, bgcolor: 'rgba(76, 175, 80, 0.05)', borderRadius: 2, border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                <FormControlLabel 
                  control={
                    <Checkbox 
                      size="small"
                      checked={filters.available} 
                      onChange={(_, checked) => setFilters(f => ({ ...f, available: checked }))}
                      sx={{
                        color: '#4caf50',
                        '&.Mui-checked': { color: '#4caf50' }
                      }}
                    />
                  } 
                  label={
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                      {t("availableOnly", "Show In Stock Only")}
                    </Typography>
                  } 
                />
              </Box>
            </Stack>
            </Box>

            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              <Button size="small" variant="contained" fullWidth onClick={() => { handleFilterClose(); if (onApply) onApply(); }} sx={{ bgcolor: '#388e3c', py: 0.75 }}>{t("apply", "Apply")}</Button>
            </Box>
          </Box>
        )}
      </>
    );
  }

  return null;
}
