import type { Context, Hono } from 'hono'
import type { AppContext } from '../../worker.js'
import { createActionTools } from './action-routes.js'
import { resolveAuth } from './http-routes.js'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function bearerToken(request: Request): string | null {
  const value = request.headers.get('Authorization') ?? ''
  return value.startsWith('Bearer ') ? value.slice(7) : null
}

function safeFilename(value: string): string {
  const normalized = value.normalize('NFKC').replace(/[\\/\u0000-\u001f]/g, '_').trim()
  return normalized.slice(0, 160) || 'evidence'
}

function extensionFor(type: string): string {
  return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
}

function matchesImageSignature(type: string, bytes: Uint8Array): boolean {
  if (type === 'image/png') return bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index])
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (type === 'image/webp') return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  return false
}

async function runAttachmentAction(
  c: Context<AppContext>,
  name: string,
  params: Record<string, unknown>,
  userId: string,
  callerJwt: string,
): Promise<Response> {
  const coordinator = c.env.MAINTENANCE_COORDINATOR.get(
    c.env.MAINTENANCE_COORDINATOR.idFromName(`app:${c.env.DEEPSPACE_APP_ID}`),
  )
  return coordinator.fetch(new Request('https://internal/maintenance/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, params, userId, callerJwt }),
  }))
}

export function registerMaintenanceFileRoutes(app: Hono<AppContext>): void {
  app.post('/api/maintenance/orders/:workOrderId/attachments', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    const token = bearerToken(c.req.raw)
    if (!auth || !token) return c.json({ error: 'Unauthorized' }, 401)
    if (!c.env.MAINTENANCE_EVIDENCE) {
      return c.json({ success: false, error: 'Private evidence storage is not available in this environment. Contact the app owner to enable R2 storage.' }, 503)
    }

    const workOrderId = c.req.param('workOrderId')
    const form = await c.req.raw.formData()
    const file = form.get('file')
    const operationId = String(form.get('operationId') ?? '')
    const expectedVersion = Number(form.get('expectedVersion'))
    const caption = String(form.get('caption') ?? '')
    if (!(file instanceof File) || !operationId || !Number.isInteger(expectedVersion)) {
      return c.json({ success: false, error: 'file, operationId and expectedVersion are required' }, 400)
    }
    if (!IMAGE_TYPES.has(file.type) || file.size < 1 || file.size > MAX_IMAGE_BYTES) {
      return c.json({ success: false, error: 'Only JPEG, PNG or WebP images up to 5 MiB are accepted' }, 400)
    }

    const preflight = await runAttachmentAction(c, 'authorizeAttachmentUpload', { workOrderId, expectedVersion, contentType: file.type, sizeBytes: file.size }, auth.userId, token)
    if (!preflight.ok) return new Response(preflight.body, { status: preflight.status, headers: preflight.headers })
    const preflightResult = await preflight.clone().json().catch(() => null) as { success?: boolean } | null
    if (!preflightResult?.success) return new Response(preflight.body, { status: 409, headers: preflight.headers })

    const originalName = safeFilename(file.name)
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!matchesImageSignature(file.type, bytes)) return c.json({ success: false, error: 'The file content does not match its image type' }, 400)
    const storageKey = `orders/${workOrderId}/${auth.userId}/${crypto.randomUUID()}.${extensionFor(file.type)}`
    await c.env.MAINTENANCE_EVIDENCE.put(storageKey, bytes, {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `inline; filename="${originalName.replace(/"/g, '_')}"`,
      },
    })

    const response = await runAttachmentAction(c, 'registerAttachment', {
      workOrderId,
      expectedVersion,
      storageKey,
      originalName,
      contentType: file.type,
      caption,
      sizeBytes: file.size,
      operationId,
    }, auth.userId, token)
    const result = await response.clone().json().catch(() => null) as { success?: boolean; data?: { replayed?: boolean } } | null
    if (!response.ok || result?.success === false || result?.data?.replayed) await c.env.MAINTENANCE_EVIDENCE.delete(storageKey)
    return new Response(response.body, { status: response.status, headers: response.headers })
  })

  app.get('/api/maintenance/attachments/:attachmentId', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Unauthorized' }, 401)
    const token = bearerToken(c.req.raw)
    if (!token) return c.json({ error: 'Unauthorized' }, 401)
    if (!c.env.MAINTENANCE_EVIDENCE) {
      return c.json({ error: 'Private evidence storage is not available in this environment.' }, 503)
    }
    const tools = createActionTools(c.env, auth.userId, token)
    const attachment = await tools.get<any>('order_attachments', c.req.param('attachmentId'))
    if (!attachment.success) return c.json({ error: 'Attachment not found' }, 404)
    const record = await c.env.MAINTENANCE_EVIDENCE.get(attachment.data.record.data.storageKey)
    if (!record) return c.json({ error: 'File not found' }, 404)
    const headers = new Headers()
    headers.set('Content-Type', attachment.data.record.data.contentType)
    headers.set('Cache-Control', 'private, no-store')
    headers.set('Content-Disposition', `inline; filename="${safeFilename(attachment.data.record.data.originalName).replace(/"/g, '_')}"`)
    headers.set('X-Content-Type-Options', 'nosniff')
    return new Response(record.body, { headers })
  })
}
