import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { Asset, AuditEvent, BusinessRole, ChecklistItem, OrderComment, OperationReceipt, Priority, StaffProfile, WorkOrder } from '../domain/maintenance/types'
import { assetCategories, businessRoles, checklist, enumValue, fail, integer, isoDateOrEmpty, isFailure, optionalText, priorities, stableStringify, text, textRange } from '../domain/maintenance/validation'

type Data = Record<string, unknown>
type Result = ActionResult<Data>
type Envelope<T> = { recordId: string; data: T }

const now = () => new Date().toISOString()
const OPERATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const ok = (data: Data = {}): Result => ({ success: true, data })
const errorResult = (value: unknown): Result => ({ success: false, error: value instanceof Error ? value.message : String(value) })

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)
}

async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(value))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function operation(tools: ActionTools, userId: string, commandName: string, params: Data): Promise<{ operationId: string; fingerprint: string; replayed?: string } | { failure: Result }> {
  const operationId = text(params.operationId, 'operationId', 100)
  if (typeof operationId !== 'string') return { failure: operationId }
  const fingerprint = await digest({ commandName, params: { ...params, operationId: undefined } })
  const existing = await tools.query<OperationReceipt>('operation_receipts', { where: { actorUserId: userId, operationId }, limit: 1 })
  if (!existing.success) return { failure: errorResult(existing) }
  const receipt = existing.data.records[0]
  if (receipt) {
    if (Date.parse(receipt.data.createdAt) > 0 && Date.now() - Date.parse(receipt.data.createdAt) > OPERATION_RETENTION_MS) {
      const removed = await tools.remove('operation_receipts', receipt.recordId)
      if (!removed.success) return { failure: errorResult(removed) }
    } else {
      if (receipt.data.fingerprint !== fingerprint) return { failure: fail('operation_conflict', 'operationId was already used with different content') }
      return { operationId, fingerprint, replayed: receipt.data.resultRef }
    }
  }
  return { operationId, fingerprint }
}

async function saveOperation(tools: ActionTools, userId: string, commandName: string, operationId: string, fingerprint: string, resultRef: string): Promise<Result | null> {
  const recordId = `receipt_${safeId(userId)}_${safeId(operationId)}`
  const saved = await tools.create<OperationReceipt>('operation_receipts', { actorUserId: userId, operationId, commandName, fingerprint, resultRef, createdAt: now() }, recordId)
  if (saved.success) return null
  const existing = await tools.get<OperationReceipt>('operation_receipts', recordId)
  if (existing.success && existing.data.record.data.fingerprint === fingerprint && existing.data.record.data.resultRef === resultRef) return null
  return errorResult(saved)
}

async function getProfile(tools: ActionTools, userId: string): Promise<Envelope<StaffProfile> | null | Result> {
  const result = await tools.get<StaffProfile>('staff_profiles', userId)
  if (result.success) return result.data.record
  if (result.error.includes('not found') || result.error.includes('NOT_FOUND')) return null
  return errorResult(result)
}

async function requireProfile(tools: ActionTools, userId: string): Promise<Envelope<StaffProfile> | Result> {
  const profile = await getProfile(tools, userId)
  if (!profile) return fail('forbidden', 'complete your staff profile first')
  if ('success' in profile) return profile
  if (profile.data.isDemo) return fail('forbidden', 'demo profiles cannot perform actions')
  return profile
}

async function countUserRecords(tools: ActionTools, collection: string, where: Data, limit: number): Promise<number | Result> {
  const result = Object.keys(where).length > 0 ? await tools.query(collection, { where, limit }) : await tools.query(collection, { limit })
  return result.success ? result.data.count : errorResult(result)
}

async function enforceQuota(tools: ActionTools, collection: string, where: Data, limit: number, message: string): Promise<Result | null> {
  const count = await countUserRecords(tools, collection, where, limit)
  if (typeof count !== 'number') return count
  return count >= limit ? fail('quota_exceeded', message) : null
}

async function enforceRecentQuota(tools: ActionTools, collection: string, where: Data, timeField: string, windowMs: number, limit: number, message: string): Promise<Result | null> {
  const result = await tools.query(collection, { where, limit: Math.max(limit * 2, 100) })
  if (!result.success) return errorResult(result)
  const cutoff = Date.now() - windowMs
  const recent = result.data.records.filter((record) => {
    const value = (record.data as Record<string, unknown>)[timeField]
    return typeof value === 'string' && Date.parse(value) >= cutoff
  }).length
  return recent >= limit ? fail('quota_exceeded', message) : null
}

async function enforceOpenOrderQuota(tools: ActionTools, userId: string): Promise<Result | null> {
  const result = await tools.query<WorkOrder>('work_orders', { where: { reportedByUserId: userId }, limit: 50 })
  if (!result.success) return errorResult(result)
  const open = result.data.records.filter((record) => !['completed', 'cancelled'].includes(record.data.status)).length
  return open >= 10 ? fail('quota_exceeded', 'you can have at most 10 open reported orders') : null
}

function requireRole(profile: Envelope<StaffProfile>, roles: readonly BusinessRole[]): Result | null {
  return roles.includes(profile.data.businessRole) ? null : fail('forbidden', `requires ${roles.join(' or ')} role`)
}

async function getAsset(tools: ActionTools, assetId: string): Promise<Envelope<Asset> | Result | null> {
  const result = await tools.get<Asset>('assets', assetId)
  if (result.success) return result.data.record
  if (result.error.includes('not found') || result.error.includes('NOT_FOUND')) return null
  return errorResult(result)
}

async function getOrder(tools: ActionTools, workOrderId: string): Promise<Envelope<WorkOrder> | Result | null> {
  const result = await tools.get<WorkOrder>('work_orders', workOrderId)
  if (result.success) return result.data.record
  if (result.error.includes('not found') || result.error.includes('NOT_FOUND')) return null
  return errorResult(result)
}

function commandVersion(params: Data): number | Result {
  const version = integer(params.expectedVersion, 'expectedVersion', 1)
  return version
}

