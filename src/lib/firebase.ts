import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Environment detection: Check if we are running in the AI Studio container sandbox
const isAiStudioEnv = typeof window !== 'undefined' && (
  window.location.hostname.includes('run.app') ||
  window.location.hostname.includes('ais-dev-') ||
  window.location.hostname.includes('ais-pre-')
);

// Initialize Firestore database dynamically:
// AI Studio uses a specific named database instance, while a standard custom deployment
// utilizes the default database instance.
const db = isAiStudioEnv && firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const storage = getStorage(app);

console.log(`[Firebase] Initialized with Project ID: ${firebaseConfig.projectId}. Database: ${
  isAiStudioEnv && firebaseConfig.firestoreDatabaseId ? firebaseConfig.firestoreDatabaseId : '(default)'
}`);

export { app, auth, db, storage };
export default app;
