import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../config/firebase.config';
import { UserRole } from '@home-management/types';

// Auth context interface
interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, additionalData?: {
    role?: UserRole;
    apartmentNumber?: string;
    phoneNumber?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserRole: () => Promise<void>;
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user role from backend
  const fetchUserRole = async (user: User): Promise<UserRole | null> => {
    try {
      console.log('🔍 Fetching user role for:', user.email);
      const token = await user.getIdToken(true); // Force refresh token
      console.log('🔑 Got ID token (first 50 chars):', token.substring(0, 50) + '...');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Profile API response status:', response.status);

      if (response.ok) {
        const userData = await response.json();
        console.log('✅ Successfully fetched user role:', userData.role);
        return userData.role as UserRole;
      } else if (response.status === 401) {
        console.error('❌ Failed to fetch user role: Unauthorized - trying to create profile');
        // If user profile doesn't exist, try to create it with default role
        return await createMissingUserProfile(user, token);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch user role:', response.status, response.statusText, errorText);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching user role:', error);
      return null;
    }
  };

  // Create missing user profile
  const createMissingUserProfile = async (user: User, token: string): Promise<UserRole | null> => {
    try {
      console.log('🔧 Creating missing user profile for:', user.email);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          role: UserRole.RESIDENT, // Default role
          apartmentNumber: '',
          phoneNumber: '',
        }),
      });

      console.log('📡 Register API response status:', response.status);

      if (response.ok) {
        const userData = await response.json();
        console.log('✅ User profile created successfully:', userData);
        return userData.user.role as UserRole;
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to create user profile:', response.status, response.statusText, errorText);
        return UserRole.RESIDENT; // Fallback to resident role
      }
    } catch (error) {
      console.error('❌ Error creating user profile:', error);
      return UserRole.RESIDENT; // Fallback to resident role
    }
  };

  // Refresh user role
  const refreshUserRole = async (): Promise<void> => {
    if (user) {
      const role = await fetchUserRole(user);
      setUserRole(role);
    }
  };

  // Sign in function
  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth(), email, password);
      const role = await fetchUserRole(userCredential.user);
      setUserRole(role);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  // Sign up function
  const signUp = async (
    email: string, 
    password: string, 
    displayName: string, 
    additionalData?: {
      role?: UserRole;
      apartmentNumber?: string;
      phoneNumber?: string;
    }
  ): Promise<void> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth(), email, password);
      
      // Update user profile with display name
      await updateProfile(userCredential.user, {
        displayName,
      });

      // Create user profile in backend
      const token = await userCredential.user.getIdToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          displayName,
          role: additionalData?.role || UserRole.RESIDENT,
          apartmentNumber: additionalData?.apartmentNumber || '',
          phoneNumber: additionalData?.phoneNumber || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create user profile');
      }

      const userData = await response.json();
      setUserRole(userData.role as UserRole);
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      await signOut(auth());
      setUserRole(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  // Reset password function
  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth(), email);
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth(), async (user) => {
      console.log('🔄 Auth state changed:', user ? `User: ${user.email}` : 'No user');
      setUser(user);
      
      if (user) {
        // Ensure the user has a valid ID token
        try {
          const token = await user.getIdToken(true); // Force refresh
          console.log('✅ Got valid ID token for user:', user.email);
          
          // Fetch user role when user is authenticated
          const role = await fetchUserRole(user);
          setUserRole(role);
        } catch (error) {
          console.error('❌ Failed to get ID token:', error);
          // If we can't get a valid token, sign out the user
          await signOut(auth());
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Add a periodic token refresh to ensure tokens stay valid
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(async () => {
      try {
        // Force refresh the token every 30 minutes
        await user.getIdToken(true);
        console.log('🔄 Token refreshed automatically');
      } catch (error) {
        console.error('❌ Failed to refresh token:', error);
        // If token refresh fails, the user might need to re-authenticate
        console.log('⚠️  User may need to re-authenticate');
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(refreshInterval);
  }, [user]);

  const value: AuthContextType = {
    user,
    userRole,
    loading,
    signIn,
    signUp,
    logout,
    resetPassword,
    refreshUserRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};