function event(actorUserId: string, operationId: string, kind: string, fromStatus?: WorkOrder['status'], toStatus?: WorkOrder['status'], reason?: string): AuditEvent {
  return { id: crypto.randomUUID(), operationId, actorUserId, occurredAt: now(), kind, ...(fromStatus ? { fromStatus } : {}), ...(toStatus ? { toStatus } : {}), ...(reason ? { reason } : {}) }
}

function versionedPatch(order: Envelope<WorkOrder>, expectedVersion: number, actorUserId: string, operationId: string, patch: Partial<WorkOrder>, audit: AuditEvent): Result | { patch: Partial<WorkOrder>; nextVersion: number } {
  if (order.data.version !== expectedVersion) return fail('version_conflict', `order is at version ${order.data.version}`)
  const history = Array.isArray(order.data.auditTrail) ? order.data.auditTrail : []
  if (history.length >= 200) return fail('audit_limit_reached', 'order history has reached its maximum size')
  return { patch: { ...patch, version: expectedVersion + 1, auditTrail: [...history, audit] }, nextVersion: expectedVersion + 1 }
}

export const ensureMyProfile: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const existing = await getProfile(tools, userId)
  if (existing && 'success' in existing) return existing
  if (existing) return ok({ profile: existing.data })
  const displayName = optionalText(params.displayName, 'displayName', 100)
  if (typeof displayName !== 'string') return displayName
  const created = await tools.create<StaffProfile>('staff_profiles', { userId, displayName: displayName || 'Maintenance operator', businessRole: userId === env.OWNER_USER_ID ? 'supervisor' : 'operator', joinedAt: now(), isDemo: 0 }, userId)
  if (created.success) return ok({ recordId: created.data.recordId, businessRole: userId === env.OWNER_USER_ID ? 'supervisor' : 'operator' })
  const raced = await getProfile(tools, userId)
  if (raced && !('success' in raced)) return ok({ recordId: raced.recordId, profile: raced.data, replayed: true })
  return errorResult(created)
}

export const setStaffRole: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  if (userId !== env.OWNER_USER_ID) return fail('forbidden', 'only the app owner can change business roles')
  const targetUserId = text(params.targetUserId, 'targetUserId', 100)
  const role = enumValue(params.businessRole, 'businessRole', businessRoles)
  if (typeof targetUserId !== 'string') return targetUserId
  if (isFailure(role)) return role
  if (targetUserId === env.OWNER_USER_ID && role !== 'supervisor') return fail('validation_failed', 'the owner must remain supervisor')
  const profile = await getProfile(tools, targetUserId)
  if (!profile) return fail('not_found', 'staff profile does not exist')
  if ('success' in profile) return profile
  if (profile.data.isDemo) return fail('validation_failed', 'demo profiles are read-only')
  const updated = await tools.update<StaffProfile>('staff_profiles', targetUserId, { businessRole: role })
  return updated.success ? ok({ recordId: targetUserId, businessRole: role }) : errorResult(updated)
}

export const createAsset: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const profile = await requireProfile(tools, userId)
  if ('success' in profile) return profile
  const denied = requireRole(profile, ['supervisor']); if (denied) return denied
  const operationState = await operation(tools, userId, 'createAsset', params); if ('failure' in operationState) return operationState.failure
  if (operationState.replayed) return ok({ recordId: operationState.replayed, replayed: true })
  const quota = await enforceQuota(tools, 'assets', {}, 50, 'the sandbox allows at most 50 assets'); if (quota) return quota
  const assetCodeValue = textRange(params.assetCode, 'assetCode', 2, 24)
  const name = textRange(params.name, 'name', 3, 80)
  const category = enumValue(params.category, 'category', assetCategories)
  const location = text(params.location, 'location', 120)
  const description = optionalText(params.description, 'description', 500)
  if (typeof assetCodeValue !== 'string' || typeof name !== 'string' || typeof location !== 'string' || typeof description !== 'string') return fail('validation_failed', 'asset fields are invalid')
  if (isFailure(category)) return category
  const assetCode = assetCodeValue.toUpperCase().replace(/\s+/g, '-')
  const created = await tools.create<Asset>('assets', { assetCode, name, category, location, description, archivedAt: '', createdByUserId: userId })
  if (!created.success) return errorResult(created)
  const receipt = await saveOperation(tools, userId, 'createAsset', operationState.operationId, operationState.fingerprint, created.data.recordId); if (receipt) return receipt
  return ok({ recordId: created.data.recordId })
}

export const updateAsset: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const profile = await requireProfile(tools, userId); if ('success' in profile) return profile
  const denied = requireRole(profile, ['supervisor']); if (denied) return denied
  const operationState = await operation(tools, userId, 'updateAsset', params); if ('failure' in operationState) return operationState.failure
  if (operationState.replayed) return ok({ recordId: operationState.replayed, replayed: true })
  const assetId = text(params.assetId, 'assetId', 120); if (typeof assetId !== 'string') return assetId
  const asset = await getAsset(tools, assetId); if (!asset) return fail('not_found', 'asset does not exist'); if ('success' in asset) return asset
  if (asset.data.archivedAt) return fail('asset_archived', 'archived assets cannot be edited')
  const patch: Partial<Asset> = {}
  if (params.assetCode !== undefined) { const code = textRange(params.assetCode, 'assetCode', 2, 24); if (typeof code !== 'string') return code; patch.assetCode = code.toUpperCase().replace(/\s+/g, '-') }
  if (params.name !== undefined) { const value = textRange(params.name, 'name', 3, 80); if (typeof value !== 'string') return value; patch.name = value }
  if (params.category !== undefined) { const value = enumValue(params.category, 'category', assetCategories); if (isFailure(value)) return value; patch.category = value }
  if (params.location !== undefined) { const value = text(params.location, 'location', 120); if (typeof value !== 'string') return value; patch.location = value }
  if (params.description !== undefined) { const value = optionalText(params.description, 'description', 500); if (typeof value !== 'string') return value; patch.description = value }
  if (Object.keys(patch).length === 0) return fail('validation_failed', 'provide an asset field to update')
  const updated = await tools.update<Asset>('assets', assetId, patch)
  if (!updated.success) return errorResult(updated)
  const receipt = await saveOperation(tools, userId, 'updateAsset', operationState.operationId, operationState.fingerprint, assetId); if (receipt) return receipt
  return ok({ recordId: assetId })
}

