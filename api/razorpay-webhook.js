import crypto from 'crypto';
import { adminDb } from './utils/firebaseAdmin.js';
import { finalizeOrderPayment } from './utils/orderFinalizer.js';
import { releaseCoinsReservation } from './utils/coinManager.js';

// Disable default Vercel body parser to get exact raw body buffer for signature verification
export const config = {
  api: {
    bodyParser: false
  }
};

/**
 * Read raw buffer from incoming request stream
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Buffer>}
 */
function getRawBodyBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured on server' });
  }

  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
  }

  try {
    // 1. Read exact raw request body buffer
    const rawBodyBuffer = await getRawBodyBuffer(req);

    // 2. Verify HMAC-SHA256 signature against raw body
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBodyBuffer)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const actualBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
      console.error('[razorpay-webhook] Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // 3. Parse JSON event payload
    const event = JSON.parse(rawBodyBuffer.toString('utf8'));
    const eventType = event.event;
    console.log(`[razorpay-webhook] Received valid event: ${eventType} (ID: ${event.id || 'N/A'})`);

    // 4. Handle 'payment.captured' or 'order.paid'
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id || event.payload?.order?.entity?.id;
      const paymentId = paymentEntity?.id;

      if (!rzpOrderId) {
        console.warn('[razorpay-webhook] Event missing order_id:', eventType);
        return res.status(200).json({ received: true });
      }

      // Check payment status is strictly captured
      if (paymentEntity && paymentEntity.status !== 'captured') {
        console.log(`[razorpay-webhook] Payment ${paymentId} status is ${paymentEntity.status}, not captured. Awaiting capture.`);
        return res.status(200).json({ received: true, status: paymentEntity.status });
      }

      // Locate internal order in Firestore by razorpayOrderId
      const ordersQuery = await adminDb.collection('orders').where('razorpayOrderId', '==', rzpOrderId).limit(1).get();
      if (ordersQuery.empty) {
        console.error(`[razorpay-webhook] No order found matching razorpayOrderId: ${rzpOrderId}`);
        return res.status(404).json({ error: 'Order not found' });
      }

      const orderDoc = ordersQuery.docs[0];
      const internalOrderId = orderDoc.id;

      // 5. Execute shared idempotent finalization function
      const finalResult = await finalizeOrderPayment({
        internalOrderId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: paymentId,
        paymentDetails: paymentEntity ? {
          method: paymentEntity.method,
          email: paymentEntity.email,
          contact: paymentEntity.contact,
          vpa: paymentEntity.vpa || null,
          fee: paymentEntity.fee,
          tax: paymentEntity.tax
        } : {},
        triggerSource: 'webhook'
      });

      console.log(`[razorpay-webhook] Order ${internalOrderId} finalized via webhook (alreadyFinalized: ${finalResult.alreadyFinalized})`);
      return res.status(200).json({ success: true, processed: true });
    }

    // 6. Handle 'payment.failed'
    if (eventType === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id;

      if (rzpOrderId) {
        const querySnap = await adminDb.collection('orders').where('razorpayOrderId', '==', rzpOrderId).limit(1).get();
        if (!querySnap.empty) {
          const orderDoc = querySnap.docs[0];
          const orderData = orderDoc.data();

          if (orderData.paymentStatus !== 'Paid') {
            await orderDoc.ref.update({
              paymentStatus: 'Failed',
              status: 'Cancelled',
              paymentError: paymentEntity.error_description || 'Payment failed via webhook'
            });

            // Release coin reservation
            const userDocId = orderData.buyerId || orderData.userProfile?.userDocId || orderData.buyerUid;
            await releaseCoinsReservation(userDocId, orderDoc.id);
          }
        }
      }
      return res.status(200).json({ received: true, event: 'payment.failed' });
    }

    // Other events acknowledge receipt
    return res.status(200).json({ received: true, ignored: true });

  } catch (err) {
    console.error('[razorpay-webhook] Processing error:', err);
    return res.status(500).json({ error: 'Internal webhook processing error' });
  }
}
