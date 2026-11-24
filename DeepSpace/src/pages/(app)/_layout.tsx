/**
 * Dynamic app boundary — the auth + realtime data layer.
 *
 * `(app)` is a Generouted route group: the parentheses mean it does NOT appear
 * in the URL, so (app)/home.tsx is served at /home. Every page under this
 * folder is wrapped in the DeepSpace providers below, so it may call `useAuth`,
 * `useQuery`, `useMutations`, presence/Yjs hooks, etc.
 *
 * Pages OUTSIDE this folder (top level of src/pages/) get none of this — they
 * render as static pages with no auth fetch and no records WebSocket. Move a
 * page in or out of (app)/ to flip it between dynamic and static. Require
 * sign-in on top of the data layer by nesting under (app)/(protected)/.
 *
 * This is where the app chrome (Navigation) lives, so static pages can present
 * their own layout without inheriting it.
 */

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { AuthGate, AuthOverlay, DeepSpaceAuthProvider, useAuthProfileReady, useAuthStatus } from 'deepspace'
import { RecordProvider, RecordScope, AgentTools } from 'deepspace'
import Navigation from '../../components/Navigation'
import { PageSkeleton } from '../../components/PageSkeleton'
import { useToast } from '@/components/ui'
import { APP_NAME, SCOPE_ID } from '../../constants'
import { schemas } from '../../schemas'
import { callMaintenanceAction } from '../../lib/maintenance-actions'

export default function AppLayout() {
  return (
    <DeepSpaceAuthProvider>
      {/* The prerendered landing owns the document <title> and React drops it
          when <Seo> unmounts, so every route without <Seo> sets its own. */}
      <title>{APP_NAME}</title>
      <AuthBoot>
        <div data-testid="app-navigation" className="app-shell">
          <a className="skip-link" href="#main-content">Skip to main content</a>
          <Navigation />
          <main id="main-content" className="app-main" tabIndex={-1}>
            <div className="app-content">
              <Suspense fallback={<PageSkeleton />}>
                  <AuthGate fallback={<SignedOutPanel />}>
                    <Outlet />
                  </AuthGate>
              </Suspense>
            </div>
          </main>
        </div>
      </AuthBoot>
    </DeepSpaceAuthProvider>
  )
}

function SignedOutPanel() {
  const [showAuthModal, setShowAuthModal] = useState(false)

  return (
    <section className="signed-out-panel" aria-labelledby="signed-out-heading">
      <p className="eyebrow">Workspace access</p>
      <h1 id="signed-out-heading">Sign in to continue</h1>
      <p>This maintenance workspace is available to signed-in team members.</p>
      <button className="button button-primary" onClick={() => setShowAuthModal(true)}>
        Sign in
      </button>
      <Link to="/" className="signed-out-back">Back to home</Link>
      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
    </section>
  )
}

/**
 * Waits for auth to resolve, then mounts the data layer. Distinct from the SDK's `AuthGate`.
 *
 * While the initial session check is in flight, renders a fixed full-viewport
 * panel in the theme background — visually identical to the pre-JS page
 * (index.html primes <html> with the same color), so a cold load shows a
 * steady theme-colored screen until the shell appears. The hidden status text
 * gives assistive technology a useful session-loading state without a visual jump.
 */
function AuthBoot({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuthStatus()
  // Record writes (`create`/`put`/`remove`) are fire-and-forget — they resolve
  // before the server answers, so a denied or invalid write only surfaces
  // through onWriteError. Route rejections to toasts so they're never a
  // silent no-op. Keep this wiring when customizing the layout.
  const { error, warning } = useToast()

  if (!isLoaded) {
    return <div role="status" aria-busy="true" className="fixed inset-0 bg-background"><span className="sr-only">Checking your session</span></div>
  }

  return (
    <RecordProvider
      allowAnonymous
      onWriteError={(e) =>
        e.kind === 'permission' ? warning(e.title, e.detail) : error(e.title, e.detail)
      }
    >
      <RecordScope roomId={SCOPE_ID} schemas={schemas}>
        <AgentTools />
        <ProfileBootstrap />
        {children}
      </RecordScope>
    </RecordProvider>
  )
}

function ProfileBootstrap() {
  const { isSignedIn, user } = useAuthProfileReady({ requireUser: true })
  useEffect(() => {
    if (!isSignedIn || !user?.id) return
    void callMaintenanceAction('ensureMyProfile', { displayName: user.name ?? user.email?.split('@')[0] ?? 'Maintenance operator' }).catch(() => undefined)
  }, [isSignedIn, user?.id, user?.name, user?.email])
  return null
}
