import { Link, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import type { Asset, WorkOrder } from '../../../domain/maintenance/types'
import { priorityLabels, statusLabels, WORK_ORDER_QUERY_LIMIT } from '../../../domain/maintenance/queue'
import { TableSkeleton } from '../../../components/PageSkeleton'

export default function AssetDetailPage() {
  const { assetId = '' } = useParams()
  const { records: assets, status: assetStatus } = useQuery<Asset>('assets', { limit: 100 })
  const { records: orders, status: ordersStatus } = useQuery<WorkOrder>('work_orders', {
    where: { assetId },
    orderBy: 'updatedAt',
    orderDir: 'desc',
    limit: WORK_ORDER_QUERY_LIMIT,
  })
  const asset = assets.find((record) => record.recordId === assetId)

  if (!asset) {
    return (
      <div className="dashboard-page">
        <Link className="back-link" to="/assets">← Assets</Link>
        <h1 className="route-state-title">{assetStatus === 'loading' ? 'Loading asset…' : 'Asset not found'}</h1>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <title>{asset.data.assetCode} · MaintenanceFlow</title>
      <Link className="back-link" to="/assets">← Assets</Link>
      <header className="page-header">
        <div>
          <h1>{asset.data.name}</h1>
          <p className="page-subtitle">{asset.data.assetCode} · {asset.data.location}</p>
        </div>
        <span className="status-pill">{asset.data.archivedAt ? 'Archived' : 'Active'}</span>
      </header>
      <div className="detail-grid asset-detail-grid">
        <main>
          <section className="detail-card" aria-labelledby="asset-details-heading">
            <h2 id="asset-details-heading">Asset details</h2>
            <p>{asset.data.description || 'No description has been added.'}</p>
            <dl className="detail-list">
              <div><dt>Category</dt><dd>{asset.data.category}</dd></div>
              <div><dt>Location</dt><dd>{asset.data.location}</dd></div>
              <div><dt>Created by</dt><dd>{asset.data.createdByUserId}</dd></div>
            </dl>
          </section>
          <section className="detail-card" aria-labelledby="asset-history-heading">
            <div className="section-heading">
              <h2 id="asset-history-heading">Work order history</h2>
              <span className="queue-count">{ordersStatus === 'loading' ? 'Loading' : `${orders.length} orders`}</span>
            </div>
            {orders.length === WORK_ORDER_QUERY_LIMIT && <p className="result-limit-notice" role="status">Showing the newest {WORK_ORDER_QUERY_LIMIT} work orders for this asset.</p>}
            {ordersStatus === 'loading' ? <TableSkeleton rows={4} label="Loading asset work order history" /> : (
              <ol className="asset-order-list">
                {orders.map((order) => <li key={order.recordId}><div><Link className="order-link" to={`/work-orders/${order.recordId}`}>{order.recordId}</Link><strong>{order.data.title}</strong></div><div className="asset-order-meta"><span>{statusLabels[order.data.status]}</span><span className={`priority priority-${order.data.priority}`}>{priorityLabels[order.data.priority]}</span></div></li>)}
              </ol>
            )}
            {ordersStatus !== 'loading' && orders.length === 0 && <p className="empty-state">No work orders have been recorded for this asset.</p>}
          </section>
        </main>
        <aside>
          <section className="detail-card">
            <h2>Registry status</h2>
            <p className="helper-text">Asset ID</p>
            <p className="identifier-value">{asset.recordId}</p>
            {asset.data.archivedAt && <p className="helper-text">Archived {new Date(asset.data.archivedAt).toLocaleString('en-US', { timeZone: 'America/Lima' })}</p>}
          </section>
        </aside>
      </div>
    </div>
  )
}
