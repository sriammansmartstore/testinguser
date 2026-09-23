import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, collectionGroup, getDocs } from 'firebase/firestore';

const useSearch = (searchTerm) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState({ categories: [], products: [] });

  const searchProducts = useCallback(async (term) => {
    try {
      console.log('[useSearch] Searching products for term:', term);
      const searchTermLower = term.toLowerCase();
      const isShort = searchTermLower.length <= 1;

      // Use collectionGroup to fetch all items across categories (same approach as HomePage)
      const itemsQuery = collectionGroup(db, 'items');
      const itemsSnap = await getDocs(itemsQuery);
      console.log('[useSearch] Total items fetched for search:', itemsSnap.size);

      const products = itemsSnap.docs
        .map((doc) => {
          const data = doc.data();
          // Derive category from parent path: products/{category}/items/{item}
          const category = doc.ref.parent?.parent?.id;

          // Normalize keywords to array (support array or comma-separated string)
          let keywordsArray = [];
          if (Array.isArray(data.keywords)) {
            keywordsArray = data.keywords;
          } else if (typeof data.keywords === 'string') {
            keywordsArray = data.keywords.split(',').map(kw => kw.trim());
          }

          const name = data.name?.toLowerCase() || '';
          const nameTa = data.nameTamil?.toLowerCase() || '';
          const brand = data.brand?.toLowerCase() || '';
          const desc = data.description?.toLowerCase() || '';

          // For 1-char input, only allow startsWith on names to avoid overwhelming results
          const matches = isShort
            ? (name.startsWith(searchTermLower) || nameTa.startsWith(searchTermLower))
            : (
                name.includes(searchTermLower) ||
                nameTa.includes(searchTermLower) ||
                brand.includes(searchTermLower) ||
                keywordsArray.some((kw) => String(kw).toLowerCase().includes(searchTermLower)) ||
                desc.includes(searchTermLower)
              );

          if (!matches) return null;

          // Use first option for pricing if available
          const firstOption = Array.isArray(data.options) && data.options.length > 0 ? data.options[0] : {};

          // Compute a simple relevance score
          let score = 0;
          if (name === searchTermLower) score += 50;           // exact name
          if (name.startsWith(searchTermLower)) score += 30;    // prefix name
          if (name.includes(searchTermLower)) score += 20;      // contains name
          if (nameTa.startsWith(searchTermLower)) score += 15;  // tamil prefix
          if (brand.includes(searchTermLower)) score += 10;     // brand
          if (desc.includes(searchTermLower)) score += 5;       // description
          if (keywordsArray.some((kw) => String(kw).toLowerCase() === searchTermLower)) score += 12; // exact keyword
          if (keywordsArray.some((kw) => String(kw).toLowerCase().includes(searchTermLower))) score += 6; // partial keyword

          return {
            id: doc.id,
            ...data,
            category,
            imageUrl: data.imageUrls?.[0] || data.images?.[0],
            price: firstOption.sellingPrice || firstOption.specialPrice || firstOption.mrp || data.sellingPrice || data.price || 0,
            mrp: firstOption.mrp || data.mrp || 0,
            _score: score,
          };
        })
        .filter(Boolean);

      // Sort by computed relevance score (higher first)
      const sorted = products.sort((a, b) => (b._score || 0) - (a._score || 0));

      return sorted.slice(0, 10);
    } catch (error) {
      console.error('[useSearch] Error searching products:', error);
      return [];
    }
  }, []);

  const searchCategories = useCallback(async (term) => {
    try {
      const categoriesRef = collection(db, 'categories');
      const querySnapshot = await getDocs(categoriesRef);
      const searchTermLower = term.toLowerCase();
      const isShort = searchTermLower.length <= 1;

      const categories = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Split search term into words for partial matching
        const searchWords = searchTermLower.split(/\s+/).filter(Boolean);

        // Check if any word matches the category
        const nameLower = data.name?.toLowerCase() || '';
        const descLower = data.description?.toLowerCase() || '';
        const matches = isShort
          ? nameLower.startsWith(searchTermLower)
          : searchWords.some((word) => nameLower.includes(word) || descLower.includes(word));

        if (matches) {
          // Simple relevance scoring
          let score = 0;
          if (nameLower === searchTermLower) score += 40;         // exact name
          if (nameLower.startsWith(searchTermLower)) score += 25;  // prefix
          if (!isShort && nameLower.includes(searchTermLower)) score += 15; // contains
          if (!isShort && descLower.includes(searchTermLower)) score += 5;   // desc contains

          categories.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            imageUrl: data.imageUrl,
            _score: score,
            ...data,
          });
        }
      });

      // Sort categories by relevance (exact matches first)
      return categories
        .sort((a, b) => (b._score || 0) - (a._score || 0))
        .slice(0, 5); // Limit to top 5 most relevant categories
    } catch (error) {
      console.error('Error searching categories:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    const debounceTimeout = setTimeout(async () => {
      if (!searchTerm || searchTerm.length < 1) {
        setSuggestions({ categories: [], products: [] });
        return;
      }

      setLoading(true);
      try {
        console.log('Searching for:', searchTerm);
        const [categories, products] = await Promise.all([
          searchCategories(searchTerm),
          searchProducts(searchTerm)
        ]);

        console.log('Search results:', { categories, products });
        setSuggestions({
          categories: categories.slice(0, 5),  // Limit to top 5 categories
          products: products.slice(0, 10)      // Limit to top 10 products
        });
      } catch (error) {
        console.error('Search error:', error);
        setSuggestions({ categories: [], products: [] });
      } finally {
        setLoading(false);
      }
    }, 200); // Reduced debounce time for faster response

    return () => clearTimeout(debounceTimeout);
  }, [searchTerm, searchCategories, searchProducts]);

  return { loading, suggestions };
};

export default useSearch;