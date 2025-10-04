const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK using environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  projectId: process.env.FIREBASE_PROJECT_ID
});

const firestore = admin.firestore();

async function setUserAsAdmin(email) {
  try {
    console.log(`Setting user ${email} as admin...`);
    
    // Find user by email
    const usersSnapshot = await firestore
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      console.error(`User with email ${email} not found in database`);
      
      // Try to find the user in Firebase Auth
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        console.log(`Found user in Firebase Auth:`, {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName
        });
        
        // Create user document in Firestore
        const userData = {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || 'Admin User',
          role: 'admin',
          apartmentNumber: '',
          phoneNumber: '',
          preferredLanguage: 'es',
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await firestore.collection('users').doc(userRecord.uid).set(userData);
        console.log(`✅ Created user document and set ${email} as admin`);
        
      } catch (authError) {
        console.error(`User ${email} not found in Firebase Auth either:`, authError.message);
        return;
      }
    } else {
      // Update existing user
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      
      console.log(`Found user:`, {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        currentRole: userData.role
      });
      
      // Update role to admin
      await userDoc.ref.update({
        role: 'admin',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Updated ${email} role to admin`);
    }
    
  } catch (error) {
    console.error('Error setting user as admin:', error);
  }
}

// Get email from command line argument or use default
const email = process.argv[2] || 'miriamnava217@gmail.com';

setUserAsAdmin(email)
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });