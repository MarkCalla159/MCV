/**
 * Navigation Config
 *
 * Add one entry per nav item. Routes are handled by generouted
 * (file-based routing in src/pages/), this just controls what
 * appears in the navigation bar.
 */

import type { Role } from './constants'
import type { LucideIcon } from 'lucide-react'
import { Boxes, ClipboardList, LayoutDashboard, UsersRound } from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  roles?: Role[]
  devOnly?: boolean
}

export const nav: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/work-orders', label: 'Work orders', icon: ClipboardList },
  { path: '/assets', label: 'Assets', icon: Boxes },
  { path: '/team', label: 'Team', icon: UsersRound },
  // The /api-status debug page still exists — add
  // `{ path: '/api-status', label: 'API Status', devOnly: true }` to surface it.
  // ── Features add nav items below this line ──
]
