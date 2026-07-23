// Firebase config - replace with actual project values
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "breakfast-kiosk-shared.firebaseapp.com",
  projectId: "breakfast-kiosk-shared",
  storageBucket: "breakfast-kiosk-shared.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Get shopId from URL parameter ?shop=xxx
function getShopId() {
  const params = new URLSearchParams(window.location.search);
  const shopId = params.get('shop');
  if (!shopId) {
    // Default for development
    return 'demo-shop';
  }
  return shopId;
}

// Global config
window.APP_CONFIG = {
  firebaseConfig: FIREBASE_CONFIG,
  shopId: getShopId()
};
