import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from 'deepspace'
import type { Asset } from '../../../domain/maintenance/types'
import { callMaintenanceAction, uploadMaintenanceAttachment } from '../../../lib/maintenance-actions'

export default function NewWorkOrderPage() {
  const navigate = useNavigate()
  const { records: assets } = useQuery<Asset>('assets', { limit: 100 })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProgress(15)
    setError('')
    const form = new FormData(event.currentTarget)
    const operationId = crypto.randomUUID()

    try {
      const result = await callMaintenanceAction<{ recordId: string; version: number }>('createWorkOrder', {
        operationId,
        assetId: form.get('assetId'),
        title: form.get('title'),
        description: form.get('description'),
        maintenanceType: 'corrective',
        priority: form.get('priority'),
      })
      setProgress(55)
      const file = form.get('photo')
      if (file instanceof File && file.size) {
        await uploadMaintenanceAttachment(result.recordId, file, 'Initial report', crypto.randomUUID(), result.version)
      }
      setProgress(100)
      navigate(`/work-orders/${result.recordId}`)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not create work order.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">New maintenance request</p>
          <h1>Report an issue</h1>
          <p className="page-subtitle">Use sample images only; photos may contain location data. A supervisor sets the due date.</p>
        </div>
      </header>
      <form onSubmit={submit} className="form-grid work-order-form" aria-label="Report a maintenance issue">
        <label>
          Asset
          <select name="assetId" required defaultValue="">
            <option value="" disabled>Select equipment</option>
            {assets.map((asset) => <option key={asset.recordId} value={asset.recordId} disabled={!!asset.data.archivedAt}>{asset.data.assetCode} &middot; {asset.data.name}</option>)}
          </select>
        </label>
        <label>
          Priority
          <select name="priority" defaultValue="medium">
            <option>low</option>
            <option>medium</option>
            <option>high</option>
            <option>critical</option>
          </select>
        </label>
        <label className="field-span">
          Title
          <input name="title" required minLength={5} maxLength={120} />
        </label>
        <label className="field-span">
          Description
          <textarea name="description" required minLength={20} maxLength={3000} rows={5} />
        </label>
        <label>
          Private report photo
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" />
        </label>
        <button className="button button-primary work-order-submit" type="submit" disabled={busy}>
          {busy ? 'Saving\u2026' : 'Create work order'}
        </button>
        {busy && <progress className="work-order-progress" max="100" value={progress} aria-label="Saving report" />}
        {error && <p role="alert" className="form-message form-error work-order-error">{error}</p>}
      </form>
    </div>
  )
}