export const archiveAsset: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const profile = await requireProfile(tools, userId); if ('success' in profile) return profile
  const denied = requireRole(profile, ['supervisor']); if (denied) return denied
  const operationState = await operation(tools, userId, 'archiveAsset', params); if ('failure' in operationState) return operationState.failure
  if (operationState.replayed) return ok({ recordId: operationState.replayed, replayed: true })
  const assetId = text(params.assetId, 'assetId', 120); if (typeof assetId !== 'string') return assetId
  const asset = await getAsset(tools, assetId); if (!asset) return fail('not_found', 'asset does not exist'); if ('success' in asset) return asset
  if (asset.data.archivedAt) return ok({ recordId: assetId, alreadyArchived: true })
  const updated = await tools.update<Asset>('assets', assetId, { archivedAt: now() })
  if (!updated.success) return errorResult(updated)
  const receipt = await saveOperation(tools, userId, 'archiveAsset', operationState.operationId, operationState.fingerprint, assetId); if (receipt) return receipt
  return ok({ recordId: assetId })
}

export const createWorkOrder: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const profile = await requireProfile(tools, userId); if ('success' in profile) return profile
  const operationState = await operation(tools, userId, 'createWorkOrder', params); if ('failure' in operationState) return operationState.failure
  if (operationState.replayed) return ok({ recordId: operationState.replayed, replayed: true })
  const quota = await enforceOpenOrderQuota(tools, userId); if (quota) return quota
  const assetId = text(params.assetId, 'assetId', 120); const title = textRange(params.title, 'title', 5, 120); const description = textRange(params.description, 'description', 20, 3000); const priority = enumValue(params.priority ?? 'medium', 'priority', priorities)
  if (typeof assetId !== 'string' || typeof title !== 'string' || typeof description !== 'string') return fail('validation_failed', 'work order fields are invalid')
  if (isFailure(priority)) return priority
  const asset = await getAsset(tools, assetId); if (!asset) return fail('not_found', 'asset does not exist'); if ('success' in asset) return asset; if (asset.data.archivedAt) return fail('asset_archived', 'cannot report an issue on an archived asset')
  const orderId = `wo_${safeId(userId)}_${safeId(operationState.operationId)}`
  const audit = event(userId, operationState.operationId, 'reported', 'reported', 'reported')
  const created = await tools.create<WorkOrder>('work_orders', { assetId, title, description, maintenanceType: 'corrective', priority, status: 'reported', reportedByUserId: userId, assignedToUserId: '', dueAt: '', blockReason: '', workSummary: '', checklist: [], version: 1, auditTrail: [audit], startedAt: '', submittedAt: '', completedAt: '', approvedByUserId: '', cancelledAt: '' }, orderId)
  if (!created.success) return errorResult(created)
  const receipt = await saveOperation(tools, userId, 'createWorkOrder', operationState.operationId, operationState.fingerprint, orderId); if (receipt) return receipt
  return ok({ recordId: orderId, version: 1 })
}

async function mutateOrder(tools: ActionTools, userId: string, params: Data, commandName: string, allowedRoles: readonly BusinessRole[], transition: (order: WorkOrder, profile: StaffProfile) => Result | { patch: Partial<WorkOrder>; event: AuditEvent }): Promise<Result> {
  const profile = await requireProfile(tools, userId); if ('success' in profile) return profile
  const denied = requireRole(profile, allowedRoles); if (denied) return denied
  const operationState = await operation(tools, userId, commandName, params); if ('failure' in operationState) return operationState.failure
  if (operationState.replayed) return ok({ recordId: operationState.replayed, replayed: true })
  const workOrderId = text(params.workOrderId, 'workOrderId', 120); if (typeof workOrderId !== 'string') return workOrderId
  const expectedVersion = commandVersion(params); if (typeof expectedVersion !== 'number') return expectedVersion
  const order = await getOrder(tools, workOrderId); if (!order) return fail('not_found', 'work order does not exist'); if ('success' in order) return order
  const next = transition(order.data, profile.data); if ('success' in next) return next
  const versioned = versionedPatch(order, expectedVersion, userId, operationState.operationId, next.patch, next.event); if ('success' in versioned) return versioned
  const updated = await tools.update<WorkOrder>('work_orders', workOrderId, versioned.patch)
  if (!updated.success) return errorResult(updated)
  const receipt = await saveOperation(tools, userId, commandName, operationState.operationId, operationState.fingerprint, workOrderId); if (receipt) return receipt
  return ok({ recordId: workOrderId, version: versioned.nextVersion })
}

export const editReportedWorkOrder: ActionHandler<Env> = async ({ userId, params, tools }) => mutateOrder(tools, userId, params, 'editReportedWorkOrder', ['operator', 'supervisor'], (order, profile) => {
  if (order.status !== 'reported' || (profile.businessRole !== 'supervisor' && order.reportedByUserId !== userId)) return fail('invalid_transition', 'only the reporter or supervisor can edit a reported order')
  const patch: Partial<WorkOrder> = {}
  if (params.title !== undefined) { const value = textRange(params.title, 'title', 5, 120); if (typeof value !== 'string') return value; patch.title = value }
  if (params.description !== undefined) { const value = textRange(params.description, 'description', 20, 3000); if (typeof value !== 'string') return value; patch.description = value }
  if (Object.keys(patch).length === 0) return fail('validation_failed', 'provide title or description')
  return { patch, event: event(userId, String(params.operationId), 'report_edited', order.status, order.status) }
})

