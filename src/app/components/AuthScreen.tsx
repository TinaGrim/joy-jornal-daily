import { useJournal } from '../contexts/JournalContext'
import { useTheme } from '../contexts/ThemeContext'

export default function AuthScreen() {
  const { authLoading, authError, signInWithGoogle, signInAnonymously } = useJournal()
  const { theme } = useTheme()
  const isDark = theme === 'night'

  return (
    <div className={`h-dvh w-full flex items-center justify-center overflow-hidden relative ${isDark ? 'bg-[#11111b]' : 'bg-[#e5d9bf]'}`}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100\' height=\'100\' filter=\'url(%23noise)\' opacity=\'0.5\'/%3E%3C/svg%3E")',
        }}
      />

      <div className="relative flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className={`font-display text-5xl mb-2 ${isDark ? 'text-[#cdd6f4]' : 'text-ink-navy'}`}>Joy Journey Daily</h1>
          <p className={`font-handwriting text-xl ${isDark ? 'text-[#a6adc8]' : 'text-warm-brown'}`}>Sign in to continue your journal</p>
        </div>

        <div className={`w-80 rounded-2xl shadow-xl border p-8 ${isDark ? 'bg-[#1e1e2e] border-[#313244]' : 'bg-paper border-border-light'}`}>
          {authError && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-handwriting leading-relaxed">
              {authError}
            </div>
          )}

          <button
            onClick={signInWithGoogle}
            disabled={authLoading}
            className={`w-full flex items-center justify-center gap-3 px-6 py-3 border-2 rounded-xl transition-all disabled:opacity-50 cursor-pointer ${isDark ? 'bg-[#313244] border-[#45475a] text-[#cdd6f4] hover:border-terracotta hover:text-terracotta' : 'bg-white border-border-light text-warm-brown hover:border-terracotta hover:text-terracotta'}`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span className="font-handwriting text-base">
              {authLoading ? 'Signing in...' : 'Sign in with Google'}
            </span>
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${isDark ? 'border-[#45475a]' : 'border-border-light'}`} />
            </div>
            <div className="relative flex justify-center">
              <span className={`px-3 text-xs font-handwriting ${isDark ? 'bg-[#1e1e2e] text-[#6c7086]' : 'bg-paper text-text-muted'}`}>or</span>
            </div>
          </div>

          <button
            onClick={signInAnonymously}
            disabled={authLoading}
            className={`w-full px-6 py-2.5 border rounded-xl transition-all disabled:opacity-50 cursor-pointer font-handwriting text-sm ${isDark ? 'border-[#45475a] text-[#a6adc8] hover:border-sage hover:text-sage' : 'border-border-light text-warm-brown hover:border-sage hover:text-sage'}`}
          >
            Continue without account
          </button>

          <p className={`mt-6 text-xs text-center font-handwriting ${isDark ? 'text-[#6c7086]' : 'text-text-muted'}`}>
            Your journal is private and secure.
          </p>
        </div>
      </div>
    </div>
  )
}
