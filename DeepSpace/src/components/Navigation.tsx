/**
 * Top nav — minimal placeholder bar wired to the app's mechanisms:
 * nav.ts-driven links (with role/dev filtering), sign-in via <AuthOverlay>,
 * and sign-out. Restyle or rebuild it freely; keep the data-testid hooks
 * (`app-navigation`, `nav-sign-in-button`, `nav-user-name`, `nav-user-email`)
 * — the shipped tests rely on them. `nav-user-email` is the one that carries
 * an identity the test can check exactly: a display name is optional, the
 * email is the credential the session was opened with.
 */

import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthOverlay, useAuthProfileReady, useQuery, signOut } from 'deepspace'
import { ChevronDown, LogOut, Menu, X } from 'lucide-react'
import { APP_NAME } from '../constants'
import type { Role } from '../constants'
import { nav } from '../nav'
import { cn } from '../lib/utils'
import { businessRoleLabel } from '../domain/maintenance/queue'
import type { StaffProfile } from '../domain/maintenance/types'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui'

export default function Navigation() {
  const { isLoaded, isSignedIn, user, userLoading } = useAuthProfileReady({ requireUser: true })
  const { records: profiles } = useQuery<StaffProfile>('staff_profiles', { limit: 100 })
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const mobileMenuRef = useRef<HTMLDialogElement>(null)
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileMenuCloseRef = useRef<HTMLButtonElement>(null)

  const profileReady = !isSignedIn || (!userLoading && !!user)
  const userRole = (user?.role ?? 'anonymous') as Role | 'anonymous'

  // Close the mobile menu when navigating
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const dialog = mobileMenuRef.current
    if (!dialog) return

    if (mobileMenuOpen && !dialog.open) {
      dialog.showModal()
      requestAnimationFrame(() => mobileMenuCloseRef.current?.focus())
      return
    }

    if (!mobileMenuOpen && dialog.open) dialog.close()
  }, [mobileMenuOpen])

  const visibleNav = nav.filter((item) => {
    if (item.devOnly && !import.meta.env.DEV) return false
    if (!item.roles) return true
    if (!profileReady) return false
    if (userRole === 'admin') return true
    return item.roles.includes(userRole as Role)
  })

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
    mobileMenuTriggerRef.current?.focus()
  }

  const navLink = (item: (typeof nav)[number], mobile = false) => {
    const active = location.pathname.startsWith(item.path)
    const Icon = item.icon
    return (
      <Link
        key={item.path}
        to={item.path}
        aria-current={active ? 'page' : undefined}
        onClick={mobile ? closeMobileMenu : undefined}
        style={mobile ? ({ '--menu-index': nav.indexOf(item) } as CSSProperties) : undefined}
        className={cn(
          mobile ? 'mobile-menu-link' : 'sidebar-link',
          active && (mobile ? 'is-active' : 'is-active'),
        )}
      >
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <>
      <aside className="app-sidebar" aria-label="Primary navigation">
        <Link to="/dashboard" className="sidebar-brand" aria-label={`${APP_NAME} dashboard`}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>
            <strong>{APP_NAME}</strong>
            <small>Maintenance operations</small>
          </span>
        </Link>

        <nav className="sidebar-nav" aria-label="Workspace">
          {visibleNav.map((item) => navLink(item))}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-footer-label">Workspace</p>
          <AccountControl
            isLoaded={isLoaded}
            isSignedIn={isSignedIn}
            profileReady={profileReady}
            user={user}
            businessRole={profiles.find((record) => record.recordId === user?.id)?.data.businessRole}
            onSignIn={() => setShowAuthModal(true)}
            testIds
          />
        </div>
      </aside>

      <header className="app-mobile-bar">
        <Link to="/dashboard" className="mobile-brand" aria-label={`${APP_NAME} dashboard`}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <strong>{APP_NAME}</strong>
        </Link>
        <button
          ref={mobileMenuTriggerRef}
          className="mobile-menu-trigger"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
        >
          <Menu aria-hidden="true" />
        </button>
      </header>

      <dialog
        ref={mobileMenuRef}
        id="mobile-navigation"
        className="mobile-menu-dialog"
        aria-label="Mobile navigation"
        onClose={() => {
          setMobileMenuOpen(false)
          mobileMenuTriggerRef.current?.focus()
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMobileMenu()
        }}
      >
        <div className="mobile-menu-panel">
          <div className="mobile-menu-header">
            <span className="mobile-menu-kicker">Workspace</span>
            <button ref={mobileMenuCloseRef} className="mobile-menu-close" onClick={closeMobileMenu} aria-label="Close navigation menu">
              <X aria-hidden="true" />
            </button>
          </div>
          <nav className="mobile-menu-nav" aria-label="Mobile workspace navigation">
            {visibleNav.map((item) => navLink(item, true))}
          </nav>
          <div className="mobile-menu-account">
            <AccountControl
              isLoaded={isLoaded}
              isSignedIn={isSignedIn}
              profileReady={profileReady}
              user={user}
              businessRole={profiles.find((record) => record.recordId === user?.id)?.data.businessRole}
              onSignIn={() => { closeMobileMenu(); setShowAuthModal(true) }}
            />
          </div>
        </div>
      </dialog>

      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
    </>
  )
}

type AuthUser = ReturnType<typeof useAuthProfileReady>['user']

function AccountControl({
  isLoaded,
  isSignedIn,
  profileReady,
  user,
  businessRole,
  onSignIn,
  testIds = false,
}: {
  isLoaded: boolean
  isSignedIn: boolean
  profileReady: boolean
  user: AuthUser
  businessRole: StaffProfile['businessRole'] | undefined
  onSignIn: () => void
  testIds?: boolean
}) {
  if (!isLoaded) return null

  if (isSignedIn && !profileReady) {
    return (
      <div className="account-loading" role="status">
        <span className="sr-only">Loading account</span>
        <span className="skeleton skeleton-avatar" aria-hidden="true" />
        <span className="skeleton skeleton-account-name" aria-hidden="true" />
      </div>
    )
  }

  if (isSignedIn && user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button aria-label="Account menu" className="account-trigger">
              <Avatar className="account-avatar">
                <AvatarImage src={user.imageUrl ?? undefined} referrerPolicy="no-referrer" />
                <AvatarFallback>{(user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="account-copy">
                <span data-testid={testIds ? 'nav-user-name' : undefined} className="account-name">{user.name || user.email}</span>
                <span className="account-role">{businessRoleLabel(businessRole)}</span>
              </span>
              <ChevronDown className="account-chevron" aria-hidden="true" />
            </button>
          }
        />
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>
            <div className="truncate font-medium text-foreground">{user.name || 'Signed in'}</div>
            <div data-testid={testIds ? 'nav-user-email' : undefined} className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <button data-testid={testIds ? 'nav-sign-in-button' : undefined} onClick={onSignIn} className="sidebar-sign-in">
      Sign in to workspace
    </button>
  )
}
