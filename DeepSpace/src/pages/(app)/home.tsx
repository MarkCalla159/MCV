import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuthProfileReady, useQuery } from 'deepspace'
import { ArrowUpRight, ClipboardCheck, Clock3, Plus, ShieldCheck, Wrench } from 'lucide-react'
import type { Asset, StaffProfile, WorkOrder } from '../../domain/maintenance/types'
import {
  isOverdueOrder,
  isTerminalOrder,
  matchesOrderFilters,
  needsActionForRole,
  priorityLabels,
  queueLabel,
  statusLabels,
  WORK_ORDER_QUERY_LIMIT,
  workOrderServerWhere,
  type OrderFilters,
} from '../../domain/maintenance/queue'
import { OrderFiltersBar } from '../../components/OrderFiltersBar'
import { TableSkeleton } from '../../components/PageSkeleton'

export default function HomePage() {
  const { user } = useAuthProfileReady({ requireUser: true })
  const [filters, setFilters] = useState<OrderFilters>({ search: '', status: 'all', priority: 'all', technician: 'all' })
  const [now, setNow] = useState(() => Date.now())
  const deferredSearch = useDeferredValue(filters.search)

  const { records: orders, status } = useQuery<WorkOrder>('work_orders', {
    orderBy: 'updatedAt',
    orderDir: 'desc',
    limit: WORK_ORDER_QUERY_LIMIT,
  })
  const { records: assets, status: assetsStatus } = useQuery<Asset>('assets', { limit: 100 })
  const { records: profiles, status: profilesStatus } = useQuery<StaffProfile>('staff_profiles', { limit: 100 })
  const { records: currentProfiles, status: currentProfileStatus } = useQuery<StaffProfile>('staff_profiles', {
    where: { userId: user?.id ?? '__profile_pending__' },
    limit: 1,
  })
  const profile = currentProfiles[0]?.data
  const queueWhere = useMemo(
    () => workOrderServerWhere(
      { status: filters.status, priority: filters.priority, technician: filters.technician },
      { role: profile?.businessRole, userId: user?.id },
    ),
    [filters.priority, filters.status, filters.technician, profile?.businessRole, user?.id],
  )
  const { records: roleQueue, status: queueStatus } = useQuery<WorkOrder>('work_orders', {
    where: queueWhere,
    orderBy: 'updatedAt',
    orderDir: 'desc',
    limit: WORK_ORDER_QUERY_LIMIT,
  })

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const loading = status === 'loading' || assetsStatus === 'loading'
  const queueLoading = currentProfileStatus === 'loading' || profilesStatus === 'loading' || queueStatus === 'loading'
  const assetCodes = useMemo(() => new Map(assets.map((asset) => [asset.recordId, asset.data.assetCode])), [assets])
  const profileReady = currentProfileStatus === 'ready' && !!profile?.businessRole
  const technicians = profiles
    .filter((record) => record.data.businessRole === 'technician')
    .sort((left, right) => left.data.displayName.localeCompare(right.data.displayName))
  const assetCode = (id: string) => assetCodes.get(id) ?? id

  const open = useMemo(() => orders.filter((order) => !isTerminalOrder(order)), [orders])
  const overdue = useMemo(() => open.filter((order) => isOverdueOrder(order, now)).length, [open, now])
  const queueOrders = useMemo(() => {
    if (!profile?.businessRole || !user?.id) return []
    return roleQueue.filter((order) => needsActionForRole(order, profile.businessRole, user.id, now))
  }, [profile?.businessRole, roleQueue, user?.id, now])
  const clientFilters = useMemo(() => ({ ...filters, search: deferredSearch }), [deferredSearch, filters])
  const filtered = useMemo(
    () => queueOrders.filter((order) => matchesOrderFilters(order, clientFilters, assetCode(order.data.assetId))),
    [assetCodes, clientFilters, queueOrders],
  )
  const overviewTruncated = orders.length === WORK_ORDER_QUERY_LIMIT
  const queueTruncated = roleQueue.length === WORK_ORDER_QUERY_LIMIT
  const referenceDataTruncated = assets.length === 100 || profiles.length === 100

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Shared demo workspace · sample data only</p>
          <h1>Good morning{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
          <p className="page-subtitle">Track issues, repairs and approvals across the maintenance workspace.</p>
        </div>
        <Link to="/work-orders/new" className="button button-primary"><Plus size={17} aria-hidden="true" /> Report an issue</Link>
      </header>

      <section aria-labelledby="overview-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Overview</p><h2 id="overview-heading">Operations at a glance</h2></div>
          <span className="sync-state"><span className="sync-dot" /> {loading ? 'Loading records' : 'Live records'}</span>
        </div>
        <div className="metrics-grid">
          <Metric label="Open work orders" value={String(open.length)} detail="All non-terminal orders" icon={<ClipboardCheck />} accent="teal" loading={loading} />
          <Metric label="Blocked" value={String(orders.filter((order) => order.data.status === 'blocked').length)} detail="Need a dependency resolved" icon={<Wrench />} accent="red" loading={loading} />
          <Metric label="Awaiting review" value={String(orders.filter((order) => order.data.status === 'awaiting_review').length)} detail="Need supervisor attention" icon={<ShieldCheck />} accent="violet" loading={loading} />
          <Metric label="Overdue" value={String(overdue)} detail="Refreshes every minute" icon={<Clock3 />} accent="amber" loading={loading} />
        </div>
        {!loading && overviewTruncated && <p className="result-limit-notice" role="status">Overview totals cover the newest {WORK_ORDER_QUERY_LIMIT} work orders.</p>}
      </section>

      <section className="action-section" aria-labelledby="action-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Queue</p><h2 id="action-heading">{queueLabel(profile?.businessRole, profileReady)}</h2></div>
          <span className="queue-count">{queueLoading ? 'Loading' : `${filtered.length} shown`}</span>
        </div>
        <OrderFiltersBar filters={filters} setFilters={setFilters} technicians={technicians} />
        {(queueTruncated || referenceDataTruncated) && !queueLoading && <p className="result-limit-notice" role="status">Results may be partial. Refine the filters to narrow the server query.</p>}
        <div className="table-wrapper" tabIndex={0} role="region" aria-labelledby="work-orders-caption" aria-busy={queueLoading}>
          {queueLoading ? <TableSkeleton rows={5} label="Loading your work order queue" /> : (
            <table>
              <caption id="work-orders-caption">Work orders requiring attention</caption>
              <thead><tr><th scope="col">Work order</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Assignee</th><th scope="col">Due</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
              <tbody>{filtered.map((order) => <tr key={order.recordId}><th scope="row"><Link to={`/work-orders/${order.recordId}`} className="order-link">{order.recordId}<ArrowUpRight size={14} aria-hidden="true" /></Link><span className="order-title">{order.data.title}</span><span className="order-asset">{assetCode(order.data.assetId)}</span></th><td data-label="Status"><span className="status"><span className="status-marker" />{statusLabels[order.data.status]}</span></td><td data-label="Priority"><span className={`priority priority-${order.data.priority}`}>{priorityLabels[order.data.priority]}</span></td><td data-label="Assignee">{order.data.assignedToUserId || 'Unassigned'}</td><td data-label="Due">{order.data.dueAt ? new Date(order.data.dueAt).toLocaleDateString('en-US', { timeZone: 'America/Lima' }) : '—'}</td><td className="row-action"><Link to={`/work-orders/${order.recordId}`} aria-label={`Open ${order.recordId}`}>View</Link></td></tr>)}</tbody>
            </table>
          )}
          {!queueLoading && filtered.length === 0 && <p className="empty-state">No work orders match these filters.</p>}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, detail, icon, accent, loading = false }: { label: string; value: string; detail: string; icon: ReactNode; accent: string; loading?: boolean }) {
  return <article className="metric-card">{loading ? <><span className="skeleton skeleton-icon" aria-hidden="true" /><div><span className="skeleton skeleton-line skeleton-line-short" /><span className="skeleton skeleton-line skeleton-line-number" /></div></> : <><div className={`metric-icon metric-${accent}`}>{icon}</div><div><p className="metric-label">{label}</p><p className="metric-value">{value}</p><p className="metric-detail">{detail}</p></div></>}</article>
}
