/**
 * @description Calculates the order summary from a list of items.
 * @param {Array} items - The list of items (from cart or wishlist).
 * @returns {object} An object with formatted items and the total price.
 */
export const calculateOrderSummary = (items = []) => {
  if (!items || items.length === 0) {
    return { items: [], total: 0 };
  }

  const formattedItems = items.map((item) => {
    let selectedOption = null;
    if (Array.isArray(item.options) && item.options.length > 0) {
      selectedOption =
        item.options.find(
          (opt) =>
            (item.unit && opt.unit === item.unit) &&
            (item.unitSize && opt.unitSize == item.unitSize)
        ) || item.options[0];
    } else {
      selectedOption = {};
    }

    const price = selectedOption.sellingPrice || item.price || item.sellingPrice || 0;
    const quantity = item.quantity || item.qty || 1;

    return {
      id: item.id, // Preserve the Firestore document ID
      cartItemId: item.cartItemId, // Preserve the cart item ID
      name: item.name,
      qty: quantity,
      price: price,
      unit: selectedOption.unit || item.unit || "",
      unitSize: selectedOption.unitSize || item.unitSize || "",
      // Include all original item properties
      ...item,
      // Override with calculated values
      option: selectedOption,
      options: Array.isArray(item.options) ? item.options : [],
      imageUrl:
        Array.isArray(item.imageUrls) && item.imageUrls.length > 0
          ? item.imageUrls[0]
          : item.imageUrl || "https://via.placeholder.com/64",
    };
  });

  const total = formattedItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  return {
    items: formattedItems,
    total,
    gst: calculateGST(total)
  };
};

/**
 * @description Calculates GST components for the given amount.
 * @param {number} amount - The total amount on which GST is to be calculated.
 * @returns {object} An object with CGST, SGST, and total GST amounts.
 */
export const calculateGST = (amount) => {
  const cgstRate = 0.09; // 9%
  const sgstRate = 0.09; // 9%
  
  const cgst = parseFloat((amount * cgstRate).toFixed(2));
  const sgst = parseFloat((amount * sgstRate).toFixed(2));
  
  return {
    cgst,
    sgst,
    total: cgst + sgst
  };
};

/**
 * @description Validates a GST number format.
 * @param {string} gstNumber - The GST number to validate.
 * @returns {boolean} True if the GST number is valid, false otherwise.
 */
export const validateGSTNumber = (gstNumber) => {
  if (!gstNumber) return false;
  const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstPattern.test(gstNumber);
};
