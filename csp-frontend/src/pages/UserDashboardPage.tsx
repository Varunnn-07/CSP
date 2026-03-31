import { useEffect, useState } from 'react';
import { createQuery, getMyQueries, type QueryItem } from '../api/queries';
import { clearToken } from '../utils/auth';
import { useNavigate } from 'react-router-dom';

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const categories: Array<'Billing' | 'Technical' | 'Security' | 'Service' | 'General'> = [
  'Billing',
  'Technical',
  'Security',
  'Service',
  'General'
];

export function UserDashboardPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<QueryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [serviceName, setServiceName] = useState('CSP Gateway');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'Billing' | 'Technical' | 'Security' | 'Service' | 'General'>('Technical');

  async function loadMyQueries() {
    setLoading(true);
    setError('');
    try {
      const result = await getMyQueries();
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

  useEffect(() => {
    void loadMyQueries();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await createQuery({
        service_name: serviceName,
        subject,
        message,
        category
      });

      if (!result.success) {
        setError('Unable to create query');
        return;
      }

      setSubject('');
      setMessage('');
      await loadMyQueries();
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Unable to create query');
    } finally {
      setSaving(false);
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
          <h1 className="title" style={{ fontSize: 38 }}>User Dashboard</h1>
          <p className="subtitle">Raise and track your support queries.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/mfa/enable')}>Enable MFA</button>
          <button className="btn btn-ghost" onClick={() => void logout()}>Logout</button>
        </div>
      </div>

      {error ? <p className="error-text" style={{ marginBottom: 12 }}>{error}</p> : null}

      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="title" style={{ fontSize: 22, marginBottom: 14 }}>Create Query</h2>
        <form onSubmit={handleCreate}>
          <label className="label">Service Name</label>
          <input className="input" value={serviceName} onChange={(e) => setServiceName(e.target.value)} required />

          <div style={{ height: 10 }} />
          <label className="label">Subject</label>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required />

          <div style={{ height: 10 }} />
          <label className="label">Message</label>
          <textarea
            className="input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            required
            style={{ resize: 'vertical' }}
          />

          <div style={{ height: 10 }} />
          <label className="label">Category</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div style={{ height: 14 }} />
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Submitting...' : 'Submit Query'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h2 className="title" style={{ fontSize: 22, marginBottom: 14 }}>My Queries</h2>

        {loading ? <p className="subtitle">Loading...</p> : null}
        {!loading && items.length === 0 ? <p className="subtitle">No queries yet.</p> : null}

        {!loading && items.length > 0 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {items.map((q) => (
              <div key={q.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{q.subject}</strong>
                  <span className={statusClass(q.status)}>{q.status}</span>
                </div>
                <p style={{ margin: '8px 0 6px' }}>{q.message}</p>
                <p className="subtitle" style={{ fontSize: 13 }}>
                  {q.service_name} • {q.category} • Priority {q.priority}
                </p>
                {q.admin_reply ? (
                  <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 8 }}>
                    <strong>Admin Reply:</strong> {q.admin_reply}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