export const setOrderPriorityAndDueDate: ActionHandler<Env> = async ({ userId, params, tools }) => mutateOrder(tools, userId, params, 'setOrderPriorityAndDueDate', ['supervisor'], (order) => {
  if (['completed', 'cancelled'].includes(order.status)) return fail('invalid_transition', 'terminal orders cannot be edited')
  const patch: Partial<WorkOrder> = {}
  if (params.priority !== undefined) { const value = enumValue(params.priority, 'priority', priorities); if (isFailure(value)) return value; patch.priority = value }
  if (params.dueAt !== undefined) { const value = isoDateOrEmpty(params.dueAt, 'dueAt'); if (typeof value !== 'string') return value; patch.dueAt = value }
  if (Object.keys(patch).length === 0) return fail('validation_failed', 'provide priority or dueAt')
  return { patch, event: event(userId, String(params.operationId), 'priority_or_due_date_updated', order.status, order.status) }
})

export const startWorkOrder: ActionHandler<Env> = async ({ userId, params, tools }) => mutateOrder(tools, userId, params, 'startWorkOrder', ['technician'], (order) => {
  if (order.assignedToUserId !== userId || order.status !== 'assigned') return fail('forbidden', 'only the assigned technician can start an assigned order')
  return { patch: { status: 'in_progress', startedAt: order.startedAt || now(), blockReason: '' }, event: event(userId, String(params.operationId), 'work_started', order.status, 'in_progress') }
})

export const blockWorkOrder: ActionHandler<Env> = async ({ userId, params, tools }) => mutateOrder(tools, userId, params, 'blockWorkOrder', ['technician'], (order) => {
  if (order.assignedToUserId !== userId || order.status !== 'in_progress') return fail('invalid_transition', 'only in-progress assigned work can be blocked')
  const reason = textRange(params.reason, 'reason', 10, 500); if (typeof reason !== 'string') return reason
  return { patch: { status: 'blocked', blockReason: reason }, event: event(userId, String(params.operationId), 'work_blocked', order.status, 'blocked', reason) }
})

export const resumeWorkOrder: ActionHandler<Env> = async ({ userId, params, tools }) => mutateOrder(tools, userId, params, 'resumeWorkOrder', ['technician'], (order) => {
  if (order.assignedToUserId !== userId || order.status !== 'blocked') return fail('invalid_transition', 'only blocked work assigned to you can resume')
  return { patch: { status: 'in_progress', blockReason: '' }, event: event(userId, String(params.operationId), 'work_resumed', order.status, 'in_progress') }
})

export const updateWorkChecklist: ActionHandler<Env> = async ({ userId, params, tools }) => mutateOrder(tools, userId, params, 'updateWorkChecklist', ['supervisor', 'technician'], (order, profile) => {
  const canEdit = profile.businessRole === 'supervisor' ? ['reported', 'assigned'].includes(order.status) : order.assignedToUserId === userId && order.status === 'in_progress'
  if (!canEdit) return fail('forbidden', 'checklist cannot be edited in the current state')
  const next = checklist(params.checklist); if (isFailure(next)) return next
  if (profile.businessRole === 'technician') {
    const existingSupervisor = order.checklist.filter((item) => item.origin === 'supervisor')
    if (existingSupervisor.some((item) => !next.some((candidate) => candidate.id === item.id && candidate.label === item.label && candidate.origin === 'supervisor'))) return fail('validation_failed', 'technicians cannot remove supervisor checklist items')
    if (next.some((item) => item.origin === 'supervisor' && !existingSupervisor.some((existing) => existing.id === item.id && existing.label === item.label))) return fail('validation_failed', 'technicians cannot create supervisor checklist items')
  }
  const normalized = profile.businessRole === 'supervisor' ? next.map((item) => ({ ...item, origin: 'supervisor' as const })) : next.map((item) => order.checklist.some((existing) => existing.origin === 'supervisor' && existing.id === item.id && existing.label === item.label) ? { ...item, origin: 'supervisor' as const } : { ...item, origin: 'technician' as const })
  return { patch: { checklist: normalized }, event: event(userId, String(params.operationId), 'checklist_updated', order.status, order.status) }
})

export const updateWorkSummary: ActionHandler<Env> = async ({ userId, params, tools }) => mutateOrder(tools, userId, params, 'updateWorkSummary', ['technician'], (order) => {
  if (order.assignedToUserId !== userId || order.status !== 'in_progress') return fail('forbidden', 'only the assigned technician can document active work')
  const summary = textRange(params.workSummary, 'workSummary', 30, 2000); if (typeof summary !== 'string') return summary
  return { patch: { workSummary: summary }, event: event(userId, String(params.operationId), 'work_summary_updated', order.status, order.status) }
})

export const returnWorkForChanges: ActionHandler<Env> = async ({ userId, params, tools }) => mutateOrder(tools, userId, params, 'returnWorkForChanges', ['supervisor'], (order) => {
  if (order.status !== 'awaiting_review') return fail('invalid_transition', 'only orders awaiting review can be returned')
  const reason = textRange(params.reason, 'reason', 10, 500); if (typeof reason !== 'string') return reason
  return { patch: { status: 'in_progress', blockReason: reason }, event: event(userId, String(params.operationId), 'review_returned', order.status, 'in_progress', reason) }
})

export const approveWorkOrder: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const profile = await requireProfile(tools, userId); if ('success' in profile) return profile
  const denied = requireRole(profile, ['supervisor']); if (denied) return denied
  const operationState = await operation(tools, userId, 'approveWorkOrder', params); if ('failure' in operationState) return operationState.failure
  if (operationState.replayed) return ok({ recordId: operationState.replayed, replayed: true })
  const workOrderId = text(params.workOrderId, 'workOrderId', 120); const expectedVersion = commandVersion(params)
  if (typeof workOrderId !== 'string' || typeof expectedVersion !== 'number') return fail('validation_failed', 'approval fields are invalid')
  const order = await getOrder(tools, workOrderId); if (!order) return fail('not_found', 'work order does not exist'); if ('success' in order) return order
  if (order.data.status !== 'awaiting_review') return fail('invalid_transition', 'only orders awaiting review can be approved')
  if (!order.data.submittedAt || !order.data.workSummary || order.data.checklist.length === 0 || order.data.checklist.some((item) => !item.completed)) return fail('validation_failed', 'summary, checklist and submission are required')
  const attachments = await tools.query('order_attachments', { where: { workOrderId, kind: 'repair', uploadedByUserId: order.data.assignedToUserId }, limit: 3 }); if (!attachments.success) return errorResult(attachments)
  if (attachments.data.count < 1) return fail('evidence_required', 'a repair photo is required before approval')
  const versioned = versionedPatch(order, expectedVersion, userId, operationState.operationId, { status: 'completed', completedAt: now(), approvedByUserId: userId }, event(userId, operationState.operationId, 'completion_approved', order.data.status, 'completed'))
  if ('success' in versioned) return versioned
  const updated = await tools.update<WorkOrder>('work_orders', workOrderId, versioned.patch); if (!updated.success) return errorResult(updated)
  const receipt = await saveOperation(tools, userId, 'approveWorkOrder', operationState.operationId, operationState.fingerprint, workOrderId); if (receipt) return receipt
  return ok({ recordId: workOrderId, version: versioned.nextVersion })
}

