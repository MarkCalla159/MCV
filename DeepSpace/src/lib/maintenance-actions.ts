import { getAuthToken } from 'deepspace'

type ActionEnvelope<T> = { success: boolean; data?: T; error?: string }

async function tokenOrThrow(): Promise<string> {
  const token = await getAuthToken()
  if (!token) throw new Error('Sign in required')
  return token
}

export async function callMaintenanceAction<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const token = await tokenOrThrow()
  const response = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const payload = await response.json() as ActionEnvelope<T>
  if (!response.ok || !payload.success) throw new Error(payload.error ?? 'The action could not be completed')
  return payload.data as T
}

export async function uploadMaintenanceAttachment(workOrderId: string, file: File, caption: string, operationId: string, expectedVersion: number) {
  const token = await tokenOrThrow()
  const form = new FormData()
  form.set('file', file)
  form.set('caption', caption)
  form.set('operationId', operationId)
  form.set('expectedVersion', String(expectedVersion))
  const response = await fetch(`/api/maintenance/orders/${encodeURIComponent(workOrderId)}/attachments`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
  })
  const payload = await response.json() as ActionEnvelope<unknown>
  if (!response.ok || !payload.success) throw new Error(payload.error ?? 'The upload could not be completed')
  return payload.data
}

export async function maintenanceAttachmentUrl(attachmentId: string): Promise<string> {
  const token = await tokenOrThrow()
  const response = await fetch(`/api/maintenance/attachments/${encodeURIComponent(attachmentId)}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error('The attachment could not be loaded')
  return URL.createObjectURL(await response.blob())
}
