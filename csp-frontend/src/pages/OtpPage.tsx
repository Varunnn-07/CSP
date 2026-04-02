import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { verifyOtp } from '../api/authApi';
import { getApiErrorPayload } from '../api/client';
import { setToken } from '../utils/auth';

const otpSchema = z.object({
  otp: z.string().regex(/^[0-9]{6}$/, 'Enter a valid 6-digit code')
});

type OtpFormValues = z.infer<typeof otpSchema>;

type OtpRouteState = {
  userId?: string;
  preAuthToken?: string;
};

function formatOtpError(message?: string, remainingTime?: number) {
  if (typeof remainingTime === 'number' && remainingTime > 0) {
    return `${message || 'Too many OTP attempts. Try again later'} (${remainingTime}s remaining)`;
  }

  return message || 'Unable to connect to server';
}

function ShieldIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3L19 6V11.5C19 15.9 16.2 19.8 12 21C7.8 19.8 5 15.9 5 11.5V6L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 8V13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="16.2" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function OtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as OtpRouteState;
  const userId = state.userId || '';
  const preAuthToken = state.preAuthToken || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: ''
    }
  });

  function onAuthenticated(token: string) {
    setToken(token);
    navigate('/dashboard', { replace: true });
  }

  async function onSubmit(values: OtpFormValues) {
    setLoading(true);
    setError('');

    try {
      const result = await verifyOtp({
        userId,
        otp: values.otp,
        preAuthToken: preAuthToken || undefined
      });

      const token = result.accessToken || result.token;

      if (!result.success || !token) {
        setError(formatOtpError(result.message || 'OTP verification failed', result.remainingTime));
        return;
      }

      onAuthenticated(token);
    } catch (err: unknown) {
      console.error('OTP verification request failed:', err);
      const apiError = getApiErrorPayload(err);
      setError(formatOtpError(apiError.message, apiError.remainingTime));
    } finally {
      setLoading(false);
    }
  }

  if (!userId) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="auth-scene">
      <div className="auth-glow" aria-hidden="true" />
      <div className="auth-panel" style={{ width: 'min(100%, 440px)' }}>
        <div className="auth-icon">
          <ShieldIcon />
        </div>

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
          <p className="auth-note">Two-Factor Authentication</p>
          <input
            className="auth-input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter 6-digit code"
            aria-label="Enter 6-digit code"
            {...register('otp')}
          />
          {errors.otp ? <p className="error-text">{errors.otp.message}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        <button className="auth-link" type="button" onClick={() => navigate('/login', { replace: true })}>
          Back to login
        </button>
      </div>
    </div>
  );
}
