/**
 * Landing page — a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 * That makes it cheap to serve and safe for logged-out / crawler traffic.
 *
 * Need live data or auth here? Move this file to src/pages/(app)/index.tsx
 * and it becomes a dynamic page. Conversely, any page you want to keep static
 * (marketing, docs, legal) belongs at this top level.
 *
 * Top-level pages are also prerendered to static HTML at build
 * (prerender.ts, via vite.config.ts) so crawlers read real content.
 * Keep them renderable without a browser: no window/document during render,
 * prose in HTML text, reveal animations in CSS keyframes rather than JS-driven
 * initial states. `<Seo>` comes first and reads src/seo.ts.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { APP_NAME } from '../constants'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <main data-testid="static-landing" className="landing-shell">
        <div className="landing-mark" aria-hidden="true"><span /></div>
        <p className="landing-kicker">Maintenance operations workspace</p>
        <h1>Keep every repair moving toward a verified close.</h1>
        <p className="landing-copy">
          Report equipment issues, assign the work, document the repair, and approve completion in one shared workspace.
        </p>
        <div className="landing-actions">
          <Link to="/dashboard" className="button button-primary">Open the workspace</Link>
          <span className="landing-note">Shared demo workspace. Use sample data only.</span>
        </div>
      </main>
    </>
  )
}
