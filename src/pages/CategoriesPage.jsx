import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  List,
  ListItemButton,
  Avatar,
  Skeleton,
  TextField,
  InputAdornment,
  LinearProgress,
} from "@mui/material";
import CategoryIcon from "@mui/icons-material/Category";
import SearchIcon from '@mui/icons-material/Search';
import { useParams, useNavigate } from "react-router-dom";
import "./HomePage.css";

import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, doc } from 'firebase/firestore';



import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import SortFilterBar from '../components/SortFilterBar';
import BottomNavbar from '../components/BottomNavbar';
import { useLanguage } from '../context/LanguageContext';
// (Removed unused inline SortFilterBar/SearchBar)

// --- MAIN CATEGORIES PAGE COMPONENT ---

const CategoriesPage = () => {
  const { t, getCategoryName } = useLanguage();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [productsByCat, setProductsByCat] = useState(new Map());
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  // Pull-to-refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullState = useRef({ startY: 0, pulling: false });

  const productContainerRef = useRef(null);
  const categoryTitleRefs = useRef(new Map());
  const { categoryName } = useParams();
  // Guard to suppress observer/scroll-driven updates during programmatic navigation scrolls
  const programmaticScrollRef = useRef(false);
  const programmaticTimeoutRef = useRef(null);
  
  // Sticky header states
  const [isSearchFixed, setIsSearchFixed] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef(null);

  // Sort/filter state
  const [sort, setSort] = useState("newest");
  const [filters, setFilters] = useState({
    price: [0, 10000], discount: [0, 100], rating: [0, 5],
    unit: [], brand: [], available: false,
  });

  // 1. Fetch all categories from Firestore
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        console.log('Starting to fetch categories...');
        setLoadingCategories(true);

        // First get the categories collection
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        console.log('Categories snapshot size:', categoriesSnapshot.size);

        if (categoriesSnapshot.empty) {
          console.log('No categories found, trying products collection...');
          // Fallback: Get all subcollections from products
          const productsRef = collection(db, 'products');
          const productsSnapshot = await getDocs(productsRef);
          
          const categoriesData = productsSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data()?.name || doc.id,
            imageUrl: doc.data()?.imageUrl || null
          }));

          console.log('Processed categories from products:', categoriesData);
          setCategories(categoriesData);
          // Set a default active category only if none is set; URL-param effect will override as needed
          if (categoriesData.length > 0) {
            setActiveCategory(prev => prev || categoriesData[0]);
          }
        } else {
          // Use the categories collection
          const categoriesData = categoriesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          console.log('Processed categories:', categoriesData);
          setCategories(categoriesData);
          // Set a default active category only if none is set; URL-param effect will override as needed
          if (categoriesData.length > 0) {
            setActiveCategory(prev => prev || categoriesData[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  // Helper to refresh both categories and products
  const refreshAll = React.useCallback(async () => {
    try {
      setIsRefreshing(true);
      setLoadingCategories(true);
      setLoadingProducts(true);
      // Re-run the same logic as initial load
      const categoriesSnapshot = await getDocs(collection(db, 'categories'));
      let categoriesData;
      if (categoriesSnapshot.empty) {
        const productsRef = collection(db, 'products');
        const productsSnapshot = await getDocs(productsRef);
        categoriesData = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data()?.name || doc.id,
          imageUrl: doc.data()?.imageUrl || null
        }));
      } else {
        categoriesData = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      setCategories(categoriesData);

      // Fetch products for each category (only if any)
      const newProductsMap = new Map();
      for (const category of categoriesData) {
        try {
          // Try multiple strategies similar to the main fetch to be robust
          let productsSnapshot = null;
          const tryPaths = [
            () => collection(db, 'products', category.name, 'items'),
            () => collection(db, 'products', category.id, 'items'),
            () => collection(db, 'products')
          ];

          for (const getRef of tryPaths) {
            try {
              const ref = getRef();
              const snap = await getDocs(ref);
              if (!snap.empty) { productsSnapshot = snap; break; }
            } catch (e) {}
          }

          if (!productsSnapshot) continue;

          const products = productsSnapshot.docs.map(doc => {
            const data = doc.data();
            const firstOption = Array.isArray(data.options) && data.options.length ? data.options[0] : null;
            // Prefer admin-provided offerPrice (final price) when present for Offer Zone
            const sellingPrice = data.offerPrice ?? firstOption?.sellingPrice ?? firstOption?.price ?? data.sellingPrice ?? data.price ?? null;
            const mrp = firstOption?.mrp ?? data.mrp ?? null;
            const imageUrl = (data.imageUrls && data.imageUrls[0]) || data.imageUrl || null;
            return {
              id: doc.id,
              ...data,
              category: data.category || category.name,
              price: sellingPrice,
              mrp,
              imageUrl
            };
          }).filter(p => p.price != null);
          if (products.length > 0) newProductsMap.set(category.id, products);
        } catch (_) {}
      }
      const debugKeys = Array.from(newProductsMap.entries()).map(([k, v]) => ({ key: k, count: Array.isArray(v) ? v.length : (v?.size || 0) }));
      console.debug('[CategoriesPage] refresh products map keys/counts', debugKeys);
      setProductsByCat(newProductsMap);
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setLoadingCategories(false);
      setLoadingProducts(false);
      setIsRefreshing(false);
    }
  }, [db]);

  // 2. Fetch products from Firestore
  useEffect(() => {
    const fetchAllProducts = async () => {
      if (categories.length === 0) {
        console.log('No categories to fetch products for');
        return;
      }

      try {
        console.log('Starting to fetch products for categories:', categories);
        setLoadingProducts(true);
        const newProductsMap = new Map();

        // Fetch products for each category
        for (const category of categories) {
          try {
              console.log(`Fetching products for category ${category.name}...`);

              // Try multiple strategies to locate products for this category to be robust
              let productsSnapshot = null;
              const tryPaths = [
                () => collection(db, 'products', category.name, 'items'),
                () => collection(db, 'products', category.id, 'items'),
                () => collection(db, 'products')
              ];

              for (const getRef of tryPaths) {
                try {
                  const ref = getRef();
                  const snap = await getDocs(ref);
                  if (!snap.empty) {
                    productsSnapshot = snap;
                    break;
                  }
                } catch (e) {
                  // ignore path errors and try next
                }
              }

              if (!productsSnapshot) {
                console.log(`No products snapshot for category ${category.name}`);
                continue;
              }

              console.log(`Found ${productsSnapshot.size} candidate products for category ${category.name}`);

              const products = productsSnapshot.docs.map(doc => {
                const data = doc.data();
                // Try to locate the first option and price fields using common variants
                const firstOption = Array.isArray(data.options) && data.options.length ? data.options[0] : null;
                // Prefer admin-provided offerPrice (final price) when present for Offer Zone
                const sellingPrice = data.offerPrice ?? firstOption?.sellingPrice ?? firstOption?.price ?? data.sellingPrice ?? data.price ?? null;
                const mrp = firstOption?.mrp ?? data.mrp ?? null;
                const imageUrl = (data.imageUrls && data.imageUrls[0]) || data.imageUrl || null;
                // Normalize category field
                const productCategory = data.category || data.cat || category.name;

                return {
                  id: doc.id,
                  ...data,
                  category: productCategory,
                  price: sellingPrice,
                  mrp: mrp,
                  imageUrl
                };
              }).filter(product => product.price != null); // Only include products with valid pricing

              if (products.length > 0) {
                console.log(`Adding ${products.length} products to category ${category.name}`);
                newProductsMap.set(category.id, products);
              }
          } catch (error) {
            console.error(`Error fetching products for category ${category.name}:`, error);
          }
        }

        const debugKeys = Array.from(newProductsMap.entries()).map(([k, v]) => ({ key: k, count: Array.isArray(v) ? v.length : (v?.size || 0) }));
        console.debug('[CategoriesPage] final products map keys/counts', debugKeys);
        setProductsByCat(newProductsMap);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchAllProducts();
  }, [categories]);

  // Pull-to-refresh gesture on products panel
  useEffect(() => {
    const container = productContainerRef.current;
    if (!container) return;
    const onTouchStart = (e) => {
      if (container.scrollTop === 0 && !isRefreshing) {
        pullState.current.startY = e.touches[0].clientY;
        pullState.current.pulling = true;
      }
    };
    const onTouchMove = (e) => {
      if (!pullState.current.pulling) return;
      const delta = e.touches[0].clientY - pullState.current.startY;
      if (delta < 0) pullState.current.pulling = false;
    };
    const onTouchEnd = async () => {
      if (!pullState.current.pulling) return;
      pullState.current.pulling = false;
      await refreshAll();
    };
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [productContainerRef.current, isRefreshing, refreshAll]);

  // Helper: scroll to category header with offset for sticky search bar
  const scrollToCategoryId = (catIdOrName) => {
    // Resolve to a valid category id (coerce to string to avoid type mismatches)
    let resolvedId = catIdOrName;
    const byId = categories.find(c => String(c.id) === String(catIdOrName));
    const byName = categories.find(c => String(c.name) === String(catIdOrName));
    const found = byId || byName;
    if (found) resolvedId = found.id;

    console.debug('[CategoriesPage] scrollToCategoryId called', { catIdOrName, resolvedId, found });

    const tryScrollOnce = () => {
      const container = productContainerRef.current;
      const titleElement = categoryTitleRefs.current.get(resolvedId);
      // If not found directly by id, try to find a header element whose text matches the category name
      let el = titleElement;
      if (!container || (!el && found && found.name)) return;
      if (!el && found && found.name) {
        // iterate map to find first element whose text includes the category name
        for (const [k, v] of categoryTitleRefs.current.entries()) {
          try {
            if (!v) continue;
            const txt = (v.textContent || '').trim();
            if (!txt) continue;
            if (txt.toLowerCase().includes(String(found.name).toLowerCase())) {
              el = v;
              break;
            }
          } catch (e) {}
        }
      }
      if (!container || !el) return;

      // Compute top relative to container's scrollTop reliably
      const containerRect = container.getBoundingClientRect();
      const titleRect = el.getBoundingClientRect();
      const absoluteTop = titleRect.top - containerRect.top + container.scrollTop;

      // Offset only by sticky search bar height
      const searchBarEl = document.querySelector('.search-bar-wrapper');
      const isSticky = searchBarEl?.classList?.contains('sticky');
      const stickyHeight = isSticky ? (searchBarEl?.offsetHeight || 0) : 0;
      const offset = stickyHeight + 8;

      const target = Math.max(0, absoluteTop - offset);
      // Use smooth scrolling once
      container.scrollTo({ top: target, behavior: 'smooth' });
    };

    // Try now and queue a couple of follow-up attempts in case layout isn't ready yet
    tryScrollOnce();
    setTimeout(tryScrollOnce, 250);
    setTimeout(tryScrollOnce, 600);
  };

  // 2b. When navigated with a categoryName param, scroll to that category once data is ready
  useEffect(() => {
    if (!categoryName) return;
    if (categories.length === 0) return;
    if (productsByCat.size === 0) return;

    const decoded = decodeURIComponent(categoryName);
    let target =
      categories.find(
        (c) => c.id === decoded || c.name === decoded
      ) || null;
    // Support deep-link to offer zone
    if (!target && decoded === offerCategory.id) target = offerCategory;

    console.debug('[CategoriesPage] deep-link param', { categoryName, decoded, targetId: target?.id });

    if (!target) return;

    // Only attempt to scroll if we have products rendered for that category
    if (!renderProductsByCat.has(target.id) && !renderProductsByCat.has(target.name)) {
      console.debug('[CategoriesPage] deep-link target has no products in productsByCat keys', { targetId: target.id, targetName: target.name, keys: Array.from(productsByCat.keys()) });
      return;
    }

    // Programmatic scroll: set guard to avoid IO flicker
    programmaticScrollRef.current = true;
    if (programmaticTimeoutRef.current) clearTimeout(programmaticTimeoutRef.current);
    // Set as active and scroll using helper
    setActiveCategory(target);
    scrollToCategoryId(target.id);
    // Release guard after animation
    programmaticTimeoutRef.current = setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 700);
  }, [categoryName, categories, productsByCat]);

  // 3. Setup IntersectionObserver to sync active category on scroll
  useEffect(() => {
    const rootEl = productContainerRef.current;
    if (!rootEl) return;

    // Debounced active category setter to avoid rapid state churn
    let lastActiveId = null;

    const observerCallback = (entries) => {
      if (programmaticScrollRef.current) return;

      // Find all intersecting entries and pick the one closest to the top
      const intersecting = entries.filter(en => en.isIntersecting);
      if (intersecting.length === 0) return;

      intersecting.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const topEntry = intersecting[0];
      const catId = topEntry.target.dataset.categoryId;
      console.debug('[CategoriesPage] IntersectionObserver topEntry', { catId });
      if (!catId) return;
      if (lastActiveId === catId) return;
      lastActiveId = catId;
      // Only update if changed
      let found = categories.find(c => c.id === catId);
      if (!found && catId === offerCategory.id) found = offerCategory;
      if (found) {
        requestAnimationFrame(() => setActiveCategory(found));
      }
    };

    const observer = new IntersectionObserver(observerCallback, {
      root: rootEl,
      // Watch when a header reaches near top of viewport inside the container
      rootMargin: '0px 0px -50% 0px',
      threshold: 0.25,
    });

    // Observe current title elements
    const refsMap = categoryTitleRefs.current;
    if (refsMap && typeof refsMap.forEach === 'function') {
      refsMap.forEach(el => { if (el) observer.observe(el); });
    }

    return () => {
      if (refsMap && typeof refsMap.forEach === 'function') {
        refsMap.forEach(el => { try { if (el) observer.unobserve(el); } catch (e) {} });
      }
      try { observer.disconnect(); } catch (e) {}
    };
    // Only re-run when categories or products change
  }, [categories, productsByCat]);

  const handleCategorySelect = (category) => {
    // Update URL and perform an immediate programmatic scroll so clicks feel responsive.
    try {
      navigate(`/category/${encodeURIComponent(category.id || category.name)}`);
    } catch (_) {}

    // Debug info about click and current products map
    console.debug('[CategoriesPage] handleCategorySelect clicked', { id: category.id, name: category.name, productsByCatKeys: Array.from(productsByCat.keys()) });

    // Immediate programmatic scroll (guard observer while we scroll)
    programmaticScrollRef.current = true;
    if (programmaticTimeoutRef.current) clearTimeout(programmaticTimeoutRef.current);
    setActiveCategory(category);
    // Attempt to scroll immediately — scrollToCategoryId will internally retry if needed
    scrollToCategoryId(category.id || category.name);
    // Release the guard after animation finishes
    programmaticTimeoutRef.current = setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 800);
  };
  
  const getProcessedProducts = (products) => {
    let filtered = [...products];

    // Apply search within this category's products
    if (search.trim()) {
      const searchText = search.trim().toLowerCase();
      filtered = filtered.filter(p => {
        const inName = p.name?.toLowerCase().includes(searchText) || p.nameTamil?.toLowerCase().includes(searchText);
        const inBrand = p.brand?.toLowerCase().includes(searchText);
        const inCategory = p.category?.toLowerCase().includes(searchText);
        let inKeywords = false;
        if (p.keywords) {
          const arr = Array.isArray(p.keywords) ? p.keywords : (typeof p.keywords === 'string' ? p.keywords.split(',') : []);
          inKeywords = arr.some(k => String(k).trim().toLowerCase().includes(searchText));
        }
        return inName || inBrand || inCategory || inKeywords;
      });
    }

    // Apply price filter
    if (filters.price) {
      filtered = filtered.filter(p => {
        const price = p.sellingPrice || p.price || 0;
        return price >= filters.price[0] && price <= filters.price[1];
      });
    }

    // Apply discount filter
    if (filters.discount) {
      filtered = filtered.filter(p => {
        const mrp = p.mrp || 0;
        const selling = p.sellingPrice || p.price || 0;
        const discount = mrp > 0 ? Math.round(((mrp - selling) / mrp) * 100) : 0;
        return discount >= filters.discount[0] && discount <= filters.discount[1];
      });
    }

    // Apply rating filter
    if (filters.rating) {
      filtered = filtered.filter(p => {
        const rating = p.rating || 0;
        return rating >= filters.rating[0] && rating <= filters.rating[1];
      });
    }

    // Apply unit filter
    if (filters.unit?.length) {
      filtered = filtered.filter(p => filters.unit.includes(p.unit));
    }

    // Apply brand filter
    if (filters.brand?.length) {
      filtered = filtered.filter(p => filters.brand.includes(p.brand));
    }

    // Apply availability filter
    if (filters.available) {
      filtered = filtered.filter(p => p.available !== false);
    }

    // Apply sorting (same set as HomePage)
    switch (sort) {
      case 'priceLowHigh':
        filtered.sort((a, b) => (a.sellingPrice || a.price || 0) - (b.sellingPrice || b.price || 0));
        break;
      case 'priceHighLow':
        filtered.sort((a, b) => (b.sellingPrice || b.price || 0) - (a.sellingPrice || a.price || 0));
        break;
      case 'newest':
        filtered.sort((a, b) => {
          const dA = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const dB = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return dB - dA;
        });
        break;
      case 'oldest':
        filtered.sort((a, b) => {
          const dA = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const dB = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return dA - dB;
        });
        break;
      case 'nameAZ':
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'nameZA':
        filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
      case 'discount':
        filtered.sort((a, b) => {
          const dA = a.mrp && a.sellingPrice ? ((a.mrp - a.sellingPrice) / a.mrp) : 0;
          const dB = b.mrp && b.sellingPrice ? ((b.mrp - b.sellingPrice) / b.mrp) : 0;
          return dB - dA;
        });
        break;
      case 'rating':
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'popularity': {
        const pop = (p) => p.popularity ?? p.views ?? p.ordersCount ?? p.sales ?? 0;
        filtered.sort((a, b) => pop(b) - pop(a));
        break;
      }
      case 'featured':
        filtered.sort((a, b) => {
          const fa = a.featured ? 1 : 0;
          const fb = b.featured ? 1 : 0;
          if (fb !== fa) return fb - fa;
          const dA = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const dB = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return dB - dA;
        });
        break;
      default:
        break;
    }

    return filtered;
  };
  
  // Build an "Offer Zone" synthetic category from products marked with either legacy `showOfferBand` or new `offerZone`/`offerPrice`
  const allProductsList = Array.from(productsByCat.values()).flat();
  const offerProducts = allProductsList.filter(p => p && (p.showOfferBand === true || p.offerZone === true || (typeof p.offerPrice === 'number')));

  // Synthetic offer category
  const offerCategory = { id: 'offer-zone', name: 'Offer Zone', imageUrl: null };

  // Match categories that have products by either id or name (some data layouts use name keys)
  const baseCategoriesWithProducts = categories.filter(cat => productsByCat.has(cat.id) || productsByCat.has(cat.name));
  // Prepend Offer Zone when there are any offer products
  const categoriesWithProducts = offerProducts.length > 0 ? [offerCategory, ...baseCategoriesWithProducts] : baseCategoriesWithProducts;

  // Provide a render-time products map that includes the synthetic offer-zone key
  const renderProductsByCat = new Map(productsByCat);
  if (offerProducts.length > 0) renderProductsByCat.set(offerCategory.id, offerProducts);

  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Helper to get the first category that has products
  const getFirstCategoryWithProducts = () => {
    if (offerProducts.length > 0) return offerCategory;
    return categories.find(cat => productsByCat.has(cat.id)) || null;
  };

  const showDebugPanel = typeof window !== 'undefined' && window.location.search.includes('dbg=1');

  // Debug: log categories/products map when they change
  useEffect(() => {
    console.debug('[CategoriesPage] categories changed', { count: categories.length, names: categories.map(c => c.name) });
    console.debug('[CategoriesPage] productsByCat keys', Array.from(productsByCat.keys()));
  }, [categories, productsByCat]);

  // Scroll behavior effect - use the products panel's scroll instead of window
  useEffect(() => {
    const container = productContainerRef.current;
    if (!container) return;

    let ticking = false;

    const handleScroll = () => {
      const currentScroll = container.scrollTop;
      const headerElement = headerRef.current;
      const hdrHeight = headerElement ? headerElement.offsetHeight : 0;

      const shouldFix = currentScroll > 12; // small threshold to avoid jitter on tiny scrolls

      if (shouldFix && !isSearchFixed) {
        setIsSearchFixed(true);
        setHeaderHeight(hdrHeight);
      } else if (!shouldFix && isSearchFixed) {
        setIsSearchFixed(false);
        setHeaderHeight(0);
      }

      // When scrolled fully to top, ensure the first category is active
      if (currentScroll <= 1 && !programmaticScrollRef.current) {
        const firstCat = getFirstCategoryWithProducts();
        if (firstCat && activeCategory?.id !== firstCat.id) {
          setActiveCategory(firstCat);
        }
      }

      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(handleScroll);
        ticking = true;
      }
    };

    // Run once to set initial state if already scrolled
    handleScroll();

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [isSearchFixed, productContainerRef.current, categories, productsByCat, activeCategory]);
  return (
    <>
      <style>{`
        .categories-root {
          height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #fff;
        }
        .main-content-section {
          flex: 1;
          display: flex;
          overflow: hidden;
          min-height: 0;
        }
        /* Header styles for sticky behavior */
        .header-container {
          position: relative;
          z-index: 1200;
          width: 100%;
        }
        .scrollable-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: white;
          transition: transform 0.3s ease;
          z-index: 1200;
        }
        .scrollable-header.hidden {
          transform: translateY(-100%);
        }
        .search-bar-wrapper {
          position: relative;
          width: 100%;
          background: white;
          z-index: 1300;
          transition: all 0.3s ease;
        }
        .search-bar-wrapper.sticky {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header-spacer {
          height: var(--header-height);
          display: none;
        }
        .header-spacer.visible {
          display: block;
        }
        .fixed-sortfilter-section {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 56px;
          z-index: 1201;
          background: #fff;
          border-top: 1px solid #e0e0e0;
          box-shadow: 0 -2px 5px rgba(0,0,0,0.05);
          padding: 8px 12px;
        }
        .bottom-navbar-section {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1202;
        }
        .categories-left-panel {
          width: 90px;
          flex-shrink: 0;
          border-right: 1px solid #eee;
          background-color: #f7f7f7;
          overflow-y: auto;
          scrollbar-width: none;
        }
        .categories-left-panel::-webkit-scrollbar {
          display: none;
        }
        .products-right-panel {
          flex: 1;
          overflow-y: auto;
          min-width: 0;
          padding-top: var(--sticky-search-height, 0px); /* keep content below sticky search bar */
        }
        .category-list-item {
          display: flex;
          flex-direction: column !important;
          border-radius: 8px !important;
          padding: 12px 4px !important;
          margin-bottom: 4px !important;
          transition: background-color 0.2s ease-in-out;
        }
        .category-list-item.Mui-selected {
          background-color: #388e3c !important;
          color: white !important;
        }
        .category-list-item.Mui-selected:hover {
          background-color: #2e7d32 !important;
        }
        .category-avatar {
          width: 48px !important;
          height: 48px !important;
          margin-bottom: 8px !important;
          background-color: #fff !important;
        }
        .category-name {
          font-weight: 600 !important;
          text-align: center;
          line-height: 1.2 !important;
          color: inherit !important;
        }
        .category-title-header {
          padding: 16px 16px 8px 16px;
          font-weight: bold;
          background-color: #fff;
          position: relative; /* no sticky to prevent floating */
          top: auto;
          margin: 8px 0 10px 0; /* slight spacing above and below */
          border-bottom: 1px solid #eee;
        }
        .products-grid {
          display: grid;
          gap: 12px;
          padding: 10px 16px 16px 16px; /* balanced padding below header */
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 600px) {
          .products-grid {
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          }
        }
      `}</style>
      <div className="categories-root">
        {/* Header section with scroll behavior */}
        <Box className="header-container">
          {/* Spacer for fixed content */}
          <Box 
            className={`header-spacer ${isSearchFixed ? 'visible' : ''}`} 
            style={{'--header-height': `${headerHeight}px`}}
          />
          
          {/* App bar content - scrolls away */}
          <Box 
            className={`scrollable-header ${isSearchFixed ? 'hidden' : ''}`}
            ref={headerRef}
          >
            {/* This is where App bar content would be */}
          </Box>

          {/* Search Bar - becomes fixed */}
          <Box 
            className={`search-bar-wrapper ${isSearchFixed ? 'sticky' : ''}`}
            sx={{
              py: 2,
              px: 1.5,
              borderBottom: '1px solid #e0e0e0',
              minHeight: '64px',
             
            }}
          >
            {isRefreshing && (
              <Box sx={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
                <LinearProgress />
              </Box>
            )}
            <SearchBar 
              value={search} 
              onChange={setSearch} 
              placeholder={t('searchCategoriesPlaceholder', 'Search in all categories...')}
              onSuggestionSelect={(item, type) => {
                if (type === 'product') {
                  navigate(`/product/${item.category}/${item.id}`);
                } else if (type === 'category') {
                  // Update URL then scroll
                  const key = item.id || item.name;
                  navigate(`/category/${encodeURIComponent(key)}`);
                }
              }}
            />
          </Box>
        </Box>
        {/* MAIN CONTENT SECTION */}
        <div className="main-content-section" style={{ 
          marginTop: isSearchFixed ? `${headerHeight}px` : 0, 
          marginBottom: 54,
          transition: 'margin-top 0.2s ease'
        }}>
          <div className="categories-left-panel">
            <List sx={{ py: 0.5, px: 0.5 }}>
              {loadingCategories ? (
                Array.from(new Array(10)).map((_, i) => <Skeleton key={i} variant="text" sx={{ my: 2, mx: 1 }} />)
              ) : (
                categoriesWithProducts.map((cat) => (
                  <ListItemButton
                    key={cat.id}
                    selected={activeCategory?.id === cat.id}
                    onClick={() => handleCategorySelect(cat)}
                    className="category-list-item"
                  >
                    <Avatar src={cat.imageUrl} alt={cat.name} className="category-avatar">
                      <CategoryIcon fontSize="small" />
                    </Avatar>
                    <Typography variant="caption" className="category-name">
                      {getCategoryName(cat.name || cat.id)}
                    </Typography>
                  </ListItemButton>
                ))
              )}
            </List>
          </div>
          <div
            ref={productContainerRef}
            className="products-right-panel"
            style={{
              '--sticky-search-height': isSearchFixed ? '64px' : '0px'
            }}
          >
            {loadingCategories || loadingProducts ? (
              <div className="products-grid">
                {Array.from(new Array(8)).map((_, i) => <Skeleton key={i} variant="rectangular" height={220} />)}
              </div>
              ) : categoriesWithProducts.length === 0 ? (
              <Typography sx={{ p: 2, textAlign: 'center' }}>{t('noCategoriesFound', 'No categories found')}</Typography>
            ) : (
              categoriesWithProducts.map((category) => {
                const products = renderProductsByCat.get(category.id) || renderProductsByCat.get(category.name) || renderProductsByCat.get(String(category.id)) || [];
                const processedProducts = getProcessedProducts(products);
                console.debug('[CategoriesPage] render category', { id: category.id, name: category.name, rawCount: (products && products.length) || 0, processedCount: processedProducts.length });
                if (processedProducts.length === 0) return null;
                return (
                  <section key={category.id}>
                    <Typography
                      variant="h6" component="h2" className="category-title-header"
                      ref={(el) => { if (el) categoryTitleRefs.current.set(category.id, el); else categoryTitleRefs.current.delete(category.id); }}
                      data-category-id={category.id}
                    >
                      {getCategoryName(category.name || category.id)}
                    </Typography>
                    <div className="products-grid">
                      {processedProducts.map(product => (
                         <ProductCard product={product} key={product.id} className="product-card-instance" />
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </div>
        {showDebugPanel && (
          <div style={{ position: 'fixed', right: 8, bottom: 120, zIndex: 2000, background: 'rgba(255,255,255,0.95)', border: '1px solid #ddd', padding: 8, fontSize: 12, maxWidth: 320, maxHeight: 240, overflow: 'auto' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Categories Debug</div>
            <div><strong>Active:</strong> {activeCategory ? `${activeCategory.name} (${activeCategory.id})` : 'none'}</div>
            <div style={{ marginTop: 6 }}><strong>productsByCat keys:</strong></div>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(Array.from(renderProductsByCat.keys()), null, 2)}</pre>
          </div>
        )}
        {/* Fixed SortFilterBar above BottomNavbar */}
        <Box sx={{ 
          position: 'fixed', 
          bottom: 56, 
          left: 0, 
          right: 0, 
          zIndex: 1201, 
          background: 'white',
          borderTop: '1px solid #e0e0e0',
          boxShadow: '0 -2px 5px rgba(0,0,0,0.05)',
          p: 0.5
        }}>
              {(() => {
            const active = activeCategory ? (renderProductsByCat.get(activeCategory.id) || []) : [];
            const prices = active.map(p => p.sellingPrice || p.price || 0).filter(n => typeof n === 'number');
            const minPrice = prices.length ? Math.min(...prices) : 0;
            const maxPrice = prices.length ? Math.max(...prices) : 10000;
            const unitsSet = new Set();
            active.forEach(p => {
              if (Array.isArray(p.options)) p.options.forEach(o => o?.unit && unitsSet.add(o.unit));
              if (p.unit) unitsSet.add(p.unit);
            });
            const derivedUnits = Array.from(unitsSet);
            const derivedBrands = Array.from(new Set(active.map(p => p.brand).filter(Boolean)));
            return (
              <SortFilterBar
                compact
                sort={sort}
                setSort={setSort}
                filters={filters}
                setFilters={setFilters}
                units={derivedUnits}
                brands={derivedBrands}
                minPrice={minPrice}
                maxPrice={maxPrice}
                minDiscount={0}
                maxDiscount={100}
                minRating={0}
                maxRating={5}
              />
            );
          })()}
        </Box>
        {/* FIXED BottomNavbar */}
        <div className="bottom-navbar-section">
          <BottomNavbar />
        </div>
      </div>
    </>
  );
};

export default CategoriesPage;

