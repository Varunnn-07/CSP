import { useEffect, useState } from 'react';
import {
  getAllQueries,
  getSecurityEvents,
  replyToQuery,
  updateQueryStatus,
  type BlockedIp,
  type FailedLoginAttempt,
  type QueryItem,
  type SecurityAuditLog
} from '../api/queries';
import { clearToken } from '../utils/auth';
import { useNavigate } from 'react-router-dom';

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

type StatusType = 'Open' | 'In Progress' | 'Resolved';

const statuses: StatusType[] = ['Open', 'In Progress', 'Resolved'];

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<QueryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const [securityLoading, setSecurityLoading] = useState(true);
  const [securityError, setSecurityError] = useState('');
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<FailedLoginAttempt[]>([]);
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const result = await getAllQueries();
      if (!result.success) {
        setError('Unable to load queries');
        return;
      }
      setItems(result.data);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Unable to load queries');
    } finally {
      setLoading(false);
    }
  }

  async function loadSecurityEvents() {
    setSecurityLoading(true);
    setSecurityError('');

    try {
      const result = await getSecurityEvents();

      if (!result.success) {
        setSecurityError('Unable to load security events');
        return;
      }

      setAuditLogs(result.data.recentAuditLogs);
      setFailedAttempts(result.data.failedLoginAttempts);
      setBlockedIps(result.data.blockedIps);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setSecurityError(apiError.response?.data?.message || 'Unable to load security events');
    } finally {
      setSecurityLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([loadAll(), loadSecurityEvents()]);
  }, []);

  async function onStatusChange(id: string, status: StatusType) {
    setError('');
    try {
      await updateQueryStatus(id, status);
      await Promise.all([loadAll(), loadSecurityEvents()]);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Unable to update status');
    }
  }

  async function onReplySubmit(id: string) {
    const reply = replyDrafts[id]?.trim();
    if (!reply) return;

    setError('');
    try {
      await replyToQuery(id, reply);
      setReplyDrafts((prev) => ({ ...prev, [id]: '' }));
      await Promise.all([loadAll(), loadSecurityEvents()]);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Unable to post reply');
    }
  }

  function logout() {
    clearToken();
    navigate('/login');
  }

  function statusClass(status: QueryItem['status']) {
    if (status === 'Open') return 'badge badge-open';
    if (status === 'In Progress') return 'badge badge-progress';
    return 'badge badge-resolved';
  }

  return (
    <div className="page-shell dashboard-shell">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h1 className="title" style={{ fontSize: 38 }}>Admin Dashboard</h1>
          <p className="subtitle">Review, prioritize, and resolve user queries.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/mfa/enable')}>Enable MFA</button>
          <button className="btn btn-ghost" onClick={() => void logout()}>Logout</button>
        </div>
      </div>

      {error ? <p className="error-text" style={{ marginBottom: 12 }}>{error}</p> : null}

      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="title" style={{ fontSize: 22, marginBottom: 14 }}>All Queries</h2>

        {loading ? <p className="subtitle">Loading...</p> : null}
        {!loading && items.length === 0 ? <p className="subtitle">No queries found.</p> : null}

        {!loading && items.length > 0 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {items.map((q) => (
              <div key={q.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <strong>{q.subject}</strong>
                    <p className="subtitle" style={{ fontSize: 13, margin: '4px 0 0' }}>
                      {q.service_name} • {q.category} • Priority {q.priority}
                    </p>
                  </div>
                  <span className={statusClass(q.status)}>{q.status}</span>
                </div>

                <p style={{ margin: '10px 0' }}>{q.message}</p>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <select
                    className="input"
                    style={{ maxWidth: 180 }}
                    value={q.status}
                    onChange={(e) => onStatusChange(q.id, e.target.value as StatusType)}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    placeholder="Write admin reply..."
                    value={replyDrafts[q.id] || ''}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  />
                  <button className="btn btn-primary" onClick={() => void onReplySubmit(q.id)}>
                    Reply
                  </button>
                </div>

                {q.admin_reply ? (
                  <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 8 }}>
                    <strong>Current Reply:</strong> {q.admin_reply}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h2 className="title" style={{ fontSize: 22, marginBottom: 14 }}>Security Events</h2>
        {securityError ? <p className="error-text" style={{ marginBottom: 12 }}>{securityError}</p> : null}
        {securityLoading ? <p className="subtitle">Loading security telemetry...</p> : null}

        {!securityLoading ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <h3 className="title" style={{ fontSize: 18, marginBottom: 8 }}>Active Blocked IPs</h3>
              {blockedIps.length === 0 ? (
                <p className="subtitle">No active IP blocks.</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {blockedIps.slice(0, 8).map((entry) => (
                    <div key={entry.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
                      <strong>{entry.ip}</strong>
                      <p className="subtitle" style={{ fontSize: 13 }}>
                        Until {new Date(entry.blocked_until).toLocaleString()} {entry.reason ? `• ${entry.reason}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="title" style={{ fontSize: 18, marginBottom: 8 }}>Failed Logins (24h)</h3>
              {failedAttempts.length === 0 ? (
                <p className="subtitle">No failed attempts recorded.</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {failedAttempts.slice(0, 8).map((entry) => (
                    <div key={`${entry.ip}-${entry.last_failed_at}`} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
                      <strong>{entry.ip}</strong>
                      <p className="subtitle" style={{ fontSize: 13 }}>
                        {entry.failed_count} failures • Last: {new Date(entry.last_failed_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="title" style={{ fontSize: 18, marginBottom: 8 }}>Recent Audit Logs</h3>
              {auditLogs.length === 0 ? (
                <p className="subtitle">No audit events yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {auditLogs.slice(0, 10).map((entry) => (
                    <div key={entry.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
                      <strong>{entry.event_type}</strong>
                      <p className="subtitle" style={{ fontSize: 13 }}>
                        {entry.severity.toUpperCase()} • {entry.status} • {entry.ip || 'n/a'} • {new Date(entry.event_timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
