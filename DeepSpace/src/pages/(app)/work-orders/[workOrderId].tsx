import { FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuthProfileReady, useQuery } from 'deepspace'
import type { ChecklistItem, OrderAttachment, OrderComment, StaffProfile, WorkOrder } from '../../../domain/maintenance/types'
import { callMaintenanceAction, maintenanceAttachmentUrl, uploadMaintenanceAttachment } from '../../../lib/maintenance-actions'

export default function WorkOrderDetailPage() {
  const { workOrderId = '' } = useParams()
  const { user } = useAuthProfileReady({ requireUser: true })
  const { records: orders, status: orderStatus } = useQuery<WorkOrder>('work_orders', { limit: 100 })
  const { records: comments } = useQuery<OrderComment>('order_comments', { where: { workOrderId }, orderBy: 'postedAt', orderDir: 'asc', limit: 100 })
  const { records: attachments } = useQuery<OrderAttachment>('order_attachments', { where: { workOrderId }, orderBy: 'uploadedAt', orderDir: 'asc', limit: 3 })
  const { records: profiles } = useQuery<StaffProfile>('staff_profiles', { limit: 100 })
  const order = orders.find((item) => item.recordId === workOrderId)
  const profile = profiles.find((item) => item.recordId === user?.id)?.data
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState('')
  const [checklistDraft, setChecklistDraft] = useState<ChecklistItem[]>([])
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [downloadId, setDownloadId] = useState('')

  useEffect(() => { if (order) { setSummary(order.data.workSummary); setChecklistDraft(order.data.checklist) } }, [order?.recordId, order?.data.version])

  async function action(name: string, extra: Record<string, unknown> = {}) {
    if (!order) return false
    setBusy(true); setError(''); setMessage('')
    try { await callMaintenanceAction(name, { operationId: crypto.randomUUID(), workOrderId, expectedVersion: order.data.version, ...extra }); setMessage('Saved.'); return true }
    catch (value) { setError(value instanceof Error ? value.message : 'The action was rejected.'); return false }
    finally { setBusy(false) }
  }

  async function comment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const body = new FormData(form).get('body')
    if (typeof body !== 'string' || !body.trim()) return
    if (await action('addOrderComment', { body })) form.reset()
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!order) return
    const file = new FormData(event.currentTarget).get('file')
    if (!(file instanceof File) || !file.size) return
    setBusy(true); setError(''); setMessage('')
    try { await uploadMaintenanceAttachment(workOrderId, file, order.data.status === 'reported' ? 'Report evidence' : 'Repair evidence', crypto.randomUUID(), order.data.version); event.currentTarget.reset(); setMessage('Photo uploaded.') }
    catch (value) { setError(value instanceof Error ? value.message : 'The upload failed.') }
    finally { setBusy(false) }
  }

  async function saveSummary(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await action('updateWorkSummary', { workSummary: summary }) }
  async function saveChecklist(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await action('updateWorkChecklist', { checklist: checklistDraft }) }
  async function editReport(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); await action('editReportedWorkOrder', { title: data.get('title'), description: data.get('description') }) }
  async function savePriority(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); await action('setOrderPriorityAndDueDate', { priority: data.get('priority'), dueAt: data.get('dueAt') || '' }) }
  async function assign(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); await action('assignWorkOrder', { assignedToUserId: data.get('assignedToUserId'), reason: data.get('reason') || '' }) }
  async function download(id: string) { setDownloadId(id); setError(''); try { const url = await maintenanceAttachmentUrl(id); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60_000) } catch (value) { setError(value instanceof Error ? value.message : 'The photo could not be loaded.') } finally { setDownloadId('') } }

  if (!order) return <div className="dashboard-page"><Link className="back-link" to="/work-orders">← Work orders</Link><h1 className="route-state-title">{orderStatus === 'loading' ? 'Loading work order…' : 'Work order not found'}</h1></div>
  const isSupervisor = profile?.businessRole === 'supervisor'
  const isAssignedTechnician = profile?.businessRole === 'technician' && order.data.assignedToUserId === user?.id
  const canReportPhoto = order.data.status === 'reported' && ((order.data.reportedByUserId === user?.id && ['operator', 'technician'].includes(profile?.businessRole ?? '')) || isSupervisor)
  const canRepairPhoto = isAssignedTechnician && order.data.status === 'in_progress'
  const canUpload = canReportPhoto || canRepairPhoto
  const technicians = profiles.filter((item) => item.data.businessRole === 'technician' && !item.data.isDemo)
  const reasonFor = (allowed: boolean, reason: string) => allowed ? undefined : reason

  return <div className="dashboard-page">
    <title>{workOrderId} · MaintenanceFlow</title>
    <Link className="back-link" to="/work-orders">← Work orders</Link>
    <header className="page-header"><div><p className="eyebrow">{workOrderId} · version {order.data.version}</p><h1>{order.data.title}</h1><p className="page-subtitle">{order.data.status.replace('_', ' ')} · {order.data.priority} · {order.data.assetId}</p></div><span className="status-pill">{order.data.status}</span></header>
    {error && <p role="alert" aria-live="polite" className="form-message form-error">{error}</p>}{message && <p role="status" aria-live="polite" className="form-message">{message}</p>}
    <div className="detail-grid">
      <main>
        {isSupervisor && ['reported', 'assigned'].includes(order.data.status) && <ChecklistBuilder items={checklistDraft} setItems={setChecklistDraft} newItem={newChecklistItem} setNewItem={setNewChecklistItem} onSave={saveChecklist} busy={busy} origin="supervisor" />}
        <section className="detail-card"><h2>Work request</h2><p>{order.data.description}</p><dl className="detail-list"><div><dt>Reported by</dt><dd>{order.data.reportedByUserId}</dd></div><div><dt>Assigned to</dt><dd>{order.data.assignedToUserId || 'Unassigned'}</dd></div><div><dt>Due</dt><dd>{order.data.dueAt ? new Date(order.data.dueAt).toLocaleString('en-US', { timeZone: 'America/Lima' }) : 'No due date'}</dd></div></dl></section>
        {isSupervisor && order.data.status !== 'completed' && order.data.status !== 'cancelled' && <section className="detail-card"><h2>Supervisor controls</h2><form onSubmit={assign} className="compact-form"><label>Technician<select name="assignedToUserId" required defaultValue=""><option value="" disabled>Select active technician</option>{technicians.map((item) => <option key={item.recordId} value={item.recordId}>{item.data.displayName}</option>)}</select></label><label>Reason for reassignment<textarea name="reason" placeholder="Required when replacing an existing technician" /></label><button className="button button-primary" disabled={busy || order.data.status === 'awaiting_review'} title={reasonFor(order.data.status !== 'awaiting_review', 'Reassignment is unavailable during review')}>Assign technician</button></form><form onSubmit={savePriority} className="compact-form"><label>Priority<select name="priority" defaultValue={order.data.priority}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label><label>Due date<input type="datetime-local" name="dueAt" defaultValue={order.data.dueAt ? order.data.dueAt.slice(0, 16) : ''} /></label><button className="button" disabled={busy}>Save priority and due date</button></form></section>}
        {isSupervisor && order.data.status === 'reported' && <section className="detail-card"><h2>Edit report</h2><form onSubmit={editReport} className="compact-form"><label>Title<input name="title" defaultValue={order.data.title} required minLength={5} maxLength={120} /></label><label>Description<textarea name="description" defaultValue={order.data.description} required minLength={20} maxLength={3000} /></label><button className="button" disabled={busy}>Save report</button></form></section>}
        {isAssignedTechnician && ['assigned', 'blocked'].includes(order.data.status) && <button className="button button-primary" disabled={busy} onClick={() => void action('startWorkOrder')}>Start work</button>}
        {isAssignedTechnician && order.data.status === 'in_progress' && <button className="button" disabled={busy} onClick={() => void action('blockWorkOrder', { reason: 'Work paused pending a documented dependency.' })}>Block work</button>}
        {isAssignedTechnician && order.data.status === 'blocked' && <button className="button" disabled={busy} onClick={() => void action('resumeWorkOrder')}>Resume work</button>}
        {isSupervisor && order.data.status === 'awaiting_review' && <div className="button-row"><button className="button button-primary" disabled={busy} onClick={() => void action('approveWorkOrder')}>Approve completion</button><button className="button" disabled={busy} onClick={() => { const reason = window.prompt('Why should this be returned?'); if (reason) void action('returnWorkForChanges', { reason }) }}>Return for changes</button></div>}
        {isSupervisor && !['completed', 'cancelled'].includes(order.data.status) && <button className="button button-danger" disabled={busy} onClick={() => { const reason = window.prompt('Cancellation reason'); if (reason) void action('cancelWorkOrder', { reason }) }}>Cancel order</button>}
        <UnavailableActions role={profile?.businessRole} status={order.data.status} isAssignedTechnician={isAssignedTechnician} />
        {isAssignedTechnician && ['in_progress', 'blocked'].includes(order.data.status) && <section className="detail-card"><h2>Technician documentation</h2><form onSubmit={saveSummary} className="compact-form"><label>Work summary<textarea name="workSummary" value={summary} onChange={(event) => setSummary(event.target.value)} required minLength={30} maxLength={2000} /></label><button className="button" disabled={busy}>Save summary</button></form><form onSubmit={saveChecklist} className="compact-form"><fieldset><legend>Checklist</legend>{checklistDraft.map((item, index) => <label className="check-row" key={item.id}><input type="checkbox" checked={item.completed} onChange={(event) => setChecklistDraft((items) => items.map((candidate, itemIndex) => itemIndex === index ? { ...candidate, completed: event.target.checked } : candidate))} />{item.label}{item.origin === 'supervisor' && <small>Supervisor item</small>}</label>)}<div className="inline-form"><label>Add your checklist item<input value={newChecklistItem} onChange={(event) => setNewChecklistItem(event.target.value)} maxLength={160} /></label><button className="button" type="button" disabled={checklistDraft.length >= 8 || newChecklistItem.trim().length < 3} onClick={() => { setChecklistDraft((items) => [...items, { id: crypto.randomUUID(), label: newChecklistItem.trim(), completed: false, origin: 'technician' }]); setNewChecklistItem('') }}>Add item</button></div></fieldset><button className="button" disabled={busy}>Save checklist</button></form><button className="button button-primary" disabled={busy || checklistDraft.length === 0 || checklistDraft.some((item) => !item.completed) || summary.trim().length < 30 || attachments.filter((item) => item.data.kind === 'repair' && item.data.uploadedByUserId === user?.id).length < 1} title="Requires a completed checklist, a 30-character summary and a repair photo" onClick={() => void action('submitWorkForReview')}>Submit for review</button></section>}
        {canUpload && <section className="detail-card"><h2>{canRepairPhoto ? 'Repair evidence' : 'Report evidence'}</h2><p className="helper-text">JPEG, PNG or WebP up to 5 MiB. Evidence is private to signed-in workspace members.</p><form onSubmit={upload} className="inline-form"><label>Photo<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></label><button className="button" disabled={busy}>Upload photo</button></form></section>}
        {order.data.status === 'reported' && order.data.reportedByUserId === user?.id && <p className="helper-text">A report photo documents the issue; only a repair photo from the assigned technician can satisfy review.</p>}
        <section className="detail-card"><h2>Evidence ({attachments.length}/3)</h2><ul className="attachment-list">{attachments.map((item) => <li key={item.recordId}><span>{item.data.originalName} · {item.data.kind}</span><button className="button" onClick={() => void download(item.recordId)} disabled={downloadId === item.recordId}>{downloadId === item.recordId ? 'Loading…' : 'View private photo'}</button></li>)}</ul></section>
        <section className="detail-card"><h2>Comments</h2><form onSubmit={comment} className="compact-form"><label>Add a comment<textarea name="body" required maxLength={1000} /></label><button className="button" disabled={busy || ['completed', 'cancelled'].includes(order.data.status)}>Add comment</button></form><ol className="comment-list">{comments.map((item) => <li key={item.recordId}><p>{item.data.body}</p><small>{item.data.authorUserId} · {new Date(item.data.postedAt).toLocaleString('en-US', { timeZone: 'America/Lima' })}</small></li>)}</ol></section>
      </main>
      <aside><section className="detail-card"><h2>History</h2><ol className="history-list">{order.data.auditTrail.map((item) => <li key={item.id}><strong>{item.kind}</strong><span>{item.actorUserId}</span><small>{new Date(item.occurredAt).toLocaleString('en-US', { timeZone: 'America/Lima' })}</small></li>)}</ol></section></aside>
    </div>
  </div>
}

