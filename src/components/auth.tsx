'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface AuthContextType {
  openAuth: (mode?: 'login' | 'signup') => void
}

const AuthContext = createContext<AuthContextType>({
  openAuth: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'login' | 'signup' | null>(null)

  const openAuth = (newMode: 'login' | 'signup' = 'signup') => {
    setMode(newMode)
  }

  return (
    <AuthContext.Provider value={{ openAuth }}>
      {children}
      {/* Auth modal would go here - placeholder for now */}
      {mode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#141414] p-6 rounded-lg max-w-md w-full">
            <h2 className="text-white text-xl font-semibold mb-4">
              {mode === 'signup' ? 'Sign Up' : 'Sign In'}
            </h2>
            <p className="text-[#a3a3a3] text-sm">
              Auth functionality disabled in MVP demo.
            </p>
            <button
              onClick={() => setMode(null)}
              className="mt-4 px-4 py-2 bg-white/10 text-white rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}
