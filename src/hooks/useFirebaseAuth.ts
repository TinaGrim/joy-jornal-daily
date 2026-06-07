import { useState, useEffect, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
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
  signInWithGoogle: () => Promise<void>
  signInAnonymously: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  isAuthenticated: boolean
}

export function useFirebaseAuth(): UseFirebaseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseReady || !auth) {
      console.warn('[useFirebaseAuth] Firebase not initialized — auth disabled')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- early return guard
      setLoading(false)
      return
    }

    // Capture redirect result after Google sign-in
    getRedirectResult(auth).catch((err) => {
      console.warn('[useFirebaseAuth] getRedirectResult failed:', err.message)
    })

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseReady || !auth) {
      console.warn('[useFirebaseAuth] Firebase not initialized')
      return
    }
    const provider = new GoogleAuthProvider()
    await signInWithRedirect(auth, provider)
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
    signInWithGoogle,
    signInAnonymously,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    isAuthenticated: !!user,
  }
}