function ChecklistBuilder({ items, setItems, newItem, setNewItem, onSave, busy, origin }: { items: ChecklistItem[]; setItems: React.Dispatch<React.SetStateAction<ChecklistItem[]>>; newItem: string; setNewItem: (value: string) => void; onSave: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; origin: 'supervisor' | 'technician' }) {
  return <section className="detail-card"><h2>{origin === 'supervisor' ? 'Supervisor checklist' : 'Checklist'}</h2><form onSubmit={onSave} className="compact-form"><fieldset><legend>{origin === 'supervisor' ? 'Prepare the work checklist' : 'Complete the checklist'}</legend>{items.map((item, index) => <label className="check-row" key={item.id}><input type="checkbox" checked={item.completed} onChange={(event) => setItems((current) => current.map((candidate, itemIndex) => itemIndex === index ? { ...candidate, completed: event.target.checked } : candidate))} />{item.label}{item.origin === 'supervisor' && origin === 'technician' && <small>Supervisor item</small>}</label>)}<div className="inline-form"><label>Add checklist item<input value={newItem} onChange={(event) => setNewItem(event.target.value)} maxLength={160} /></label><button className="button" type="button" disabled={items.length >= 8 || newItem.trim().length < 3} onClick={() => { setItems((current) => [...current, { id: crypto.randomUUID(), label: newItem.trim(), completed: false, origin }]); setNewItem('') }}>Add item</button></div></fieldset><button className="button" disabled={busy}>Save checklist</button></form></section>
}

