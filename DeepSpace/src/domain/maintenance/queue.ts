import type { RecordData } from 'deepspace'
import type { BusinessRole, OrderStatus, Priority, WorkOrder } from './types'

export const statusLabels: Record<OrderStatus, string> = {
  reported: 'Reported',
  assigned: 'Assigned',
  in_progress: 'In progress',
  blocked: 'Blocked',
  awaiting_review: 'Awaiting review',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const priorityLabels: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export type OrderFilters = {
  search: string
  status: 'all' | OrderStatus
  priority: 'all' | Priority
  technician: 'all' | string
}

export type WorkOrderRecord = RecordData<WorkOrder>

export const WORK_ORDER_QUERY_LIMIT = 200

export function workOrderServerWhere(
  filters: Pick<OrderFilters, 'status' | 'priority' | 'technician'>,
  scope?: { role?: BusinessRole; userId?: string },
) {
  const where: Record<string, unknown> = {}

  if (scope) {
    if (!scope.role || !scope.userId) return { status: '__profile_pending__' }
    if (scope.role === 'operator') where.reportedByUserId = scope.userId
    if (scope.role === 'technician') where.assignedToUserId = scope.userId
  }

  if (filters.status !== 'all') where.status = filters.status
  if (filters.priority !== 'all') where.priority = filters.priority

  if (filters.technician !== 'all') {
    if (scope?.role === 'technician' && filters.technician !== scope.userId) {
      return { status: '__outside_role_queue__' }
    }
    where.assignedToUserId = filters.technician
  }

  return where
}

export function isTerminalOrder(order: WorkOrderRecord) {
  return order.data.status === 'completed' || order.data.status === 'cancelled'
}

export function isOverdueOrder(order: WorkOrderRecord, now = Date.now()) {
  return Boolean(order.data.dueAt && Date.parse(order.data.dueAt) < now && !isTerminalOrder(order))
}

/**
 * Presentation-only queue rules. Server actions remain the authority for every
 * transition; this function only decides which records deserve attention first.
 */
export function needsActionForRole(order: WorkOrderRecord, role: BusinessRole, userId: string, now = Date.now()) {
  if (isTerminalOrder(order)) return false

  if (role === 'operator') {
    return order.data.reportedByUserId === userId
  }

  if (role === 'technician') {
    return order.data.assignedToUserId === userId && ['assigned', 'in_progress', 'blocked'].includes(order.data.status)
  }

  return ['reported', 'awaiting_review', 'blocked'].includes(order.data.status) || isOverdueOrder(order, now)
}

export function matchesOrderFilters(order: WorkOrderRecord, filters: OrderFilters, assetCode: string) {
  const query = filters.search.trim().toLowerCase()
  const haystack = `${order.recordId} ${order.data.title} ${assetCode} ${order.data.description}`.toLowerCase()

  return (
    (filters.status === 'all' || order.data.status === filters.status) &&
    (filters.priority === 'all' || order.data.priority === filters.priority) &&
    (filters.technician === 'all' || order.data.assignedToUserId === filters.technician) &&
    haystack.includes(query)
  )
}

export function businessRoleLabel(role?: BusinessRole) {
  if (!role) return 'Workspace member'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function queueLabel(role?: BusinessRole, profileReady = true) {
  if (!profileReady) return 'Preparing your queue'
  if (role === 'operator') return 'Your open requests'
  if (role === 'technician') return 'Assigned to you'
  if (role === 'supervisor') return 'Needs your action'
  return 'Workspace queue'
}
