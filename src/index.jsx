import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service worker registration temporarily disabled
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     const swUrl = '/service-worker.js';
//     navigator.serviceWorker
//       .register(swUrl)
//       .then((registration) => {
//         // Optional: listen for updates to prompt user
//         registration.onupdatefound = () => {
//           const installingWorker = registration.installing;
//           if (!installingWorker) return;
//           installingWorker.onstatechange = () => {
//             if (installingWorker.state === 'installed') {
//               // New content is available; will be used after tabs reload
//               // console.log('New content is available; please refresh.');
//             }
//           };
//         };
//       })
//       .catch((err) => {
//         console.error('SW registration failed:', err);
//       });
//   });
// }
