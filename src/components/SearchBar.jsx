import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './SearchBar.css';
import { 
  TextField, 
  InputAdornment, 
  IconButton,
  Box,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import SearchIcon from '@mui/icons-material/Search';
import useSearch from '../hooks/useSearch';
import SearchSuggestions from './SearchSuggestions';
import { useLanguage } from '../context/LanguageContext';

const SearchBar = ({ 
  value = "", 
  onChange, 
  placeholder,
  onSuggestionSelect,
  sx = {}
}) => {
  const { t } = useLanguage();
  const effectivePlaceholder = placeholder || t('searchPlaceholder') || "Search products...";
  const [listening, setListening] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef(null);
  const containerRef = useRef(null);
  const { loading, suggestions } = useSearch(value);
  const navigate = useNavigate();

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  // Voice search handler
  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice search is not supported in this browser.');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListening(true);
    recognition.start();
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setListening(false);
      onChange(transcript);
    };
    recognition.onerror = (event) => {
      setListening(false);
      alert('Voice search failed: ' + event.error);
    };
    recognition.onend = () => {
      setListening(false);
    };
  };

  // Focus search bar (can be called externally)
  const focusSearchBar = () => {
    const tryFocus = () => {
      const el = searchInputRef.current;
      if (!el) return false;
      try {
        // Some MUI wrappers pass the input element directly; otherwise, find it
        const input = el.tagName === 'INPUT' ? el : el.querySelector && el.querySelector('input');
        // Extra safety: check input is not null and is not detached
        if (!input || typeof input.focus !== 'function' || !document.body.contains(input)) return false;
        input.focus({ preventScroll: false });
        // iOS sometimes needs selection change to open keyboard
        if (typeof input.setSelectionRange === 'function') {
          const len = input.value ? input.value.length : 0;
          input.setSelectionRange(len, len);
        }
        return document.activeElement === input;
      } catch (e) {
        return false;
      }
    };
    // Attempt now and a few times after for iOS
    if (tryFocus()) return;
    let attempts = 4;
    const tick = () => {
      if (tryFocus()) return;
      if (--attempts > 0) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // Listen for search focus event from BottomNavbar
  useEffect(() => {
    const handleSearchFocus = () => {
      focusSearchBar();
    };
    const handleClearSearch = () => {
      onChange('');
    };
    window.addEventListener('focus-search', handleSearchFocus);
    window.addEventListener('clear-search', handleClearSearch);
    return () => {
      window.removeEventListener('focus-search', handleSearchFocus);
      window.removeEventListener('clear-search', handleClearSearch);
    };
  }, [onChange]);

  const handleSuggestionSelect = (item, type) => {
    if (type === 'request-product') {
      // Close suggestions and clear search
      setShowSuggestions(false);
      onChange('');
      // Navigate to request product page with the search term
      navigate('/request-product');
      return;
    }
    onSuggestionSelect?.(item, type);
    setShowSuggestions(false);
    onChange('');
    // Focus the search bar and show keyboard on mobile
    focusSearchBar();
  };

  return (
    <Box ref={containerRef} className="search-container" sx={{ ...sx }}>
      <TextField
        fullWidth
        variant="outlined"
        size="small"
        placeholder={effectivePlaceholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        inputRef={searchInputRef}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={handleVoiceSearch}
                edge="end"
                sx={{
                  color: listening ? 'error.main' : 'primary.main',
                }}
              >
                <MicIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '25px',
            height: '40px',
            backgroundColor: 'white',
          }
        }}
      />

      {value.length >= 1 && showSuggestions && (
        <SearchSuggestions
          suggestions={suggestions}
          onSelect={handleSuggestionSelect}
          onClose={() => setShowSuggestions(false)}
        />
      )}
    </Box>
  );
};

export default SearchBar;
