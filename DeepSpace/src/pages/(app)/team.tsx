import { FormEvent, useState } from 'react'
import { useQuery } from 'deepspace'
import type { BusinessRole, StaffProfile } from '../../domain/maintenance/types'
import { callMaintenanceAction } from '../../lib/maintenance-actions'
import { TableSkeleton } from '../../components/PageSkeleton'

const roles: BusinessRole[] = ['operator', 'technician', 'supervisor']

export default function TeamPage() {
  const { records, status } = useQuery<StaffProfile>('staff_profiles', { orderBy: 'displayName', orderDir: 'asc', limit: 100 })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  async function seed() {
    setError('')
    try {
      const result = await callMaintenanceAction<{ assetCount: number; orderCount: number }>('seedDemoWorkspace', { operationId: crypto.randomUUID() })
      setMessage(`Seeded ${result.assetCount} assets and ${result.orderCount} work orders.`)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Only the app owner can seed demo data.')
    }
  }

  async function changeRole(event: FormEvent<HTMLFormElement>, recordId: string) {
    event.preventDefault(); setBusyId(recordId); setError('')
    const data = new FormData(event.currentTarget)
    try {
      await callMaintenanceAction('setStaffRole', { operationId: crypto.randomUUID(), targetUserId: recordId, businessRole: data.get('businessRole') })
      setMessage('Role updated.')
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Only the app owner can change roles.')
    } finally { setBusyId('') }
  }

  return <div className="dashboard-page"><header className="page-header"><div><p className="eyebrow">People & permissions</p><h1>Team</h1><p className="page-subtitle">Demo profiles are read-only sample records. Real roles are changed only by the app owner.</p></div><button className="button button-primary" onClick={seed}>Seed demo workspace</button></header>{message && <p role="status" className="form-message">{message}</p>}{error && <p role="alert" className="form-message form-error">{error}</p>}<section className="table-wrapper" aria-busy={status === 'loading'}>{status === 'loading' ? <TableSkeleton rows={5} /> : <table><caption>Maintenance team</caption><thead><tr><th scope="col">Member</th><th scope="col">Role</th><th scope="col">Demo record</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{records.map((record) => <tr key={record.recordId}><th scope="row">{record.data.displayName}</th><td data-label="Role">{record.data.businessRole}</td><td data-label="Demo record">{record.data.isDemo ? 'Yes' : 'No'}</td><td>{!record.data.isDemo && <form onSubmit={(event) => void changeRole(event, record.recordId)} className="inline-form"><label><span className="sr-only">Role for {record.data.displayName}</span><select name="businessRole" defaultValue={record.data.businessRole}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label><button className="button" disabled={busyId === record.recordId}>Save role</button></form>}</td></tr>)}</tbody></table>}{status !== 'loading' && records.length === 0 && <p className="empty-state">No profiles yet. Sign in to create your server profile.</p>}</section></div>
}
