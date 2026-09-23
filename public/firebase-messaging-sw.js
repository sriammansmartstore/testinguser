// [firebase-messaging-sw.js]
// This file enables Firebase Cloud Messaging background notifications.

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDTzovF1RChmczvRXTNtY9-i-cOTI2JAuQ',
  authDomain: 'sri-amman-smart-store.firebaseapp.com',
  projectId: 'sri-amman-smart-store',
  storageBucket: 'sri-amman-smart-store.firebasestorage.app',
  messagingSenderId: '1018585256480',
  appId: '1:1018585256480:web:1312d2d636b0672098a245',
  measurementId: 'G-7D1TG59XVM'
});

const messaging = firebase.messaging();

// Handle background push notifications
messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png',
    sound: '/notification.mp3'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
