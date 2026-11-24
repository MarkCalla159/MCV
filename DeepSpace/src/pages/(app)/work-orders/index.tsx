import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'deepspace'
import type { Asset, StaffProfile, WorkOrder } from '../../../domain/maintenance/types'
import {
  matchesOrderFilters,
  priorityLabels,
  statusLabels,
  WORK_ORDER_QUERY_LIMIT,
  workOrderServerWhere,
  type OrderFilters,
} from '../../../domain/maintenance/queue'
import { OrderFiltersBar } from '../../../components/OrderFiltersBar'
import { TableSkeleton } from '../../../components/PageSkeleton'

export default function WorkOrdersPage() {
  const [filters, setFilters] = useState<OrderFilters>({ search: '', status: 'all', priority: 'all', technician: 'all' })
  const deferredSearch = useDeferredValue(filters.search)
  const serverWhere = useMemo(
    () => workOrderServerWhere({ status: filters.status, priority: filters.priority, technician: filters.technician }),
    [filters.priority, filters.status, filters.technician],
  )
  const { records, status } = useQuery<WorkOrder>('work_orders', {
    where: serverWhere,
    orderBy: 'updatedAt',
    orderDir: 'desc',
    limit: WORK_ORDER_QUERY_LIMIT,
  })
  const { records: assets } = useQuery<Asset>('assets', { limit: 100 })
  const { records: profiles } = useQuery<StaffProfile>('staff_profiles', { limit: 100 })
  const assetCodes = useMemo(() => new Map(assets.map((asset) => [asset.recordId, asset.data.assetCode])), [assets])
  const technicians = profiles
    .filter((record) => record.data.businessRole === 'technician')
    .sort((left, right) => left.data.displayName.localeCompare(right.data.displayName))
  const clientFilters = useMemo(() => ({ ...filters, search: deferredSearch }), [deferredSearch, filters])
  const filteredRecords = useMemo(
    () => records.filter((record) => matchesOrderFilters(record, clientFilters, assetCodes.get(record.data.assetId) ?? record.data.assetId)),
    [assetCodes, clientFilters, records],
  )
  const truncated = records.length === WORK_ORDER_QUERY_LIMIT || assets.length === 100 || profiles.length === 100

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operational queue</p>
          <h1>Work orders</h1>
          <p className="page-subtitle">Report, assign, execute and review maintenance work.</p>
        </div>
        <Link className="button button-primary" to="/work-orders/new">Report an issue</Link>
      </header>
      <OrderFiltersBar filters={filters} setFilters={setFilters} technicians={technicians} />
      {truncated && status !== 'loading' && <p className="result-limit-notice" role="status">Results may be partial. Refine the filters to narrow the server query.</p>}
      <section className="table-wrapper" aria-busy={status === 'loading'}>
        {status === 'loading' ? <TableSkeleton rows={6} label="Loading work orders" /> : (
          <table>
            <caption>Maintenance work orders</caption>
            <thead><tr><th scope="col">Order</th><th scope="col">Asset</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Assignee</th><th scope="col">Version</th></tr></thead>
            <tbody>{filteredRecords.map((record) => <tr key={record.recordId}><th scope="row"><Link to={`/work-orders/${record.recordId}`} className="order-link">{record.recordId}</Link><span className="order-title">{record.data.title}</span></th><td data-label="Asset">{assetCodes.get(record.data.assetId) ?? record.data.assetId}</td><td data-label="Status">{statusLabels[record.data.status]}</td><td data-label="Priority"><span className={`priority priority-${record.data.priority}`}>{priorityLabels[record.data.priority]}</span></td><td data-label="Assignee">{record.data.assignedToUserId || 'Unassigned'}</td><td data-label="Version">{record.data.version}</td></tr>)}</tbody>
          </table>
        )}
        {status !== 'loading' && filteredRecords.length === 0 && <p className="empty-state">No orders match these filters.</p>}
      </section>
    </div>
  )
}
