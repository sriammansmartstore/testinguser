import crypto from 'crypto';
import { adminDb, verifyAuthToken } from './utils/firebaseAdmin.js';
import { getRazorpayClient } from './utils/razorpayClient.js';
import { finalizeOrderPayment } from './utils/orderFinalizer.js';
import { releaseCoinsReservation } from './utils/coinManager.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Authenticate user
    const authUser = await verifyAuthToken(req);
    const uid = authUser.uid;

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      internalOrderId
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !internalOrderId) {
      return res.status(400).json({ error: 'Missing required payment verification parameters' });
    }

    // 2. Fetch order from Firestore
    const orderRef = adminDb.collection('orders').doc(internalOrderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: `Order ${internalOrderId} not found` });
    }

    const orderData = orderSnap.data();

    // 3. Verify user ownership of this order
    if (orderData.buyerUid !== uid && orderData.userProfile?.uid !== uid) {
      return res.status(403).json({ error: 'Forbidden: You do not own this order' });
    }

    // 4. Verify stored Razorpay Order ID matches
    const storedRzpOrderId = orderData.razorpayOrderId;
    if (!storedRzpOrderId || storedRzpOrderId !== razorpay_order_id) {
      return res.status(400).json({ error: 'Security Alert: Order ID does not match server record' });
    }

    // 5. Verify HMAC-SHA256 Signature using timing-safe comparison
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new Error('Server configuration error: RAZORPAY_KEY_SECRET missing');
    }

    const hmac = crypto.createHmac('sha256', keySecret);
    hmac.update(`${storedRzpOrderId}|${razorpay_payment_id}`);
    const expectedSignature = hmac.digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const actualBuffer = Buffer.from(razorpay_signature, 'utf8');

    if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
      console.error(`[verify-razorpay-payment] Signature mismatch for order ${internalOrderId}`);
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }

    // 6. Fetch Payment details from Razorpay API
    const razorpay = getRazorpayClient();
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    // Verify payment fields
    if (payment.order_id !== storedRzpOrderId) {
      return res.status(400).json({ error: 'Payment is not associated with this order' });
    }

    if (Number(payment.amount) !== Number(orderData.amountInPaise)) {
      return res.status(400).json({
        error: `Payment amount tampering detected. Expected: ${orderData.amountInPaise}, Received: ${payment.amount}`
      });
    }

    if (payment.currency !== 'INR') {
      return res.status(400).json({ error: 'Invalid payment currency' });
    }

    // 7. Enforce: CAPTURED payments only can be marked Paid / Confirmed
    if (payment.status !== 'captured') {
      if (payment.status === 'authorized') {
        // Payment authorized but not yet captured: keep pending capture
        await orderRef.update({
          paymentStatus: 'Pending Capture',
          razorpayPaymentId: razorpay_payment_id
        });
        return res.status(202).json({
          success: false,
          status: 'authorized',
          message: 'Payment authorized but awaiting capture'
        });
      }

      // If failed
      if (payment.status === 'failed') {
        await orderRef.update({
          paymentStatus: 'Failed',
          status: 'Cancelled',
          paymentError: payment.error_description || 'Payment failed'
        });
        // Release coin reservation
        const userDocId = orderData.buyerId || orderData.userProfile?.userDocId || uid;
        await releaseCoinsReservation(userDocId, internalOrderId);

        return res.status(400).json({ error: 'Payment status is failed' });
      }

      return res.status(400).json({ error: `Payment not captured. Current status: ${payment.status}` });
    }

    // 8. Shared Idempotent Finalization Function
    const finalizationResult = await finalizeOrderPayment({
      internalOrderId,
      razorpayOrderId: storedRzpOrderId,
      razorpayPaymentId,
      razorpaySignature: razorpay_signature,
      paymentDetails: {
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        bank: payment.bank || null,
        wallet: payment.wallet || null,
        vpa: payment.vpa || null,
        fee: payment.fee,
        tax: payment.tax
      },
      triggerSource: 'client'
    });

    return res.status(200).json({
      success: true,
      orderId: internalOrderId,
      alreadyFinalized: finalizationResult.alreadyFinalized || false
    });

  } catch (err) {
    console.error('[verify-razorpay-payment] Error:', err);
    return res.status(err.message?.includes('Unauthorized') ? 401 : 400).json({
      error: err.message || 'Payment verification failed'
    });
  }
}
