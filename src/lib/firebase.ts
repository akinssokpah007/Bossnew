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
// If a custom named database ID is provided in the configuration (such as in AI Studio),
// we use it in all environments (including production deployments like Vercel)
// to ensure perfect global consistency and avoid falling back to an empty default instance.
const db = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

const storage = getStorage(app);

console.log(`[Firebase] Initialized with Project ID: ${config.projectId}. Database: ${
  config.firestoreDatabaseId ? config.firestoreDatabaseId : '(default)'
}`);

export { app, auth, db, storage };
export default app;
