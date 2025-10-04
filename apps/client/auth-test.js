// Test Firebase Authentication setup
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyBlIUI7gvwc4DmkpuRVQNJMWkH4p7lM8zA",
  authDomain: "home-management-47e95.firebaseapp.com",
  projectId: "home-management-47e95",
  storageBucket: "home-management-47e95.firebasestorage.app",
  messagingSenderId: "325501118624",
  appId: "1:325501118624:web:98665e6a441f5fa01c41c5",
  measurementId: "G-754MYT8BQD"
};

async function testAuth() {
  try {
    console.log('🔧 Testing Firebase Authentication...');
    
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    
    console.log('✅ Firebase Auth initialized');
    console.log('📧 Testing email/password authentication...');
    
    // Try to create a test user (this will fail if auth is not enabled)
    const testEmail = 'test@example.com';
    const testPassword = 'testpassword123';
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
      console.log('✅ Authentication is working! User created:', userCredential.user.email);
      
      // Clean up - delete the test user
      await userCredential.user.delete();
      console.log('🧹 Test user cleaned up');
      
    } catch (authError) {
      if (authError.code === 'auth/configuration-not-found') {
        console.error('❌ Authentication not enabled in Firebase Console');
        console.log('📋 To fix this:');
        console.log('1. Go to https://console.firebase.google.com/');
        console.log('2. Select your project: home-management-47e95');
        console.log('3. Go to Authentication > Sign-in method');
        console.log('4. Enable Email/Password authentication');
      } else if (authError.code === 'auth/email-already-in-use') {
        console.log('✅ Authentication is working! (Test email already exists)');
      } else {
        console.error('❌ Authentication error:', authError.code, authError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Firebase setup error:', error.message);
  }
}

testAuth();