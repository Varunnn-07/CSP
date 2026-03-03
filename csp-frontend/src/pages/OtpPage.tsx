import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyOtp } from '../api/auth';
import { clearOtpUserId, getOtpUserId, getTokenRole, setToken } from '../utils/auth';

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

export function OtpPage() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const userId = getOtpUserId();
    if (!userId) {
      setError('Session expired. Please login again.');
      setLoading(false);
      return;
    }

    try {
      const result = await verifyOtp({ userId, otp });

      if (!result.success || !result.data?.token) {
        setError(result.message || 'OTP verification failed');
        return;
      }

      const token = result.data.token;
      setToken(token);
      clearOtpUserId();

      const role = getTokenRole(token);
      if (role === 'admin') {
        navigate('/dashboard/admin');
        return;
      }

      if (role === 'user') {
        navigate('/dashboard/user');
        return;
      }

      setError('Invalid role in token');
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Unable to verify OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: 460, padding: 24 }}>
        <h1 className="title" style={{ fontSize: 36, marginBottom: 8 }}>Verify OTP</h1>
        <p className="subtitle" style={{ marginBottom: 20 }}>Enter the 6-digit code from backend console (dev mode).</p>

        <form onSubmit={handleSubmit}>
          <label className="label" htmlFor="otp">One-time Password</label>
          <input
            id="otp"
            className="input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            required
          />

          {error ? <p className="error-text">{error}</p> : null}

          <div style={{ height: 16 }} />

          <button className="btn btn-primary" type="submit" disabled={loading || otp.length !== 6} style={{ width: '100%' }}>
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
