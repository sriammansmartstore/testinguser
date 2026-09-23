// Small utility for formatting Indian rupee consistently across the app
export const rupee = (n) => {
  try {
    const num = Number(n || 0) || 0;
    return `₹${num.toLocaleString('en-IN')}`;
  } catch (e) {
    return `₹${n}`;
  }
};

export default rupee;
