import { describe, expect, it } from 'vitest'
import type { WorkOrderRecord } from './queue'
import { isOverdueOrder, matchesOrderFilters, needsActionForRole, workOrderServerWhere } from './queue'
import type { WorkOrder } from './types'

const record = (data: Partial<WorkOrder>): WorkOrderRecord => ({
  recordId: 'wo-1048',
  data: {
    assetId: 'asset-pump',
    title: 'Cooling loop pressure drop',
    description: 'A visible leak needs inspection.',
    maintenanceType: 'corrective',
    priority: 'high',
    status: 'reported',
    reportedByUserId: 'operator-1',
    assignedToUserId: '',
    dueAt: '',
    blockReason: '',
    workSummary: '',
    checklist: [],
    version: 1,
    auditTrail: [],
    startedAt: '',
    submittedAt: '',
    completedAt: '',
    approvedByUserId: '',
    cancelledAt: '',
    ...data,
  },
  createdBy: 'operator-1',
  createdAt: '2026-11-23T15:00:00.000Z',
  updatedAt: '2026-11-23T15:00:00.000Z',
})

describe('MaintenanceFlow action queue', () => {
  it('prioritizes the records that belong to each business role', () => {
    const reported = record({ reportedByUserId: 'operator-1' })
    const assigned = record({ status: 'in_progress', assignedToUserId: 'tech-1' })
    const review = record({ status: 'awaiting_review', assignedToUserId: 'tech-1' })

    expect(needsActionForRole(reported, 'operator', 'operator-1')).toBe(true)
    expect(needsActionForRole(assigned, 'technician', 'tech-1')).toBe(true)
    expect(needsActionForRole(review, 'technician', 'tech-1')).toBe(false)
    expect(needsActionForRole(review, 'supervisor', 'supervisor-1')).toBe(true)
  })

  it('refreshes overdue state from the supplied clock and excludes terminal orders', () => {
    const overdue = record({ dueAt: '2026-11-23T14:00:00.000Z' })
    const completed = record({ status: 'completed', dueAt: '2026-11-23T14:00:00.000Z' })
    const now = Date.parse('2026-11-23T15:00:00.000Z')

    expect(isOverdueOrder(overdue, now)).toBe(true)
    expect(isOverdueOrder(completed, now)).toBe(false)
  })

  it('matches search, priority and technician filters together', () => {
    const order = record({ priority: 'critical', assignedToUserId: 'tech-1' })

    expect(matchesOrderFilters(order, { search: 'pressure', status: 'all', priority: 'critical', technician: 'tech-1' }, 'PUMP-003')).toBe(true)
    expect(matchesOrderFilters(order, { search: 'pressure', status: 'all', priority: 'high', technician: 'tech-1' }, 'PUMP-003')).toBe(false)
  })

  it('keeps the server queue closed until the current business role is known', () => {
    const filters = { status: 'all' as const, priority: 'all' as const, technician: 'all' as const }

    expect(workOrderServerWhere(filters, { userId: 'tech-1' })).toEqual({ status: '__profile_pending__' })
    expect(workOrderServerWhere(filters, { role: 'technician', userId: 'tech-1' })).toEqual({ assignedToUserId: 'tech-1' })
    expect(workOrderServerWhere({ ...filters, technician: 'tech-2' }, { role: 'technician', userId: 'tech-1' })).toEqual({ status: '__outside_role_queue__' })
  })

  it('pushes exact list filters into the DeepSpace server query', () => {
    expect(workOrderServerWhere({ status: 'blocked', priority: 'high', technician: 'tech-1' })).toEqual({
      status: 'blocked',
      priority: 'high',
      assignedToUserId: 'tech-1',
    })
  })
})
