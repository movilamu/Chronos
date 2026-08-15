import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { App as CapApp } from '@capacitor/app'

const AuthContext = createContext(null)

const isNative = Capacitor.isNativePlatform()
// Custom URL scheme registered in AndroidManifest.xml (chronos://login-callback)
const NATIVE_REDIRECT_URL = 'chronos://login-callback'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Native only: catch the OS handing our app the chronos://login-callback
  // link after Google auth finishes in the in-app browser, close the
  // browser tab, and let Supabase parse the tokens out of the URL.
  useEffect(() => {
    if (!isNative) return

    const listenerPromise = CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(NATIVE_REDIRECT_URL)) return
      try {
        await Browser.close()
      } catch {
        // browser may already be closed, ignore
      }
      try {
        // Supabase JS v2: parses access_token/refresh_token (or code) from the URL
        // and establishes the session.
        const { data, error } = await supabase.auth.exchangeCodeForSession(url)
        if (!error && data?.session) {
          setSession(data.session)
        } else {
          // Fallback for implicit-flow style tokens in the URL fragment
          const hash = url.split('#')[1]
          if (hash) {
            const params = new URLSearchParams(hash)
            const access_token = params.get('access_token')
            const refresh_token = params.get('refresh_token')
            if (access_token && refresh_token) {
              const { data: setData } = await supabase.auth.setSession({ access_token, refresh_token })
              if (setData?.session) setSession(setData.session)
            }
          }
        }
      } catch (e) {
        console.error('Auth callback error:', e)
      }
    })

    return () => {
      listenerPromise.then((l) => l.remove())
    }
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [session])

  const signInWithGoogle = async () => {
    if (isNative) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: NATIVE_REDIRECT_URL,
          skipBrowserRedirect: true,
        },
      })
      if (!error && data?.url) {
        await Browser.open({ url: data.url })
      }
      return
    }

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, loading, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
