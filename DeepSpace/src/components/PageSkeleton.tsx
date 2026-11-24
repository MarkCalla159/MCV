export function PageSkeleton() {
  return (
    <div className="dashboard-page page-skeleton" role="status" aria-busy="true">
      <span className="sr-only">Loading workspace</span>
      <div className="skeleton skeleton-kicker" aria-hidden="true" />
      <div className="skeleton skeleton-title" aria-hidden="true" />
      <div className="skeleton skeleton-subtitle" aria-hidden="true" />
      <div className="skeleton skeleton-action" aria-hidden="true" />

      <section className="skeleton-section" aria-hidden="true">
        <div className="skeleton skeleton-section-title" />
        <div className="skeleton-metric-grid">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton-card"><span className="skeleton skeleton-icon" /><span className="skeleton skeleton-line skeleton-line-short" /><span className="skeleton skeleton-line skeleton-line-number" /></div>)}
        </div>
      </section>

      <section className="skeleton-section" aria-hidden="true">
        <div className="skeleton skeleton-section-title" />
        <div className="skeleton skeleton-table" />
      </section>
    </div>
  )
}

export function TableSkeleton({ rows = 5, label = 'Loading records' }: { rows?: number; label?: string }) {
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      <div className="table-skeleton" aria-hidden="true">
        {Array.from({ length: rows }, (_, row) => (
          <div className="table-skeleton-row" key={row}>
            <span className="skeleton skeleton-line skeleton-line-wide" />
            <span className="skeleton skeleton-line skeleton-line-medium" />
            <span className="skeleton skeleton-line skeleton-line-short" />
            <span className="skeleton skeleton-line skeleton-line-short" />
          </div>
        ))}
      </div>
    </div>
  )
}
