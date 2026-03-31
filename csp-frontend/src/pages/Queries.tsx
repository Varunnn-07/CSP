import { useEffect, useMemo, useState } from 'react';
import {
  createQuery,
  getMyQueries,
  getQueryById,
  replyToOwnQuery,
  type QueryItem
} from '../api/queries';
import { QueryTable } from '../components/QueryTable';
import { Topbar } from '../components/Topbar';

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

export function Queries() {
  const [queries, setQueries] = useState<QueryItem[]>([]);
  const [selected, setSelected] = useState<QueryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState('');

  const [serviceName, setServiceName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'Billing' | 'Technical' | 'Security' | 'Service' | 'General'>('Technical');
  const [reply, setReply] = useState('');

  const sortedQueries = useMemo(
    () =>
      [...queries].sort(
        (a, b) =>
          new Date(b.lastUpdated || b.last_updated || b.updated_at || b.created_at).getTime() -
          new Date(a.lastUpdated || a.last_updated || a.updated_at || a.created_at).getTime()
      ),
    [queries]
  );

  async function loadQueries() {
    setLoading(true);
    setError('');

    try {
      const response = await getMyQueries();

      if (!response.success) {
        setError('Unable to load queries.');
        return;
      }

      setQueries(response.data);
    } catch (err: unknown) {
      console.error('Query list request failed:', err);
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Unable to load queries.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueries();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const response = await createQuery({
        service_name: serviceName,
        subject,
        message,
        category
      });

      if (!response.success) {
        setError('Unable to create query.');
        return;
      }

      setServiceName('');
      setSubject('');
      setMessage('');
      await loadQueries();
    } catch (err: unknown) {
      console.error('Create query request failed:', err);
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Unable to create query.');
    } finally {
      setCreating(false);
    }
  }

  async function handleView(queryId: string) {
    setError('');

    try {
      const response = await getQueryById(queryId);
      if (!response.success) {
        setError('Unable to load query details.');
        return;
      }

      setSelected(response.data);
      setReply('');
    } catch (err: unknown) {
      console.error('Query detail request failed:', err);
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Unable to load query details.');
    }
  }

  async function handleReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selected) {
      return;
    }

    setReplying(true);
    setError('');

    try {
      const response = await replyToOwnQuery(selected.id, reply.trim());
      if (!response.success) {
        setError('Unable to post query reply.');
        return;
      }

      setReply('');
      await Promise.all([loadQueries(), handleView(selected.id)]);
    } catch (err: unknown) {
      console.error('Query reply request failed:', err);
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Unable to post query reply.');
    } finally {
      setReplying(false);
    }
  }

  return (
    <div className="section-stack">
      <Topbar
        title="Queries"
        subtitle="Create, track, and review support requests"
      />

      {error ? <p className="error-text">{error}</p> : null}

      <section className="dashboard-card">
        <h2 className="title card-heading">Create New Query</h2>

        <form className="form-grid" onSubmit={handleCreate}>
          <label className="label" htmlFor="query-service">Service Name</label>
          <input
            id="query-service"
            className="input"
            value={serviceName}
            onChange={(event) => setServiceName(event.target.value)}
            required
          />

          <label className="label" htmlFor="query-subject">Subject</label>
          <input
            id="query-subject"
            className="input"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
          />

          <label className="label" htmlFor="query-message">Message</label>
          <textarea
            id="query-message"
            className="input"
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
          />

          <label className="label" htmlFor="query-category">Category</label>
          <select
            id="query-category"
            className="input"
            value={category}
            onChange={(event) => setCategory(event.target.value as typeof category)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Submitting...' : 'Post Query'}
          </button>
        </form>
      </section>

      <section className="dashboard-card">
        <h2 className="title card-heading">My Queries</h2>
        <QueryTable items={sortedQueries} loading={loading} onView={handleView} />
      </section>

      {selected ? (
        <section className="dashboard-card">
          <h2 className="title card-heading">Query Details</h2>
          <p><strong>Subject:</strong> {selected.subject}</p>
          <p><strong>Status:</strong> {selected.status}</p>
          <p><strong>Message:</strong> {selected.message}</p>
          {selected.admin_reply ? (
            <p><strong>Latest Reply:</strong> {selected.admin_reply}</p>
          ) : (
            <p className="subtitle">No reply yet for this query.</p>
          )}

          <form className="form-grid" onSubmit={handleReply}>
            <label className="label" htmlFor="query-reply">Reply</label>
            <textarea
              id="query-reply"
              className="input"
              rows={3}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              required
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={replying || !reply.trim()}
            >
              {replying ? 'Sending...' : 'Send Reply'}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