function UnavailableActions({ role, status, isAssignedTechnician }: { role: StaffProfile['businessRole'] | undefined; status: WorkOrder['status']; isAssignedTechnician: boolean }) {
  if (!role || ['completed', 'cancelled'].includes(status)) return null

  const actions: Array<{ label: string; reason: string; danger?: boolean }> = []
  if (role !== 'supervisor') {
    if (status === 'reported') actions.push({ label: 'Edit report', reason: 'Requires supervisor role.' })
    actions.push({ label: 'Assign technician', reason: 'Requires supervisor role.' })
    actions.push({ label: 'Save priority and due date', reason: 'Requires supervisor role.' })
    if (status === 'awaiting_review') {
      actions.push({ label: 'Approve completion', reason: 'Requires supervisor role.' })
      actions.push({ label: 'Return for changes', reason: 'Requires supervisor role.' })
    }
    actions.push({ label: 'Cancel order', reason: 'Requires supervisor role.', danger: true })
  }

  if (!isAssignedTechnician && status === 'assigned') actions.push({ label: 'Start work', reason: 'Requires the assigned technician.' })
  if (!isAssignedTechnician && status === 'in_progress') actions.push({ label: 'Block work', reason: 'Requires the assigned technician.' })
  if (!isAssignedTechnician && status === 'blocked') actions.push({ label: 'Resume work', reason: 'Requires the assigned technician.' })
  if (actions.length === 0) return null

  return <section className="detail-card action-availability"><h2>Unavailable actions</h2><p className="helper-text">These controls stay visible so the workflow and permission model are clear.</p><div className="disabled-action-list">{actions.map((action) => <div className="disabled-action" key={action.label}><button className={`button${action.danger ? ' button-danger' : ''}`} disabled aria-label={`${action.label}: ${action.reason}`}>{action.label}</button><span>{action.reason}</span></div>)}</div></section>
}
