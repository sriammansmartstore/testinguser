# Notification System Setup Guide

## Overview
The Sri Amman Smart Store now has a comprehensive notification system with the following features:
- **Unread Badge**: Shows count of unread notifications on the bell icon
- **Push Notifications**: Foreground and background notifications with Firebase Cloud Messaging
- **Sound Notifications**: Audio feedback when notifications arrive
- **Notification Popup**: Visual popup on home screen for new notifications
- **Permissions Management**: User can grant/revoke notification, location, camera, and microphone permissions
- **Read Status Tracking**: Track which notifications have been read

## Setup Instructions

### 1. Firebase Cloud Messaging (FCM) Setup

#### Step 1: Get VAPID Key
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select "sri-amman-smart-store" project
3. Go to **Project Settings** → **Cloud Messaging** tab
4. Copy the **Web Push Certificates** → **Key pair**
5. The public key is your VAPID key

#### Step 2: Update App Configuration
In `src/App.jsx`, replace the placeholder VAPID key with your actual key:
```javascript
getToken(messaging, {
  vapidKey: 'YOUR_ACTUAL_VAPID_KEY_HERE',
  serviceWorkerRegistration: registration
})
```

#### Step 3: Create Service Worker
The app already has `/public/firebase-messaging-sw.js` configured. Ensure it's set up with your Firebase config.

### 2. Database Structure

When sending notifications from your admin panel, ensure the notification documents in Firestore include:

```json
{
  "title": "Order Confirmed",
  "body": "Your order #12345 has been confirmed",
  "createdAt": "2025-12-06T10:30:00Z",
  "read": false,
  "deleted": false,
  "audience": "all|specific_user_id"
}
```

Location in Firestore:
- **Global notifications**: `notifications/{docId}`
- **User-specific**: `users/{userDocId}/notifications/{docId}`

### 3. User Permissions

Users can manage their notification permissions in **Settings** → **Permissions** tab:
- Push Notifications
- Notification Sound
- Geolocation
- Camera
- Microphone

Permissions are stored in Firestore: `users/{userId}` with `permissions` field

### 4. Frontend Implementation

#### Components
- **PermissionsManager** (`src/components/PermissionsManager.jsx`): Handles permission requests and UI
- **UserSettingsPage** (`src/pages/UserSettingsPage.jsx`): Tab-based settings page with password and permissions
- **NotificationsPage** (`src/pages/NotificationsPage.jsx`): Lists all notifications with read status

#### Key Functions

**Play Sound**:
```javascript
import { playNotificationSound } from './utils/notificationSound';
playNotificationSound();
```

**Mark as Read**:
```javascript
import { updateDoc } from 'firebase/firestore';
await updateDoc(docRef, { read: true });
```

### 5. Testing Notifications

#### Test Foreground Notification
1. Open the app in browser
2. Allow notifications when prompted
3. Send test message via Firebase Console → Cloud Messaging
4. You should see popup on home screen

#### Test Background Notification
1. Close or minimize the app tab
2. Send test notification via Firebase Console
3. Browser will show native notification with sound

#### View Unread Badge
1. Go to admin panel
2. Add notification to user's `users/{userId}/notifications` collection with `read: false`
3. Badge should show count automatically

### 6. Troubleshooting

#### Badge Not Showing
- Check browser console for errors
- Ensure `read` field exists in Firestore documents
- Verify user is authenticated

#### Sound Not Playing
- Check if `/notification.mp3` exists in public folder
- Verify browser allows audio playback
- Check console for audio API errors
- Fallback beep sound should play automatically

#### Popup Not Visible
- Ensure Firebase messaging is properly initialized
- Check service worker is registered
- Verify FCM token is being generated
- Check browser console for messaging errors

#### Permissions Not Saving
- Ensure user is authenticated
- Check Firestore write permissions for `users/{userId}` collection
- Verify browser allows the requested permission

### 7. Mobile/PWA Support

For Android/iOS PWA:
1. Install app on home screen
2. Allow all permissions when prompted
3. Notifications work in background using service worker
4. Sound plays automatically on notification arrival

### 8. Database Permissions

Ensure Firestore rules allow:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/notifications/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
    match /notifications/{document=**} {
      allow read: if request.auth != null;
    }
  }
}
```

## Features Summary

| Feature | Status | Location |
|---------|--------|----------|
| Unread Badge | ✅ | App.jsx, NotificationsPage.jsx |
| Push Notifications | ✅ | firebase-messaging-sw.js, App.jsx |
| Sound Notifications | ✅ | utils/notificationSound.js |
| Notification Popup | ✅ | App.jsx |
| Permissions UI | ✅ | components/PermissionsManager.jsx |
| Settings Page | ✅ | pages/UserSettingsPage.jsx |
| Read Status | ✅ | pages/NotificationsPage.jsx |

## Next Steps

1. Replace VAPID key in App.jsx
2. Test with sample notifications
3. Configure admin panel to send notifications
4. Monitor browser console for any errors
5. Deploy and test on mobile devices

---

For issues, check the browser console and Firestore logs for detailed error messages.
