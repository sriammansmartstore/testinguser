import admin from 'firebase-admin';

// Initialize Firebase Admin as a singleton
if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'sri-amman-smart-store';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccountRaw) {
      const serviceAccount = typeof serviceAccountRaw === 'string' ? JSON.parse(serviceAccountRaw) : serviceAccountRaw;
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId
      });
    } else if (clientEmail && privateKey) {
      // Handle escaped newlines in environment variables
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey
        }),
        projectId
      });
    } else {
      // Fallback for local development or Google Cloud environment
      admin.initializeApp({
        projectId
      });
    }
  } catch (err) {
    console.error('[firebaseAdmin] Initialization error:', err);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export { admin };

/**
 * Verify Firebase ID Token from Authorization header
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ uid: string, email?: string, [key: string]: any }>}
 */
export async function verifyAuthToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid Authorization header');
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  if (!idToken) {
    throw new Error('Unauthorized: Empty token');
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken;
  } catch (err) {
    console.error('[firebaseAdmin] Token verification failed:', err.message);
    throw new Error(`Unauthorized: ${err.message}`);
  }
}
