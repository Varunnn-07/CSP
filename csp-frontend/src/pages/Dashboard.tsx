import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardFull, type DashboardFullData } from '../api/dashboard';
import { Topbar } from '../components/Topbar';
import { UsageChart } from '../components/UsageChart';

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

export function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardFullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const response = await getDashboardFull();
        setData(response);
      } catch (err: unknown) {
        console.error('Dashboard request failed:', err);
        const apiError = err as ApiError;
        setError(apiError.response?.data?.message || 'Unable to load dashboard data.');
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  const cards = useMemo(() => ({
    totalQueries: data?.stats.totalQueries ?? 0,
    resolvedQueries: data?.stats.resolvedQueriesCount ?? 0,
    feedbackCount: data?.stats.feedbackCount ?? 0
  }), [data]);

  return (
    <div className="section-stack">
      <Topbar
        title="Dashboard"
        subtitle={data?.user.name ? `Welcome back, ${data.user.name}` : 'Cloud usage and support activity overview'}
      />

      {error ? <p className="error-text">{error}</p> : null}

      <section className="metrics-grid">
        <article className="metric-card">
          <p className="metric-label">Total Queries</p>
          <p className="metric-value">{loading ? '...' : cards.totalQueries}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Resolved Queries</p>
          <p className="metric-value">{loading ? '...' : cards.resolvedQueries}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Feedback Submitted</p>
          <p className="metric-value">{loading ? '...' : cards.feedbackCount}</p>
        </article>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <p className="metric-label">Current Usage</p>
          <p className="metric-value">
            {loading ? '...' : `${(data?.usage.currentUsageGB ?? 0).toFixed(2)} GB`}
          </p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Usage Percentage</p>
          <p className="metric-value">
            {loading ? '...' : `${(data?.usage.usagePercentage ?? 0).toFixed(0)}%`}
          </p>
        </article>
        <article className="metric-card">
          <p className="metric-label">API Requests Today</p>
          <p className="metric-value">{loading ? '...' : data?.usage.apiRequestsToday ?? 0}</p>
        </article>
      </section>

      <UsageChart usage={data?.usage.history || []} />

      <section className="dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 className="title card-heading">Recent Queries</h2>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/dashboard/user/queries')}>
            View All
          </button>
        </div>

        {loading ? <p className="subtitle">Loading queries...</p> : null}

        {!loading && !(data?.queries.length) ? <p className="subtitle">No queries found.</p> : null}

        {!loading && data?.queries.length ? (
          <div className="table-wrap">
            <table className="query-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {data.queries.slice(0, 5).map((query) => (
                  <tr key={query.id}>
                    <td className="query-id-cell">{query.id.slice(0, 8)}</td>
                    <td>{query.subject}</td>
                    <td>{query.status}</td>
                    <td>{new Date(query.lastUpdated).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 className="title card-heading">Recent Feedback</h2>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/dashboard/user/feedback')}>
            View All
          </button>
        </div>

        {loading ? <p className="subtitle">Loading feedback...</p> : null}

        {!loading && !(data?.feedback.length) ? <p className="subtitle">No feedback found.</p> : null}

        {!loading && data?.feedback.length ? (
          <ul className="feedback-list">
            {data.feedback.slice(0, 5).map((item, index) => (
              <li
                key={`${item.createdAt}-${index}`}
                className="feedback-item"
              >
                <div>
                  <p className="feedback-service">{item.serviceName || 'Service Feedback'}</p>
                  <p className="subtitle">{item.message}</p>
                </div>
                <div className="feedback-meta">
                  {typeof item.rating === 'number' ? <span className="badge badge-progress">{item.rating}/5</span> : null}
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
