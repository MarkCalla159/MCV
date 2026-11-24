import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'deepspace'
import type { Asset } from '../../domain/maintenance/types'
import { callMaintenanceAction } from '../../lib/maintenance-actions'
import { TableSkeleton } from '../../components/PageSkeleton'

const categories = ['pump', 'compressor', 'generator', 'vehicle', 'other'] as const
const ASSET_QUERY_LIMIT = 100

export default function AssetsPage() {
  const { records, status } = useQuery<Asset>('assets', { orderBy: 'assetCode', orderDir: 'asc', limit: ASSET_QUERY_LIMIT })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [busyId, setBusyId] = useState('')

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaved('')
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      await callMaintenanceAction('createAsset', {
        operationId: crypto.randomUUID(),
        assetCode: data.get('assetCode'),
        name: data.get('name'),
        category: data.get('category'),
        location: data.get('location'),
        description: data.get('description'),
      })
      form.reset()
      setSaved('Asset created.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not create asset.')
    }
  }

  async function update(event: FormEvent<HTMLFormElement>, asset: { recordId: string; data: Asset }) {
    event.preventDefault()
    setError('')
    setSaved('')
    setBusyId(asset.recordId)
    const data = new FormData(event.currentTarget)
    try {
      await callMaintenanceAction('updateAsset', {
        operationId: crypto.randomUUID(),
        assetId: asset.recordId,
        assetCode: data.get('assetCode'),
        name: data.get('name'),
        category: data.get('category'),
        location: data.get('location'),
        description: data.get('description'),
      })
      setSaved(`${asset.data.assetCode} updated.`)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not update asset.')
    } finally {
      setBusyId('')
    }
  }

  async function archive(recordId: string) {
    setError('')
    setSaved('')
    setBusyId(recordId)
    try {
      await callMaintenanceAction('archiveAsset', { operationId: crypto.randomUUID(), assetId: recordId })
      setSaved('Asset archived.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not archive asset.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Maintenance registry</p>
          <h1>Assets</h1>
          <p className="page-subtitle">Create, edit and archive the equipment used by work orders.</p>
        </div>
      </header>
      <section className="action-section">
        <form onSubmit={create} className="form-grid" aria-label="Create asset">
          <label>Asset code<input name="assetCode" required minLength={2} maxLength={24} placeholder="PUMP-003" /></label>
          <label>Name<input name="name" required minLength={3} maxLength={80} /></label>
          <label>Category<select name="category" defaultValue="pump">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Location<input name="location" required maxLength={120} /></label>
          <label className="field-span">Description<textarea name="description" maxLength={500} /></label>
          <button className="button button-primary create-asset-button" type="submit">Create asset</button>
        </form>
      </section>
      {error && <p role="alert" className="form-message form-error">{error}</p>}
      {saved && <p role="status" className="form-message">{saved}</p>}
      {status !== 'loading' && records.length === ASSET_QUERY_LIMIT && <p className="result-limit-notice" role="status">Showing the first {ASSET_QUERY_LIMIT} assets. The DeepSpace records API does not expose cursor pagination.</p>}
      <section className="table-wrapper" aria-busy={status === 'loading'}>
        {status === 'loading' ? <TableSkeleton rows={5} label="Loading assets" /> : (
          <table>
            <caption>Registered equipment</caption>
            <thead><tr><th scope="col">Code</th><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Location</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{records.map((record) => (
              <tr key={record.recordId}>
                <th scope="row"><Link className="asset-link" to={`/assets/${record.recordId}`}>{record.data.assetCode}</Link></th>
                <td data-label="Name"><Link className="asset-name-link" to={`/assets/${record.recordId}`}>{record.data.name}</Link></td>
                <td data-label="Category">{record.data.category}</td>
                <td data-label="Location">{record.data.location}</td>
                <td data-label="Status">{record.data.archivedAt ? 'Archived' : 'Active'}</td>
                <td>{!record.data.archivedAt && <details><summary>Edit</summary><form onSubmit={(event) => update(event, { recordId: record.recordId, data: record.data })} className="compact-form"><label>Code<input name="assetCode" defaultValue={record.data.assetCode} required minLength={2} maxLength={24} /></label><label>Name<input name="name" defaultValue={record.data.name} required minLength={3} maxLength={80} /></label><label>Category<select name="category" defaultValue={record.data.category}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Location<input name="location" defaultValue={record.data.location} required maxLength={120} /></label><label>Description<textarea name="description" defaultValue={record.data.description} maxLength={500} /></label><button className="button" type="submit" disabled={busyId === record.recordId}>{busyId === record.recordId ? 'Saving…' : 'Save'}</button><button className="button button-danger" type="button" onClick={() => void archive(record.recordId)} disabled={busyId === record.recordId}>Archive</button></form></details>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {status !== 'loading' && records.length === 0 && <p className="empty-state">No assets yet.</p>}
      </section>
    </div>
  )
}
