import type { ActionResult } from 'deepspace/worker'
import type { AssetCategory, BusinessRole, ChecklistItem, OrderStatus, Priority } from './types'

export type DomainFailure = { success: false; error: string }

export const fail = (code: string, message: string): DomainFailure => ({ success: false, error: `${code}: ${message}` })

export function text(value: unknown, field: string, maxLength: number): string | DomainFailure {
  if (typeof value !== 'string') return fail('validation_failed', `${field} is required`)
  const result = value.trim()
  if (!result) return fail('validation_failed', `${field} is required`)
  if (result.length > maxLength) return fail('validation_failed', `${field} exceeds ${maxLength} characters`)
  return result
}

export function textRange(value: unknown, field: string, minLength: number, maxLength: number): string | DomainFailure {
  const result = text(value, field, maxLength)
  if (typeof result !== 'string') return result
  if (result.length < minLength) return fail('validation_failed', `${field} must be at least ${minLength} characters`)
  return result
}

export function optionalText(value: unknown, field: string, maxLength: number): string | DomainFailure {
  if (value === undefined || value === null || value === '') return ''
  return text(value, field, maxLength)
}

export function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[]): T | DomainFailure {
  if (typeof value === 'string' && allowed.includes(value as T)) return value as T
  return fail('validation_failed', `${field} is invalid`)
}

export function integer(value: unknown, field: string, min: number): number | DomainFailure {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) return fail('validation_failed', `${field} must be an integer >= ${min}`)
  return value
}

export function isoDateOrEmpty(value: unknown, field: string): string | DomainFailure {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return fail('validation_failed', `${field} must be an ISO date`)
  return new Date(value).toISOString()
}

export const businessRoles = ['operator', 'technician', 'supervisor'] as const satisfies readonly BusinessRole[]
export const assetCategories = ['pump', 'compressor', 'generator', 'vehicle', 'other'] as const satisfies readonly AssetCategory[]
export const priorities = ['low', 'medium', 'high', 'critical'] as const satisfies readonly Priority[]
export const statuses = ['reported', 'assigned', 'in_progress', 'blocked', 'awaiting_review', 'completed', 'cancelled'] as const satisfies readonly OrderStatus[]

export function checklist(value: unknown): ChecklistItem[] | DomainFailure {
  if (!Array.isArray(value) || value.length > 8) return fail('validation_failed', 'checklist must contain at most 8 items')
  const result: ChecklistItem[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return fail('validation_failed', 'checklist item is invalid')
    const candidate = item as Record<string, unknown>
    const id = text(candidate.id, 'checklist.id', 80)
    const label = textRange(candidate.label, 'checklist.label', 3, 160)
    const origin = enumValue(candidate.origin, 'checklist.origin', ['supervisor', 'technician'] as const)
    if (typeof id !== 'string' || typeof label !== 'string' || typeof origin !== 'string' || typeof candidate.completed !== 'boolean') return fail('validation_failed', 'checklist item is invalid')
    result.push({ id, label, origin, completed: candidate.completed })
  }
  return result
}

export function isFailure(value: string | number | ChecklistItem[] | DomainFailure): value is DomainFailure {
  return typeof value === 'object' && value !== null && 'success' in value && value.success === false
}

export function actionFailure<T>(value: string | number | ChecklistItem[] | DomainFailure): ActionResult<T> | null {
  return isFailure(value) ? value : null
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}
