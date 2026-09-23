import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Typography, IconButton, CircularProgress, Button, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ProductCard from "../components/ProductCard";
import { db } from "../firebase";
import { AuthContext } from "../context/AuthContext";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

const WishlistDetailPage = () => {
  const handleDeleteProduct = async (productId) => {
    if (!user || !wishlistId || !productId) return;
    try {
      await import("firebase/firestore").then(({ doc, deleteDoc }) =>
        deleteDoc(doc(db, "users", user.uid, "wishlists", wishlistId, "products", productId))
      );
      setProducts(products => products.filter(p => p.id !== productId));
    } catch (err) {
      alert("Failed to remove product from wishlist.");
    }
  };
  const { wishlistId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [wishlistName, setWishlistName] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  // Track quantity for each product
  const [quantities, setQuantities] = useState({});
  // Store selected option index for each product
  const [selectedOptionIdx, setSelectedOptionIdx] = useState({});

  useEffect(() => {
    if (!user || !wishlistId) return;
    setLoading(true);
    const fetchData = async () => {
      try {
        // Fetch wishlist name
        const wlDoc = await getDoc(doc(db, "users", user.uid, "wishlists", wishlistId));
        setWishlistName(wlDoc.exists() ? wlDoc.data().name || wishlistId : wishlistId);
        // Fetch products
        const prodCol = collection(db, "users", user.uid, "wishlists", wishlistId, "products");
        const prodSnap = await getDocs(prodCol);
        setProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setProducts([]);
      }
      setLoading(false);
    };
    fetchData();
  }, [user, wishlistId]);

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, py: { xs: 2, sm: 3 }, maxWidth: 900, mx: "auto" }}>
      <Box display="flex" alignItems="center" mb={2}>
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ flex: 1, fontWeight: 700 }}>{wishlistName || "Wishlist"}</Typography>
      </Box>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <CircularProgress />
        </Box>
      ) : products.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ mt: 8 }}>
          No products in this wishlist.
        </Typography>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
            {products.map(product => (
              <Box key={product.id} sx={{ position: 'relative', p: 2, borderRadius: 3, boxShadow: 3, background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 6 } }}>
                <img src={product.imageUrls?.[0] || "https://via.placeholder.com/120"} alt={product.name} style={{ width: 100, height: 100, objectFit: 'contain', marginBottom: 8 }} />
                <IconButton aria-label="Delete from wishlist" color="error" sx={{ position: 'absolute', top: 8, right: 8, background: '#fff', borderRadius: '50%', boxShadow: 1 }} onClick={() => handleDeleteProduct(product.id)}>
                  <DeleteIcon />
                </IconButton>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{product.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{product.brand}</Typography>
                {/* Unit selector if multiple units/options */}
                {Array.isArray(product.options) && product.options.length > 1 && (
                  <Box sx={{ mb: 1, width: '100%' }}>
                    <FormControl fullWidth size="small">
                      <InputLabel id={`unit-select-label-${product.id}`}>Unit</InputLabel>
                      <Select
                        labelId={`unit-select-label-${product.id}`}
                        value={selectedOptionIdx[product.id] ?? 0}
                        label="Unit"
                        onChange={e => setSelectedOptionIdx(idxObj => ({ ...idxObj, [product.id]: Number(e.target.value) }))}
                      >
                        {product.options.map((opt, idx) => (
                          <MenuItem key={idx} value={idx}>
                            {opt.unitSize} {opt.unit}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {(() => {
                    if (Array.isArray(product.options) && product.options.length > 0) {
                      const idx = selectedOptionIdx[product.id] ?? 0;
                      const opt = product.options[idx];
                      if (opt) {
                        const price = opt.sellingPrice ?? opt.specialPrice ?? opt.mrp;
                        return `₹${price} / ${opt.unitSize} ${opt.unit}`;
                      }
                    }
                    return product.price ? `₹${product.price}` : '';
                  })()}
                </Typography>
                {/* Quantity toggler */}
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, background: '#f5f5f5', borderRadius: 2, px: 1.5, py: 0.5, gap: 1 }}>
                  <IconButton size="small" color="primary" sx={{ borderRadius: 1, background: '#e3f2fd', '&:hover': { background: '#bbdefb' } }} onClick={() => setQuantities(q => ({ ...q, [product.id]: Math.max(1, (q[product.id] || 1) - 1) }))}>
                    <span style={{ fontWeight: 700, fontSize: 18 }}>-</span>
                  </IconButton>
                  <Typography sx={{ mx: 1, minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: 16 }}>{quantities[product.id] || 1}</Typography>
                  <IconButton size="small" color="primary" sx={{ borderRadius: 1, background: '#e3f2fd', '&:hover': { background: '#bbdefb' } }} onClick={() => setQuantities(q => ({ ...q, [product.id]: (q[product.id] || 1) + 1 }))}>
                    <span style={{ fontWeight: 700, fontSize: 18 }}>+</span>
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
          {/* Checkout Button */}
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
            <Button variant="contained" color="primary" size="large" onClick={() => {
              // Go to review page with selected items and quantities
              const selected = products.map(p => {
                let optionIdx = selectedOptionIdx[p.id] ?? 0;
                let opt = Array.isArray(p.options) && p.options.length > 0 ? p.options[optionIdx] : null;
                let price = opt ? (opt.sellingPrice ?? opt.specialPrice ?? opt.mrp) : p.price;
                let unit = opt ? opt.unit : p.unit;
                let unitSize = opt ? opt.unitSize : undefined;
                return {
                  ...p,
                  quantity: quantities[p.id] || 1,
                  unit,
                  unitSize,
                  price,
                  selectedOption: opt
                };
              });
              navigate(`/wishlist/${wishlistId}/review`, { state: { items: selected, wishlistName } });
            }} disabled={products.length === 0}>
              Checkout
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
};

export default WishlistDetailPage;
