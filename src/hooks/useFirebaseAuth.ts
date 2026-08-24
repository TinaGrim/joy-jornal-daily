import { useState, useEffect, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInAnonymously as firebaseSignInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { auth, isFirebaseReady } from '@/lib/firebase'

export interface UseFirebaseAuthReturn {
  user: User | null
  loading: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signInAnonymously: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  isAuthenticated: boolean
}

export function friendlyAuthError(err: unknown): string {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : ''
  switch (code) {
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'Google sign-in is not enabled for this Firebase project. Open Firebase Console → Authentication → Sign-in method → enable Google.'
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Console (Authentication → Settings → Authorized domains).'
    case 'auth/configuration-not-found':
      return 'Google sign-in is not configured for this project. Enable it in Firebase Console → Authentication → Sign-in method → Google.'
    case 'auth/web-storage-unsupported':
    case 'auth/browser-popup-blocked':
      return 'This browser blocks sign-in storage/cookies. Try another browser or allow cookies for this site.'
    case 'auth/network-request-failed':
      return 'Network error while completing sign-in. Check your connection and try again.'
    default: {
      const msg = err instanceof Error ? err.message : String(err)
      return code ? `${code}: ${msg}` : msg
    }
  }
}

export function useFirebaseAuth(): UseFirebaseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isFirebaseReady || !auth) {
      console.warn('[useFirebaseAuth] Firebase not initialized — auth disabled')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- early return guard
      setLoading(false)
      return
    }

    // Complete Google sign-in after the redirect back from accounts.google.com.
    // Errors here used to be swallowed silently — surface them to the UI.
    getRedirectResult(auth)
      .then(result => {
        console.log('[useFirebaseAuth] redirect result:', result?.user?.uid ?? 'none')
      })
      .catch(err => {
        console.warn('[useFirebaseAuth] getRedirectResult failed:', err?.code, err?.message)
        setError(friendlyAuthError(err))
      })

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })

    // Pin local persistence so the pending-redirect flag and the signed-in
    // user survive reloads on mobile browsers that like to evict storage.
    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.warn('[useFirebaseAuth] setPersistence failed:', err?.code)
    })

    return unsubscribe
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseReady || !auth) {
      console.warn('[useFirebaseAuth] Firebase not initialized')
      return
    }
    const provider = new GoogleAuthProvider()
    try {
      // Popup first: the result comes straight back to this page (no full
      // reload), and any failure is catchable right here.
      await signInWithPopup(auth, provider)
    } catch (err) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : ''
      // Popup unavailable (mobile browsers, embedded webviews): fall back to
      // the redirect flow; completion is handled by getRedirectResult above.
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider)
        return
      }
      if (code === 'auth/cancelled-popup-request') return
      throw err
    }
  }, [])

  const signInAnonymously = useCallback(async () => {
    if (!isFirebaseReady || !auth) {
      console.warn('[useFirebaseAuth] Firebase not initialized')
      return
    }
    await firebaseSignInAnonymously(auth)
  }, [])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!isFirebaseReady || !auth) {
      console.warn('[useFirebaseAuth] Firebase not initialized')
      return
    }
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    if (!isFirebaseReady || !auth) {
      console.warn('[useFirebaseAuth] Firebase not initialized')
      return
    }
    await createUserWithEmailAndPassword(auth, email, password)
  }, [])

  const signOut = useCallback(async () => {
    if (!isFirebaseReady || !auth) {
      console.warn('[useFirebaseAuth] Firebase not initialized')
      return
    }
    await firebaseSignOut(auth)
  }, [])

  return {
    user,
    loading,
    error,
    signInWithGoogle,
    signInAnonymously,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    isAuthenticated: !!user,
  }
}
