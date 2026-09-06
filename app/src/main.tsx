import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import {
  completeOAuthRedirect,
  handleOAuthPopupCallback,
  isOAuthCallbackLocation,
  prefetchGoogleLogin,
  prefetchMicrosoftLogin,
} from './utils/cloud/oauth'
import { loadOAuthAppConfig } from './utils/cloud/oauthConfig'

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'Segoe UI, sans-serif', color: '#0f172a' }}>
          <h1 style={{ fontSize: 18 }}>The app failed to load</h1>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#b91c1c' }}>
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
          </pre>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

void startApp()

async function startApp() {
  if (isOAuthCallbackLocation()) {
    try {
      if (handleOAuthPopupCallback()) {
        document.body.innerHTML =
          '<p style="font-family:sans-serif;padding:24px;color:#334155">Signed in. You can close this window.</p>'
        return
      }
      if (await completeOAuthRedirect()) {
        window.location.replace('/')
        return
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed'
      document.body.innerHTML = `<p style="font-family:sans-serif;padding:24px;color:#b91c1c">${message}</p>`
      return
    }
  }

  void loadOAuthAppConfig().then((config) => {
    if (config.microsoftClientId) void prefetchMicrosoftLogin(config.microsoftClientId)
    if (config.googleClientId) void prefetchGoogleLogin(config.googleClientId)
  })
  const root = document.getElementById('root')
  if (root) {
    createRoot(root).render(
      <StrictMode>
        <RootErrorBoundary>
          <App />
        </RootErrorBoundary>
      </StrictMode>,
    )
  }
}