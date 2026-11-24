import { Filter } from 'lucide-react'
import type { Priority, StaffProfile, WorkOrder } from '../domain/maintenance/types'
import { priorityLabels, statusLabels, type OrderFilters } from '../domain/maintenance/queue'

const statusOptions = Object.entries(statusLabels) as Array<[WorkOrder['status'], string]>
const priorityOptions = Object.entries(priorityLabels) as Array<[Priority, string]>

export function OrderFiltersBar({
  filters,
  setFilters,
  technicians,
}: {
  filters: OrderFilters
  setFilters: (next: OrderFilters) => void
  technicians: Array<{ recordId: string; data: StaffProfile }>
}) {
  return (
    <search className="filter-bar" aria-label="Work order filters">
      <label className="search-field">
        <span className="sr-only">Search work orders</span>
        <input
          type="search"
          value={filters.search}
          onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          placeholder="Search by order, title, or asset"
        />
      </label>
      <label className="select-field">
        <Filter size={15} aria-hidden="true" />
        <span className="sr-only">Filter by status</span>
        <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as OrderFilters['status'] })}>
          <option value="all">All statuses</option>
          {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="select-field">
        <span className="sr-only">Filter by priority</span>
        <select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value as OrderFilters['priority'] })}>
          <option value="all">All priorities</option>
          {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="select-field">
        <span className="sr-only">Filter by technician</span>
        <select value={filters.technician} onChange={(event) => setFilters({ ...filters, technician: event.target.value })}>
          <option value="all">All technicians</option>
          {technicians.map((technician) => <option key={technician.recordId} value={technician.recordId}>{technician.data.displayName}</option>)}
        </select>
      </label>
    </search>
  )
}
