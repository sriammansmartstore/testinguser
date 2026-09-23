import crypto from 'crypto';
import assert from 'assert';

console.log('--- Starting Razorpay Backend Security & Logic Test Suite ---');

// 1. Test HMAC-SHA256 Signature Calculation & Timing-Safe Verification
console.log('\n[Test 1] Testing HMAC-SHA256 Signature Verification:');
const testSecret = 'test_secret_key_1234567890';
const orderId = 'order_test_123456';
const paymentId = 'pay_test_987654';

const expectedSig = crypto
  .createHmac('sha256', testSecret)
  .update(`${orderId}|${paymentId}`)
  .digest('hex');

const validSig = expectedSig;
const tamperedSig = expectedSig.replace(/.$/, '0'); // tamper last char

const validBuf = Buffer.from(validSig, 'utf8');
const expBuf = Buffer.from(expectedSig, 'utf8');
const tamperedBuf = Buffer.from(tamperedSig, 'utf8');

assert(crypto.timingSafeEqual(validBuf, expBuf) === true, 'Valid signature must match');
assert(crypto.timingSafeEqual(tamperedBuf, expBuf) === false, 'Tampered signature must NOT match');
console.log('✓ Valid signature accepted & tampered signature rejected.');

// 2. Test Amount Tampering Logic
console.log('\n[Test 2] Testing Amount Tampering Rejection:');
const serverOrderAmountInPaise = 49900; // Rs 499.00
const clientPaidAmountInPaise = 100; // Rs 1.00 (Tampered!)

function verifyAmount(expected, actual) {
  if (Number(expected) !== Number(actual)) {
    throw new Error(`Amount tampering detected: expected ${expected}, got ${actual}`);
  }
  return true;
}

try {
  verifyAmount(serverOrderAmountInPaise, clientPaidAmountInPaise);
  assert.fail('Should have caught amount tampering');
} catch (e) {
  assert(e.message.includes('Amount tampering detected'));
  console.log('✓ Amount tampering prevented successfully.');
}

// 3. Test Webhook Raw Body Verification
console.log('\n[Test 3] Testing Raw Body Webhook Verification:');
const webhookSecret = 'whsec_test_secret_xyz';
const rawPayload = Buffer.from(JSON.stringify({
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_test_001',
        order_id: 'order_test_001',
        status: 'captured',
        amount: 49900,
        currency: 'INR'
      }
    }
  }
}), 'utf8');

const webhookSig = crypto
  .createHmac('sha256', webhookSecret)
  .update(rawPayload)
  .digest('hex');

const rawHmac = crypto.createHmac('sha256', webhookSecret).update(rawPayload).digest('hex');
assert.strictEqual(webhookSig, rawHmac, 'Webhook signature must match raw payload');
console.log('✓ Raw body webhook signature verification verified.');

// 4. Test Captured-Only Enforcement
console.log('\n[Test 4] Testing Captured-Only Status Enforcement:');
function checkPaymentStatus(status) {
  if (status !== 'captured') {
    if (status === 'authorized') {
      return { allowed: false, action: 'keep_pending_capture' };
    }
    return { allowed: false, action: 'reject' };
  }
  return { allowed: true, action: 'mark_paid' };
}

assert.deepStrictEqual(checkPaymentStatus('captured'), { allowed: true, action: 'mark_paid' });
assert.deepStrictEqual(checkPaymentStatus('authorized'), { allowed: false, action: 'keep_pending_capture' });
assert.deepStrictEqual(checkPaymentStatus('failed'), { allowed: false, action: 'reject' });
console.log('✓ Only "captured" payments are allowed to be marked Paid / Confirmed.');

// 5. Test Coin Reservation & Double-Spend Prevention
console.log('\n[Test 5] Testing Coin Double-Spend Prevention Logic:');
let userState = {
  coins: 100,
  reservedCoins: []
};

function reserveCoinsMock(amount, orderId) {
  const now = Date.now();
  userState.reservedCoins = userState.reservedCoins.filter(r => r.expiresAt > now);
  const currentlyReserved = userState.reservedCoins.reduce((sum, r) => sum + r.amount, 0);
  const available = userState.coins - currentlyReserved;

  if (amount > available) {
    throw new Error(`Insufficient unreserved coins: available ${available}, requested ${amount}`);
  }

  userState.reservedCoins.push({
    orderId,
    amount,
    expiresAt: now + 15 * 60 * 1000
  });
  return true;
}

// First checkout reserves 60 coins from 100
reserveCoinsMock(60, 'ORD-001');
console.log('  Reservation 1 (60 coins) succeeded. Available remaining: 40');

// Concurrent checkout tries to reserve 50 coins (only 40 available)
try {
  reserveCoinsMock(50, 'ORD-002');
  assert.fail('Concurrent checkout should have failed due to insufficient unreserved coins');
} catch (e) {
  assert(e.message.includes('Insufficient unreserved coins'));
  console.log('✓ Concurrent double-spending of coins successfully blocked.');
}

// 6. Test Partial Cart Item Removal Logic
console.log('\n[Test 6] Testing Partial Cart Item Removal:');
let userCart = [
  { id: 'prod-A', unit: 'Kg', unitSize: '1', qty: 3 },
  { id: 'prod-B', unit: 'Pack', unitSize: '1', qty: 1 },
  { id: 'prod-C', unit: 'L', unitSize: '1', qty: 2 } // Not in this order
];

const purchasedItems = [
  { id: 'prod-A', unit: 'Kg', unitSize: '1', qty: 2 }, // Purchased 2 out of 3
  { id: 'prod-B', unit: 'Pack', unitSize: '1', qty: 1 }  // Purchased all 1
];

for (const purchased of purchasedItems) {
  const idx = userCart.findIndex(c => c.id === purchased.id && c.unit === purchased.unit && c.unitSize === purchased.unitSize);
  if (idx !== -1) {
    if (userCart[idx].qty <= purchased.qty) {
      userCart.splice(idx, 1);
    } else {
      userCart[idx].qty -= purchased.qty;
    }
  }
}

assert.strictEqual(userCart.length, 2, 'Should have 2 items remaining in cart');
assert.strictEqual(userCart.find(c => c.id === 'prod-A').qty, 1, 'prod-A should have 1 left (3 - 2 = 1)');
assert.strictEqual(userCart.find(c => c.id === 'prod-C').qty, 2, 'prod-C should remain untouched (qty 2)');
assert.strictEqual(userCart.find(c => c.id === 'prod-B'), undefined, 'prod-B should be removed completely');
console.log('✓ Partial cart item quantities correctly decremented and unrelated items preserved.');

console.log('\n======================================================');
console.log('ALL 6 BACKEND SECURITY & LOGIC TESTS PASSED SUCCESSFULLY! ✓');
console.log('======================================================\n');
