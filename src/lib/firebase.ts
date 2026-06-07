import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getDatabase, type Database } from 'firebase/database'
import { getAuth, type Auth } from 'firebase/auth'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let app: FirebaseApp | undefined
let rtdb: Database | undefined
let auth: Auth | undefined
let storage: FirebaseStorage | undefined
let isFirebaseReady = false

try {
  app = initializeApp(firebaseConfig)
  rtdb = getDatabase(app)
  auth = getAuth(app)
  storage = getStorage(app)
  isFirebaseReady = true
} catch (error) {
  console.warn('[Firebase] Failed to initialize Firebase:', error)
  console.warn('[Firebase] Set VITE_FIREBASE_* environment variables in .env.local')
}

export { app, rtdb, auth, storage, isFirebaseReady }
