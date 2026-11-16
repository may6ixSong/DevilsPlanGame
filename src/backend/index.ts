import { createFirebaseBackend } from './firebaseBackend';
import { createLocalBackend } from './localBackend';
import type { Backend } from './types';

const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const forceLocal = new URLSearchParams(location.search).get('backend') === 'local';
const hasFirebase = !!(firebaseConfig.apiKey && firebaseConfig.databaseURL);

export const backend: Backend = !forceLocal && hasFirebase
  ? createFirebaseBackend(firebaseConfig)
  : createLocalBackend();

export * from './types';
