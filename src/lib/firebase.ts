import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const config = firebaseConfig as any;

const app = initializeApp(config);
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
const db = isAiStudioEnv && config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

const storage = getStorage(app);

console.log(`[Firebase] Initialized with Project ID: ${config.projectId}. Database: ${
  isAiStudioEnv && config.firestoreDatabaseId ? config.firestoreDatabaseId : '(default)'
}`);

export { app, auth, db, storage };
export default app;