export const cancelWorkOrder: ActionHandler<Env> = async ({ userId, params, tools }) => mutateOrder(tools, userId, params, 'cancelWorkOrder', ['supervisor'], (order) => {
  if (['completed', 'cancelled'].includes(order.status)) return fail('invalid_transition', 'order is already terminal')
  const reason = textRange(params.reason, 'reason', 10, 500); if (typeof reason !== 'string') return reason
  return { patch: { status: 'cancelled', cancelledAt: now(), blockReason: reason }, event: event(userId, String(params.operationId), 'order_cancelled', order.status, 'cancelled', reason) }
})

export const addOrderComment: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const profile = await requireProfile(tools, userId); if ('success' in profile) return profile
  const operationState = await operation(tools, userId, 'addOrderComment', params); if ('failure' in operationState) return operationState.failure
  if (operationState.replayed) return ok({ recordId: operationState.replayed, replayed: true })
  const workOrderId = text(params.workOrderId, 'workOrderId', 120); const body = textRange(params.body, 'body', 1, 1000)
  if (typeof workOrderId !== 'string' || typeof body !== 'string') return fail('validation_failed', 'comment fields are invalid')
  const order = await getOrder(tools, workOrderId); if (!order) return fail('not_found', 'work order does not exist'); if ('success' in order) return order
  if (['completed', 'cancelled'].includes(order.data.status)) return fail('invalid_transition', 'comments cannot be added to terminal orders')
  const quota = await enforceRecentQuota(tools, 'order_comments', { authorUserId: userId }, 'postedAt', 60 * 60 * 1000, 30, 'you can add at most 30 comments per hour'); if (quota) return quota
  const commentId = `comment_${safeId(userId)}_${safeId(operationState.operationId)}`
  const created = await tools.create<OrderComment>('order_comments', { workOrderId, authorUserId: userId, body, postedAt: now(), operationId: operationState.operationId }, commentId)
  if (!created.success) return errorResult(created)
  const receipt = await saveOperation(tools, userId, 'addOrderComment', operationState.operationId, operationState.fingerprint, commentId); if (receipt) return receipt
  return ok({ recordId: commentId })
}

export const assignWorkOrderAction: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const profile = await requireProfile(tools, userId); if ('success' in profile) return profile
  const denied = requireRole(profile, ['supervisor']); if (denied) return denied
  const operationState = await operation(tools, userId, 'assignWorkOrder', params); if ('failure' in operationState) return operationState.failure
  if (operationState.replayed) return ok({ recordId: operationState.replayed, replayed: true })
  const workOrderId = text(params.workOrderId, 'workOrderId', 120); const assignedToUserId = text(params.assignedToUserId, 'assignedToUserId', 100); const expectedVersion = commandVersion(params)
  if (typeof workOrderId !== 'string' || typeof assignedToUserId !== 'string' || typeof expectedVersion !== 'number') return fail('validation_failed', 'assignment fields are invalid')
  const order = await getOrder(tools, workOrderId); if (!order) return fail('not_found', 'work order does not exist'); if ('success' in order) return order
  if (!['reported', 'assigned', 'in_progress', 'blocked'].includes(order.data.status)) return fail('invalid_transition', 'order cannot be assigned in its current state')
  const technician = await getProfile(tools, assignedToUserId); if (!technician) return fail('not_found', 'technician profile does not exist'); if ('success' in technician) return technician
  if (technician.data.businessRole !== 'technician' || technician.data.isDemo) return fail('validation_failed', 'assignee must be an active technician')
  if (order.data.assignedToUserId === assignedToUserId) return fail('validation_failed', 'choose a different technician')
  const reason = optionalText(params.reason, 'reason', 500); if (typeof reason !== 'string') return reason
  const isReassignment = order.data.status !== 'reported' && !!order.data.assignedToUserId
  if (isReassignment && reason.trim().length < 10) return fail('validation_failed', 'a reassignment reason of at least 10 characters is required')
  const nextStatus: WorkOrder['status'] = order.data.status === 'reported' || isReassignment ? 'assigned' : order.data.status
  const patch: Partial<WorkOrder> = { assignedToUserId, status: nextStatus, blockReason: '' }
  if (isReassignment) patch.startedAt = ''
  const versioned = versionedPatch(order, expectedVersion, userId, operationState.operationId, patch, event(userId, operationState.operationId, 'work_assigned', order.data.status, nextStatus, reason || undefined))
  if ('success' in versioned) return versioned
  const updated = await tools.update<WorkOrder>('work_orders', workOrderId, versioned.patch); if (!updated.success) return errorResult(updated)
  const receipt = await saveOperation(tools, userId, 'assignWorkOrder', operationState.operationId, operationState.fingerprint, workOrderId); if (receipt) return receipt
  return ok({ recordId: workOrderId, version: versioned.nextVersion })
}

