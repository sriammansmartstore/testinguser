import Razorpay from 'razorpay';

export function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error('Razorpay server credentials missing: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not configured');
  }

  return new Razorpay({
    key_id,
    key_secret
  });
}
