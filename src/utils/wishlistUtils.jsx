import { collection, getDocs } from 'firebase/firestore';

export function getOptionKey(productId, option) {
  return `${productId}_${option?.unit || ''}_${option?.unitSize || ''}`;
}

export function getPrimaryOption(product, selectedIndex = 0) {
  if (!product) return {};
  if (Array.isArray(product.options) && product.options.length > 0) {
    return product.options[selectedIndex] || product.options[0];
  }
  return {
    mrp: product.mrp,
    sellingPrice: product.sellingPrice,
    specialPrice: product.specialPrice,
    unit: product.unit,
    unitSize: product.unitSize,
    quantity: product.quantity,
  };
}

export async function fetchWishlistsWithProductOptions(db, userUid, productId) {
  const colRef = collection(db, 'users', userUid, 'wishlists');
  const snapshot = await getDocs(colRef);
  const fetchedWishlists = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  const optionsInWishlists = {};
  const wishlistsWithProduct = [];

  for (const wl of snapshot.docs) {
    const wishlistId = wl.id;
    const productsRef = collection(db, 'users', userUid, 'wishlists', wishlistId, 'products');
    const prodSnap = await getDocs(productsRef);

    const optionsInWishlist = [];
    prodSnap.forEach((doc) => {
      if (doc.id.startsWith(productId)) {
        optionsInWishlist.push({ optionKey: doc.id, ...doc.data() });
      }
    });

    if (optionsInWishlist.length > 0) {
      optionsInWishlists[wishlistId] = optionsInWishlist;
      wishlistsWithProduct.push({ id: wishlistId, name: wl.data().name || wishlistId, options: optionsInWishlist });
    }
  }

  return { fetchedWishlists, wishlistsWithProduct, optionsInWishlists };
}
