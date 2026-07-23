// Firebase config
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBOWbd0Pcxd-yZsNXz-xNftG-2XxDfwLj8",
  authDomain: "breakfast-sk.firebaseapp.com",
  projectId: "breakfast-sk",
  storageBucket: "breakfast-sk.firebasestorage.app",
  messagingSenderId: "733355469768",
  appId: "1:733355469768:web:a2a3243c93e0bbdc6a2efd"
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
