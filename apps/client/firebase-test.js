// Simple Firebase configuration test
const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyBlIUI7gvwc4Ddsadsadasam",
  authDomain: "home-manag.firebaseapp.com",
  projectId: "home-management",
  storageBucket: "home-management-47e95.firebasestorage.app",
  messagingSenderId: "325501118624",
  appId: "1:325501118624:web:98665e6a441f5fa01c41c5",
  measurementId: "G-754MYT8BQD"
};

try {
  console.log('Testing Firebase configuration...');
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  console.log('✅ Firebase initialized successfully');
  console.log('Project ID:', firebaseConfig.projectId);
  console.log('Auth Domain:', firebaseConfig.authDomain);
} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
}