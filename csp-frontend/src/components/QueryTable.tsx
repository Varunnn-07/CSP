import type { QueryItem } from '../api/queries';

type QueryTableProps = {
  items: QueryItem[];
  loading: boolean;
  onView: (queryId: string) => void;
};

function badgeClass(status: QueryItem['status']) {
  if (status === 'Open') return 'badge badge-open';
  if (status === 'In Progress') return 'badge badge-progress';
  return 'badge badge-resolved';
}

export function QueryTable({ items, loading, onView }: QueryTableProps) {
  if (loading) {
    return <p className="subtitle">Loading queries...</p>;
  }

  if (!items.length) {
    return <p className="subtitle">No queries found.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="query-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Last Update</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((query) => (
            <tr key={query.id}>
              <td className="query-id-cell">{query.id.slice(0, 8)}</td>
              <td>{query.subject}</td>
              <td>
                <span className={badgeClass(query.status)}>{query.status}</span>
              </td>
              <td>{new Date(query.lastUpdated || query.last_updated || query.updated_at || query.created_at).toLocaleString()}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onView(query.id)}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
