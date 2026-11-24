export type BusinessRole = 'operator' | 'technician' | 'supervisor'

export type AssetCategory = 'pump' | 'compressor' | 'generator' | 'vehicle' | 'other'

export type MaintenanceType = 'corrective' | 'preventive'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type OrderStatus =
  | 'reported'
  | 'assigned'
  | 'in_progress'
  | 'blocked'
  | 'awaiting_review'
  | 'completed'
  | 'cancelled'

export type ChecklistOrigin = 'supervisor' | 'technician'
export type ChecklistItem = { id: string; label: string; completed: boolean; origin: ChecklistOrigin }

export type AuditEvent = {
  id: string
  operationId: string
  actorUserId: string
  occurredAt: string
  kind: string
  fromStatus?: OrderStatus
  toStatus?: OrderStatus
  reason?: string
}

export type StaffProfile = {
  userId: string
  displayName: string
  businessRole: BusinessRole
  joinedAt: string
  /** Stored as 0/1 because RecordRoom schemas support text/number storage. */
  isDemo: number
}

export type Asset = {
  assetCode: string
  name: string
  category: AssetCategory
  location: string
  description: string
  archivedAt: string
  createdByUserId: string
}

export type WorkOrder = {
  assetId: string
  title: string
  description: string
  maintenanceType: MaintenanceType
  priority: Priority
  status: OrderStatus
  reportedByUserId: string
  assignedToUserId: string
  dueAt: string
  blockReason: string
  workSummary: string
  checklist: ChecklistItem[]
  version: number
  auditTrail: AuditEvent[]
  startedAt: string
  submittedAt: string
  completedAt: string
  approvedByUserId: string
  cancelledAt: string
}

export type OrderComment = {
  workOrderId: string
  authorUserId: string
  body: string
  postedAt: string
  operationId: string
}

export type OrderAttachment = {
  workOrderId: string
  kind: 'report' | 'repair'
  storageKey: string
  storageOwnerUserId: string
  uploadedByUserId: string
  originalName: string
  contentType: string
  sizeBytes: number
  caption: string
  uploadedAt: string
  operationId: string
}

export type OperationReceipt = {
  actorUserId: string
  operationId: string
  commandName: string
  fingerprint: string
  resultRef: string
  createdAt: string
}
