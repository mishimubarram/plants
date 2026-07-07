import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser,
  signInAnonymously
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDocFromServer,
  orderBy,
  limit,
  collectionGroup
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || '(default)');
export const auth = getAuth(app);

// Authentication Setup
const provider = new GoogleAuthProvider();

// Define custom user type and custom listeners
export type User = FirebaseUser;

const authListeners: Array<(user: FirebaseUser | null) => void> = [];
let simulatedUser: any | null = null;

// Read simulated user from local storage
try {
  const saved = localStorage.getItem('botanic_simulated_user');
  if (saved) {
    simulatedUser = JSON.parse(saved);
  }
} catch (e) {
  console.error("Failed to load simulated user from localStorage:", e);
}

export function getActiveUser(): FirebaseUser | null {
  if (auth.currentUser) {
    return auth.currentUser;
  }
  return simulatedUser as FirebaseUser | null;
}

export function onAuthStateChanged(authInstance: any, callback: (user: FirebaseUser | null) => void) {
  authListeners.push(callback);
  
  // Call immediately with the current state
  const currentUser = getActiveUser();
  callback(currentUser);

  return () => {
    const index = authListeners.indexOf(callback);
    if (index > -1) {
      authListeners.splice(index, 1);
    }
  };
}

// Keep our listeners in sync with real firebase auth state
firebaseOnAuthStateChanged(auth, (firebaseUser) => {
  if (firebaseUser) {
    simulatedUser = null;
    localStorage.removeItem('botanic_simulated_user');
  }
  const activeUser = getActiveUser();
  authListeners.forEach(listener => {
    try {
      listener(activeUser);
    } catch (e) {
      console.error("Error in auth listener:", e);
    }
  });
});

function triggerAuthListeners() {
  const activeUser = getActiveUser();
  authListeners.forEach(listener => {
    try {
      listener(activeUser);
    } catch (e) {
      console.error("Error in auth listener:", e);
    }
  });
}

// Authentication Functions
export async function signIn() {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    console.error("Sign in failed:", error);
    throw error;
  }
}

export async function signInAsGuest() {
  try {
    // Attempt real Firebase Anonymous sign in first
    const credential = await signInAnonymously(auth);
    return credential.user;
  } catch (error) {
    console.warn("Firebase Anonymous Sign-In failed or is disabled. Using local emulated guest session:", error);
    // Create local mock guest user
    const guestUser = {
      uid: 'guest_demo_user',
      displayName: 'Gardener Guest',
      email: 'guest@botanic.ai',
      photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
      emailVerified: true,
      isAnonymous: true,
      tenantId: null,
      providerData: [],
      metadata: {},
      phoneNumber: null,
      refreshToken: '',
      delete: async () => {},
      getIdToken: async () => '',
      getIdTokenResult: async () => ({}) as any,
      reload: async () => {},
      toJSON: () => ({})
    };
    simulatedUser = guestUser;
    localStorage.setItem('botanic_simulated_user', JSON.stringify(guestUser));
    triggerAuthListeners();
    return guestUser as unknown as FirebaseUser;
  }
}

export async function logOut() {
  try {
    simulatedUser = null;
    localStorage.removeItem('botanic_simulated_user');
    await signOut(auth);
    triggerAuthListeners();
  } catch (error) {
    console.error("Sign out failed:", error);
  }
}

// Re-export Firestore functions so App.tsx can import them directly
export {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  collectionGroup
};

// Error Handling helper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: getActiveUser()?.uid,
      email: getActiveUser()?.email,
      emailVerified: getActiveUser()?.emailVerified,
      isAnonymous: getActiveUser()?.isAnonymous,
      tenantId: getActiveUser()?.tenantId,
      providerInfo: getActiveUser()?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Database connection error details: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
