import { useEffect, useMemo, useState } from 'react';
import { getDashboardFull, type DashboardFullData } from '../api/dashboard';
import { Topbar } from '../components/Topbar';

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

function resolveValue(value?: string | null): string {
  return value && value.trim() ? value : 'Not available';
}

export function Account() {
  const [dashboard, setDashboard] = useState<DashboardFullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError('');

      try {
        const dashboardData = await getDashboardFull();
        setDashboard(dashboardData);
      } catch (err: unknown) {
        console.error('Account profile request failed:', err);
        const apiError = err as ApiError;
        setError(apiError.response?.data?.message || 'Unable to load account details.');
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const usedStorage = dashboard?.usage.currentUsageGB ?? 0;
  const totalStorage = dashboard?.usage.storageLimitGB ?? 0;
  const remainingStorage = Math.max(totalStorage - usedStorage, 0);
  const usedPercentage = totalStorage > 0 ? Math.min((usedStorage / totalStorage) * 100, 100) : 0;

  const donutStyle = useMemo(() => ({
    background: `conic-gradient(#2f80ed ${usedPercentage}%, rgba(47, 128, 237, 0.16) 0)`
  }), [usedPercentage]);

  return (
    <div className="section-stack">
      <Topbar
        title="Account Details"
        subtitle="Profile, subscription and usage limits"
      />

      {error ? <p className="error-text">{error}</p> : null}

      <section className="dashboard-card profile-grid">
        <div>
          <h2 className="title card-heading">Profile</h2>
          <ul className="profile-list">
            <li><strong>Name:</strong> {resolveValue(dashboard?.user.name)}</li>
            <li><strong>Email:</strong> {resolveValue(dashboard?.user.email)}</li>
            <li><strong>Phone:</strong> {resolveValue(dashboard?.user.phone)}</li>
            <li><strong>Company:</strong> {resolveValue(dashboard?.user.companyName)}</li>
            <li><strong>Country:</strong> {resolveValue(dashboard?.user.country)}</li>
            <li><strong>Plan:</strong> {resolveValue(dashboard?.user.plan)}</li>
          </ul>
        </div>

        <div>
          <h2 className="title card-heading">Storage Usage</h2>
          {loading ? <p className="subtitle">Loading usage...</p> : null}

          {!loading ? (
            <div className="donut-shell">
              <div className="donut" style={donutStyle}>
                <div className="donut-center">{usedPercentage.toFixed(0)}%</div>
              </div>
              <div className="donut-legend">
                <p><strong>Total:</strong> {totalStorage ? `${totalStorage} GB` : 'Not available'}</p>
                <p><strong>Used:</strong> {usedStorage.toFixed(2)} GB</p>
                <p><strong>Remaining:</strong> {totalStorage ? `${remainingStorage.toFixed(2)} GB` : 'Not available'}</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="dashboard-card">
        <h2 className="title card-heading">Usage Limits</h2>
        <div className="metrics-grid">
          <article className="metric-card">
            <p className="metric-label">API Request Usage</p>
            <p className="metric-value">
              {loading ? '...' : `${dashboard?.usage.apiRequestsToday ?? 0}/${dashboard?.usage.apiLimitPerDay ?? 0}`}
            </p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Data Transfer Usage</p>
            <p className="metric-value">
              {loading
                ? '...'
                : `${(dashboard?.usage.dataTransferToday ?? 0).toFixed(2)} GB / ${(dashboard?.usage.dataTransferLimitGB ?? 0).toFixed(2)} GB`}
            </p>
          </article>
          <article className="metric-card">
            <p className="metric-label">Daily Storage Limit</p>
            <p className="metric-value">
              {loading ? '...' : `${(dashboard?.usage.dailyLimit ?? 0).toFixed(2)} GB`}
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