export const submitWorkForReviewAction: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const profile = await requireProfile(tools, userId); if ('success' in profile) return profile
  const denied = requireRole(profile, ['technician']); if (denied) return denied
  const operationState = await operation(tools, userId, 'submitWorkForReview', params); if ('failure' in operationState) return operationState.failure
  if (operationState.replayed) return ok({ recordId: operationState.replayed, replayed: true })
  const workOrderId = text(params.workOrderId, 'workOrderId', 120); const expectedVersion = commandVersion(params)
  if (typeof workOrderId !== 'string' || typeof expectedVersion !== 'number') return fail('validation_failed', 'submission fields are invalid')
  const order = await getOrder(tools, workOrderId); if (!order) return fail('not_found', 'work order does not exist'); if ('success' in order) return order
  if (order.data.assignedToUserId !== userId || order.data.status !== 'in_progress') return fail('forbidden', 'only the assigned technician can submit active work')
  if (!order.data.workSummary || order.data.checklist.length === 0 || order.data.checklist.some((item) => !item.completed)) return fail('validation_failed', 'summary and completed checklist are required')
  const attachments = await tools.query('order_attachments', { where: { workOrderId, kind: 'repair', uploadedByUserId: userId }, limit: 3 }); if (!attachments.success) return errorResult(attachments)
  if (attachments.data.count < 1) return fail('evidence_required', 'a repair photo is required before review')
  const versioned = versionedPatch(order, expectedVersion, userId, operationState.operationId, { status: 'awaiting_review', submittedAt: now() }, event(userId, operationState.operationId, 'submitted_for_review', order.data.status, 'awaiting_review'))
  if ('success' in versioned) return versioned
  const updated = await tools.update<WorkOrder>('work_orders', workOrderId, versioned.patch); if (!updated.success) return errorResult(updated)
  const receipt = await saveOperation(tools, userId, 'submitWorkForReview', operationState.operationId, operationState.fingerprint, workOrderId); if (receipt) return receipt
  return ok({ recordId: workOrderId, version: versioned.nextVersion })
}

export const authorizeAttachmentUpload: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const profile = await requireProfile(tools, userId); if ('success' in profile) return profile
  const workOrderId = text(params.workOrderId, 'workOrderId', 120); const expectedVersion = commandVersion(params); const contentType = enumValue(params.contentType, 'contentType', ['image/jpeg', 'image/png', 'image/webp'] as const); const sizeBytes = integer(params.sizeBytes, 'sizeBytes', 1)
  if (typeof workOrderId !== 'string' || typeof expectedVersion !== 'number' || typeof sizeBytes !== 'number') return fail('validation_failed', 'attachment fields are invalid')
  if (isFailure(contentType) || sizeBytes > 5 * 1024 * 1024) return isFailure(contentType) ? contentType : fail('validation_failed', 'images must be 5 MiB or smaller')
  const order = await getOrder(tools, workOrderId); if (!order) return fail('not_found', 'work order does not exist'); if ('success' in order) return order
  if (order.data.version !== expectedVersion) return fail('version_conflict', `order is at version ${order.data.version}`)
  const kind = order.data.status === 'reported' && profile.data.businessRole === 'supervisor' ? 'report' : order.data.status === 'reported' && ['operator', 'technician'].includes(profile.data.businessRole) && order.data.reportedByUserId === userId ? 'report' : profile.data.businessRole === 'technician' && order.data.assignedToUserId === userId && order.data.status === 'in_progress' ? 'repair' : null
  if (!kind) return fail('evidence_frozen', 'you cannot attach evidence in the current order state')
  const orderQuota = await enforceQuota(tools, 'order_attachments', { workOrderId }, 3, 'an order can have at most three photos'); if (orderQuota) return orderQuota
  const userQuota = await enforceQuota(tools, 'order_attachments', { uploadedByUserId: userId }, 15, 'you can upload at most 15 photos in this sandbox'); if (userQuota) return userQuota
  return ok({ kind })
}

export const registerAttachment: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const profile = await requireProfile(tools, userId); if ('success' in profile) return profile
  const operationState = await operation(tools, userId, 'registerAttachment', params); if ('failure' in operationState) return operationState.failure
  if (operationState.replayed) return ok({ recordId: operationState.replayed, replayed: true })
  const workOrderId = text(params.workOrderId, 'workOrderId', 120)
  const expectedVersion = commandVersion(params)
  const storageKey = text(params.storageKey, 'storageKey', 300)
  const originalName = text(params.originalName, 'originalName', 180)
  const contentType = enumValue(params.contentType, 'contentType', ['image/jpeg', 'image/png', 'image/webp'] as const)
  const caption = optionalText(params.caption, 'caption', 300)
  const sizeBytes = integer(params.sizeBytes, 'sizeBytes', 1)
  if (typeof workOrderId !== 'string' || typeof expectedVersion !== 'number' || typeof storageKey !== 'string' || typeof originalName !== 'string' || typeof caption !== 'string' || typeof sizeBytes !== 'number') return fail('validation_failed', 'attachment fields are invalid')
  if (isFailure(contentType)) return contentType
  if (sizeBytes > 5 * 1024 * 1024) return fail('validation_failed', 'images must be 5 MiB or smaller')
  if (!storageKey.startsWith(`orders/${workOrderId}/`) || storageKey.includes('..') || storageKey.includes('://')) return fail('validation_failed', 'storageKey is invalid')
  const order = await getOrder(tools, workOrderId); if (!order) return fail('not_found', 'work order does not exist'); if ('success' in order) return order
  let kind: 'report' | 'repair'
  if (order.data.status === 'reported' && profile.data.businessRole === 'supervisor') kind = 'report'
  else if (order.data.status === 'reported' && ['operator', 'technician'].includes(profile.data.businessRole) && order.data.reportedByUserId === userId) kind = 'report'
  else if (profile.data.businessRole === 'technician' && order.data.assignedToUserId === userId && order.data.status === 'in_progress') kind = 'repair'
  else return fail('evidence_frozen', 'you cannot attach evidence in the current order state')
  const userQuota = await enforceQuota(tools, 'order_attachments', { uploadedByUserId: userId }, 15, 'you can upload at most 15 photos in this sandbox'); if (userQuota) return userQuota
  const existing = await tools.query('order_attachments', { where: { workOrderId }, limit: 3 })
  if (!existing.success) return errorResult(existing)
  if (existing.data.count >= 3) return fail('quota_exceeded', 'an order can have at most three photos')
  const attachmentId = `attachment_${safeId(userId)}_${safeId(operationState.operationId)}`
  const created = await tools.create('order_attachments', { workOrderId, kind, storageKey, storageOwnerUserId: env.DEEPSPACE_APP_ID, uploadedByUserId: userId, originalName: originalName.replace(/[\\/\u0000-\u001f]/g, '_'), contentType, sizeBytes, caption, uploadedAt: now(), operationId: operationState.operationId }, attachmentId)
  if (!created.success) return errorResult(created)
  const versioned = versionedPatch(order, expectedVersion, userId, operationState.operationId, {}, event(userId, operationState.operationId, 'evidence_added', order.data.status, order.data.status, kind))
  if ('success' in versioned) { await tools.remove('order_attachments', attachmentId); return versioned }
  const updated = await tools.update<WorkOrder>('work_orders', workOrderId, versioned.patch)
  if (!updated.success) { await tools.remove('order_attachments', attachmentId); return errorResult(updated) }
  const receipt = await saveOperation(tools, userId, 'registerAttachment', operationState.operationId, operationState.fingerprint, attachmentId); if (receipt) return receipt
  return ok({ recordId: attachmentId, kind, version: versioned.nextVersion })
}

