import type { CollectionSchema } from 'deepspace/schema'

const roles = {
  '*': { read: false, create: false, update: false, delete: false },
  viewer: { read: false, create: false, update: false, delete: false },
  member: { read: true, create: false, update: false, delete: false },
  admin: { read: true, create: false, update: false, delete: false },
} as const

const json = { kind: 'json' } as const
const select = (options: readonly string[]) => ({ kind: 'select' as const, options: [...options] })

export const staffProfilesSchema: CollectionSchema = {
  name: 'staff_profiles',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'displayName', storage: 'text', interpretation: 'plain', maxLength: 100, required: true },
    { name: 'businessRole', storage: 'text', interpretation: select(['operator', 'technician', 'supervisor']), required: true },
    { name: 'joinedAt', storage: 'text', interpretation: 'plain', required: true },
    // RecordRoom stores booleans as numeric flags (0/1) in typed SQL columns.
    { name: 'isDemo', storage: 'number', interpretation: 'plain', required: true },
  ],
  uniqueOn: ['userId'],
  ownerField: 'userId',
  permissions: roles,
}

export const assetsSchema: CollectionSchema = {
  name: 'assets',
  columns: [
    { name: 'assetCode', storage: 'text', interpretation: 'plain', maxLength: 40, required: true },
    { name: 'name', storage: 'text', interpretation: 'plain', maxLength: 120, required: true },
    { name: 'category', storage: 'text', interpretation: select(['pump', 'compressor', 'generator', 'vehicle', 'other']), required: true },
    { name: 'location', storage: 'text', interpretation: 'plain', maxLength: 120, required: true },
    { name: 'description', storage: 'text', interpretation: 'plain', maxLength: 500 },
    { name: 'archivedAt', storage: 'text', interpretation: 'plain' },
    { name: 'createdByUserId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
  ],
  uniqueOn: ['assetCode'],
  permissions: roles,
}

export const workOrdersSchema: CollectionSchema = {
  name: 'work_orders',
  columns: [
    { name: 'assetId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'title', storage: 'text', interpretation: 'plain', maxLength: 120, required: true },
    { name: 'description', storage: 'text', interpretation: 'plain', maxLength: 3000, required: true },
    { name: 'maintenanceType', storage: 'text', interpretation: select(['corrective', 'preventive']), required: true },
    { name: 'priority', storage: 'text', interpretation: select(['low', 'medium', 'high', 'critical']), required: true },
    { name: 'status', storage: 'text', interpretation: select(['reported', 'assigned', 'in_progress', 'blocked', 'awaiting_review', 'completed', 'cancelled']), required: true },
    { name: 'reportedByUserId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'assignedToUserId', storage: 'text', interpretation: 'plain' },
    { name: 'dueAt', storage: 'text', interpretation: 'plain' },
    { name: 'blockReason', storage: 'text', interpretation: 'plain', maxLength: 500 },
    { name: 'workSummary', storage: 'text', interpretation: 'plain', maxLength: 2000 },
    { name: 'checklist', storage: 'text', interpretation: json },
    { name: 'version', storage: 'number', interpretation: 'plain', required: true },
    { name: 'auditTrail', storage: 'text', interpretation: json },
    { name: 'startedAt', storage: 'text', interpretation: 'plain' },
    { name: 'submittedAt', storage: 'text', interpretation: 'plain' },
    { name: 'completedAt', storage: 'text', interpretation: 'plain' },
    { name: 'approvedByUserId', storage: 'text', interpretation: 'plain' },
    { name: 'cancelledAt', storage: 'text', interpretation: 'plain' },
  ],
  permissions: roles,
}

export const orderCommentsSchema: CollectionSchema = {
  name: 'order_comments',
  columns: [
    { name: 'workOrderId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'authorUserId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'body', storage: 'text', interpretation: 'plain', maxLength: 1000, required: true },
    { name: 'postedAt', storage: 'text', interpretation: 'plain', required: true },
    { name: 'operationId', storage: 'text', interpretation: 'plain', maxLength: 100, required: true },
  ],
  uniqueOn: ['authorUserId', 'operationId'],
  permissions: roles,
}

export const orderAttachmentsSchema: CollectionSchema = {
  name: 'order_attachments',
  columns: [
    { name: 'workOrderId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'kind', storage: 'text', interpretation: select(['report', 'repair']), required: true },
    { name: 'storageKey', storage: 'text', interpretation: 'plain', maxLength: 300, required: true },
    { name: 'storageOwnerUserId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'uploadedByUserId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'originalName', storage: 'text', interpretation: 'plain', maxLength: 180, required: true },
    { name: 'contentType', storage: 'text', interpretation: 'plain', maxLength: 80, required: true },
    { name: 'sizeBytes', storage: 'number', interpretation: 'plain', required: true },
    { name: 'caption', storage: 'text', interpretation: 'plain', maxLength: 300 },
    { name: 'uploadedAt', storage: 'text', interpretation: 'plain', required: true },
    { name: 'operationId', storage: 'text', interpretation: 'plain', maxLength: 100, required: true },
  ],
  uniqueOn: ['uploadedByUserId', 'operationId'],
  permissions: roles,
}

export const operationReceiptsSchema: CollectionSchema = {
  name: 'operation_receipts',
  columns: [
    { name: 'actorUserId', storage: 'text', interpretation: 'plain', immutable: true, required: true },
    { name: 'operationId', storage: 'text', interpretation: 'plain', maxLength: 100, required: true },
    { name: 'commandName', storage: 'text', interpretation: 'plain', maxLength: 100, required: true },
    { name: 'fingerprint', storage: 'text', interpretation: 'plain', maxLength: 128, required: true },
    { name: 'resultRef', storage: 'text', interpretation: 'plain', maxLength: 120, required: true },
    { name: 'createdAt', storage: 'text', interpretation: 'plain', required: true },
  ],
  uniqueOn: ['actorUserId', 'operationId'],
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}
