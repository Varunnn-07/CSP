import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { setOtpUserId } from '../utils/auth';

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin1@example.com');
  const [password, setPassword] = useState('TestPassword123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login({ email, password });

      if (!result.success || !result.userId) {
        setError(result.message || 'Login failed');
        return;
      }

      setOtpUserId(result.userId);
      navigate('/verify-otp');
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Unable to connect to server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: 460, padding: 24 }}>
        <h1 className="title" style={{ fontSize: 42, marginBottom: 8 }}>CSP Access</h1>
        <p className="subtitle" style={{ marginBottom: 20 }}>Secure sign-in with OTP verification.</p>

        <form onSubmit={handleSubmit}>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div style={{ height: 12 }} />

          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error ? <p className="error-text">{error}</p> : null}

          <div style={{ height: 16 }} />

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in...' : 'Continue to OTP'}
          </button>
        </form>
      </div>
    </div>
  );
}