export const seedDemoWorkspace: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  if (userId !== env.OWNER_USER_ID) return fail('forbidden', 'only the app owner can seed demo data')
  const operationState = await operation(tools, userId, 'seedDemoWorkspace', params); if ('failure' in operationState) return operationState.failure
  if (operationState.replayed) return ok({ seeded: true, replayed: true })
  const ownProfile = await getProfile(tools, userId)
  if (ownProfile && 'success' in ownProfile) return ownProfile
  if (!ownProfile) {
    const created = await tools.create<StaffProfile>('staff_profiles', { userId, displayName: 'Workspace owner', businessRole: 'supervisor', joinedAt: now(), isDemo: 0 }, userId)
    if (!created.success) return errorResult(created)
  }
  const profiles: Array<[string, StaffProfile]> = [
    ['demo:operator', { userId: 'demo:operator', displayName: 'Alex Rivera · Demo', businessRole: 'operator', joinedAt: '2026-11-20T14:00:00.000Z', isDemo: 1 }],
    ['demo:technician', { userId: 'demo:technician', displayName: 'Maya Chen · Demo', businessRole: 'technician', joinedAt: '2026-11-20T14:00:00.000Z', isDemo: 1 }],
  ]
  for (const [recordId, profile] of profiles) {
    const existing = await tools.get<StaffProfile>('staff_profiles', recordId)
    if (!existing.success) { const created = await tools.create('staff_profiles', profile, recordId); if (!created.success) return errorResult(created) }
  }
  const assets: Array<[string, Asset]> = [
    ['demo-asset-pump-003', { assetCode: 'PUMP-003', name: 'Cooling loop pump', category: 'pump', location: 'North utility room', description: 'Primary cooling loop pump for the demo line.', archivedAt: '', createdByUserId: userId }],
    ['demo-asset-compressor-002', { assetCode: 'COMP-002', name: 'Workshop air compressor', category: 'compressor', location: 'Demo Service Bay', description: 'Compressed air source for the training bay.', archivedAt: '', createdByUserId: userId }],
    ['demo-asset-generator-001', { assetCode: 'GEN-001', name: 'Backup generator', category: 'generator', location: 'Demo Utility Area', description: 'Backup generator for the demonstration workspace.', archivedAt: '', createdByUserId: userId }],
    ['demo-asset-vehicle-004', { assetCode: 'FORK-004', name: 'Warehouse forklift', category: 'vehicle', location: 'Demo Warehouse', description: 'Training forklift for warehouse maintenance.', archivedAt: '', createdByUserId: userId }],
    ['demo-asset-vehicle-005', { assetCode: 'EXC-005', name: 'Training excavator', category: 'vehicle', location: 'Demo Yard', description: 'Training excavator for the demo yard.', archivedAt: '', createdByUserId: userId }],
  ]
  for (const [recordId, asset] of assets) {
    const existing = await tools.get<Asset>('assets', recordId)
    if (!existing.success) { const created = await tools.create('assets', asset, recordId); if (!created.success) return errorResult(created) }
  }
  const seededAt = '2026-11-23T15:00:00.000Z'
  const orders: Array<[string, WorkOrder]> = [
    ['demo-wo-1048', { assetId: 'demo-asset-pump-003', title: 'Cooling loop pressure drop', description: 'Operator reported a visible leak around the pump housing.', maintenanceType: 'corrective', priority: 'high', status: 'reported', reportedByUserId: 'demo:operator', assignedToUserId: '', dueAt: '2026-11-26T15:00:00.000Z', blockReason: '', workSummary: '', checklist: [], version: 1, auditTrail: [{ id: 'seed-1048', operationId: 'seed-v1', actorUserId: userId, occurredAt: seededAt, kind: 'reported', fromStatus: 'reported', toStatus: 'reported' }], startedAt: '', submittedAt: '', completedAt: '', approvedByUserId: '', cancelledAt: '' }],
    ['demo-wo-1047', { assetId: 'demo-asset-compressor-002', title: 'Replace worn drive belt', description: 'Drive belt shows visible wear during the daily inspection.', maintenanceType: 'corrective', priority: 'medium', status: 'awaiting_review', reportedByUserId: 'demo:operator', assignedToUserId: 'demo:technician', dueAt: '2026-11-24T15:00:00.000Z', blockReason: '', workSummary: 'Replaced the worn belt and checked alignment on the compressor drive.', checklist: [{ id: 'alignment', label: 'Check belt alignment', completed: true, origin: 'supervisor' }], version: 3, auditTrail: [{ id: 'seed-1047', operationId: 'seed-v1', actorUserId: userId, occurredAt: seededAt, kind: 'submitted_for_review', fromStatus: 'in_progress', toStatus: 'awaiting_review' }], startedAt: seededAt, submittedAt: seededAt, completedAt: '', approvedByUserId: '', cancelledAt: '' }],
    ['demo-wo-1045', { assetId: 'demo-asset-generator-001', title: 'Inspect generator temperature alert', description: 'Generator reported a temperature alert during the afternoon run.', maintenanceType: 'corrective', priority: 'medium', status: 'in_progress', reportedByUserId: 'demo:operator', assignedToUserId: 'demo:technician', dueAt: '2026-11-28T15:00:00.000Z', blockReason: '', workSummary: 'Inspecting the sensor connection and generator ventilation for the alert.', checklist: [{ id: 'sensor', label: 'Inspect sensor connection', completed: false, origin: 'supervisor' }], version: 2, auditTrail: [{ id: 'seed-1045', operationId: 'seed-v1', actorUserId: userId, occurredAt: seededAt, kind: 'work_started', fromStatus: 'assigned', toStatus: 'in_progress' }], startedAt: seededAt, submittedAt: '', completedAt: '', approvedByUserId: '', cancelledAt: '' }],
    ['demo-wo-1044', { assetId: 'demo-asset-vehicle-004', title: 'Forklift hydraulic leak', description: 'A small hydraulic leak was found near the lift cylinder during inspection.', maintenanceType: 'corrective', priority: 'high', status: 'blocked', reportedByUserId: 'demo:operator', assignedToUserId: 'demo:technician', dueAt: '2026-11-20T15:00:00.000Z', blockReason: 'Waiting for a replacement seal before the repair can continue.', workSummary: 'The leak source is isolated and the replacement seal has been identified.', checklist: [{ id: 'isolate', label: 'Isolate the hydraulic leak', completed: true, origin: 'supervisor' }], version: 3, auditTrail: [{ id: 'seed-1044', operationId: 'seed-v1', actorUserId: userId, occurredAt: seededAt, kind: 'work_blocked', fromStatus: 'in_progress', toStatus: 'blocked', reason: 'Waiting for a replacement seal before the repair can continue.' }], startedAt: seededAt, submittedAt: '', completedAt: '', approvedByUserId: '', cancelledAt: '' }],
    ['demo-wo-1043', { assetId: 'demo-asset-vehicle-005', title: 'Excavator inspection round', description: 'Routine inspection found a loose guard on the training excavator.', maintenanceType: 'corrective', priority: 'low', status: 'assigned', reportedByUserId: 'demo:operator', assignedToUserId: 'demo:technician', dueAt: '2026-11-30T15:00:00.000Z', blockReason: '', workSummary: '', checklist: [], version: 2, auditTrail: [{ id: 'seed-1043', operationId: 'seed-v1', actorUserId: userId, occurredAt: seededAt, kind: 'work_assigned', fromStatus: 'reported', toStatus: 'assigned' }], startedAt: '', submittedAt: '', completedAt: '', approvedByUserId: '', cancelledAt: '' }],
    ['demo-wo-1042', { assetId: 'demo-asset-pump-003', title: 'Pump lubrication check', description: 'The training pump needs a scheduled lubrication point check.', maintenanceType: 'corrective', priority: 'low', status: 'completed', reportedByUserId: 'demo:operator', assignedToUserId: 'demo:technician', dueAt: '2026-11-18T15:00:00.000Z', blockReason: '', workSummary: 'Lubrication points were checked and the pump was returned to service.', checklist: [{ id: 'lubricate', label: 'Check lubrication points', completed: true, origin: 'supervisor' }], version: 5, auditTrail: [{ id: 'seed-1042', operationId: 'seed-v1', actorUserId: userId, occurredAt: seededAt, kind: 'completion_approved', fromStatus: 'awaiting_review', toStatus: 'completed' }], startedAt: seededAt, submittedAt: seededAt, completedAt: seededAt, approvedByUserId: userId, cancelledAt: '' }],
    ['demo-wo-1041', { assetId: 'demo-asset-generator-001', title: 'Cancel duplicate generator report', description: 'This duplicate training report was cancelled to demonstrate a terminal order.', maintenanceType: 'corrective', priority: 'low', status: 'cancelled', reportedByUserId: 'demo:operator', assignedToUserId: '', dueAt: '', blockReason: 'Duplicate of another demo report.', workSummary: '', checklist: [], version: 2, auditTrail: [{ id: 'seed-1041', operationId: 'seed-v1', actorUserId: userId, occurredAt: seededAt, kind: 'order_cancelled', fromStatus: 'reported', toStatus: 'cancelled', reason: 'Duplicate of another demo report.' }], startedAt: '', submittedAt: '', completedAt: '', approvedByUserId: '', cancelledAt: seededAt }],
  ]
  for (const [recordId, order] of orders) {
    const existing = await tools.get<WorkOrder>('work_orders', recordId)
    if (!existing.success) { const created = await tools.create('work_orders', order, recordId); if (!created.success) return errorResult(created) }
  }
  const demoPixel = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 207, 192, 240, 31, 0, 5, 0, 1, 255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])
  for (const [workOrderId, attachmentId] of [['demo-wo-1047', 'demo-attachment-1047'], ['demo-wo-1042', 'demo-attachment-1042']] as const) {
    const existing = await tools.get('order_attachments', attachmentId)
    if (!existing.success) {
      const storageKey = `seed/${workOrderId}/repair.png`
      await env.MAINTENANCE_EVIDENCE.put(storageKey, demoPixel, { httpMetadata: { contentType: 'image/png', contentDisposition: 'inline; filename="demo-repair.png"' } })
      const created = await tools.create('order_attachments', { workOrderId, kind: 'repair', storageKey, storageOwnerUserId: env.DEEPSPACE_APP_ID, uploadedByUserId: 'demo:technician', originalName: 'demo-repair.png', contentType: 'image/png', sizeBytes: demoPixel.byteLength, caption: 'Fictitious demo evidence', uploadedAt: seededAt, operationId: 'seed-v1' }, attachmentId)
      if (!created.success) { await env.MAINTENANCE_EVIDENCE.delete(storageKey); return errorResult(created) }
    }
  }
  const result = ok({ seeded: true, profileCount: profiles.length + 1, assetCount: assets.length, orderCount: orders.length })
  const receipt = await saveOperation(tools, userId, 'seedDemoWorkspace', operationState.operationId, operationState.fingerprint, 'seed:maintenanceflow'); if (receipt) return receipt
  return result
}
