import { useEffect, useMemo, useState } from 'react';
import { createFeedback, getMyFeedback, type FeedbackItem } from '../api/feedback';
import { Topbar } from '../components/Topbar';

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

export function Feedback() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [serviceName, setServiceName] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [message, setMessage] = useState('');

  const sortedFeedback = useMemo(
    () => [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [items]
  );

  async function loadFeedback() {
    setLoading(true);
    setError('');

    try {
      const response = await getMyFeedback();

      if (!response.success) {
        setError('Unable to load feedback history.');
        return;
      }

      setItems(response.data);
    } catch (err: unknown) {
      console.error('Feedback history request failed:', err);
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Unable to load feedback history.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFeedback();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (rating < 1 || rating > 5) {
      setError('Rating must be between 1 and 5.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await createFeedback({
        service_name: serviceName,
        rating,
        message
      });

      if (!response.success) {
        setError('Unable to submit feedback.');
        return;
      }

      setServiceName('');
      setRating(5);
      setMessage('');
      await loadFeedback();
    } catch (err: unknown) {
      console.error('Create feedback request failed:', err);
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Unable to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="section-stack">
      <Topbar
        title="Feedback"
        subtitle="Share service feedback and review your submissions"
      />

      {error ? <p className="error-text">{error}</p> : null}

      <section className="dashboard-card">
        <h2 className="title card-heading">Submit Feedback</h2>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="label" htmlFor="feedback-service">Service Name</label>
          <input
            id="feedback-service"
            className="input"
            value={serviceName}
            onChange={(event) => setServiceName(event.target.value)}
            required
          />

          <label className="label" htmlFor="feedback-rating">Rating</label>
          <select
            id="feedback-rating"
            className="input"
            value={rating}
            onChange={(event) => setRating(Number(event.target.value))}
            required
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} Star{value > 1 ? 's' : ''}
              </option>
            ))}
          </select>

          <label className="label" htmlFor="feedback-message">Message</label>
          <textarea
            id="feedback-message"
            className="input"
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
          />

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </section>

      <section className="dashboard-card">
        <h2 className="title card-heading">Feedback History</h2>

        {loading ? <p className="subtitle">Loading feedback...</p> : null}

        {!loading && !sortedFeedback.length ? (
          <p className="subtitle">No feedback submissions yet.</p>
        ) : null}

        {!loading && sortedFeedback.length ? (
          <ul className="feedback-list">
            {sortedFeedback.map((item) => (
              <li key={item.id} className="feedback-item">
                <div>
                  <p className="feedback-service">{item.service_name}</p>
                  <p className="subtitle">{item.message}</p>
                </div>
                <div className="feedback-meta">
                  <span className="badge badge-progress">{item.rating}/5</span>
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
