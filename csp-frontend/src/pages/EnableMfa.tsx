import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { setupMfa, verifyMfaSetup } from '../api/authApi';
import { getApiErrorPayload } from '../api/client';
import { getToken, getTokenRole, getTokenUserId, setToken } from '../utils/auth';

const formSchema = z.object({
  otp: z.string().regex(/^[0-9]{6}$/, 'Enter a valid 6-digit code')
});

type FormValues = z.infer<typeof formSchema>;

function formatOtpError(message?: string, remainingTime?: number) {
  if (typeof remainingTime === 'number' && remainingTime > 0) {
    return `${message || 'Too many OTP attempts. Try again later'} (${remainingTime}s remaining)`;
  }

  return message || 'Unable to verify code';
}

type MfaRouteState = {
  userId?: string;
  preAuthToken?: string;
  qrCode?: string;
  manualCode?: string;
};

function ShieldIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3L19 6V11.5C19 15.9 16.2 19.8 12 21C7.8 19.8 5 15.9 5 11.5V6L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.5 12.2L11.1 14.8L15.6 10.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EnableMfa() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state || {}) as MfaRouteState;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentPreAuthToken, setCurrentPreAuthToken] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [manualCode, setManualCode] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      otp: ''
    }
  });

  async function loadQr(userId: string, preAuthToken?: string) {
    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await setupMfa({ userId, preAuthToken });

      const setupCode = result.manualCode || result.secret;

      if (!result.success || !result.qrCode || !setupCode) {
        setError(result.message || 'Unable to start MFA setup');
        return;
      }

      setQrCode(result.qrCode);
      setManualCode(setupCode);
      setCurrentPreAuthToken(result.preAuthToken || preAuthToken || '');
    } catch (err: unknown) {
      setError(getApiErrorPayload(err).message || 'Unable to start MFA setup');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = getToken();
    const tokenUserId = token ? getTokenUserId(token) : null;
    const userId = routeState.userId || tokenUserId || '';

    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }

    setCurrentUserId(userId);
    setCurrentPreAuthToken(routeState.preAuthToken || '');

    if (routeState.qrCode && routeState.manualCode) {
      setQrCode(routeState.qrCode);
      setManualCode(routeState.manualCode);
      setLoading(false);
      return;
    }

    void loadQr(userId, routeState.preAuthToken);
  }, [navigate, routeState.manualCode, routeState.preAuthToken, routeState.qrCode, routeState.userId]);

  async function onSubmit(values: FormValues) {
    if (!currentUserId) {
      navigate('/login', { replace: true });
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const result = await verifyMfaSetup({
        userId: currentUserId,
        otp: values.otp,
        preAuthToken: currentPreAuthToken || undefined
      });

      if (!result.success) {
        setError(formatOtpError(result.message, result.remainingTime));
        return;
      }

      const accessToken = result.accessToken || result.token;

      if (accessToken) {
        setToken(accessToken);
        navigate('/dashboard', { replace: true });
        return;
      }

      setSuccess('MFA enabled successfully. Redirecting...');

      const token = getToken();
      const role = token ? getTokenRole(token) : null;

      setTimeout(() => {
        if (role === 'admin') {
          navigate('/dashboard/admin');
          return;
        }

        if (role === 'user') {
          navigate('/dashboard/user');
          return;
        }

        navigate('/login', { replace: true });
      }, 800);
    } catch (err: unknown) {
      const apiError = getApiErrorPayload(err);
      setError(formatOtpError(apiError.message, apiError.remainingTime));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-scene">
      <div className="auth-glow" aria-hidden="true" />

      <div className="auth-panel" style={{ width: 'min(100%, 430px)' }}>
        <div className="auth-icon">
          <ShieldIcon />
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h1 className="title" style={{ fontSize: 24, marginBottom: 8, textAlign: 'center' }}>Two-Factor Authentication</h1>
          <p className="subtitle" style={{ textAlign: 'center', marginBottom: 14 }}>
            Scan this QR code with your authenticator app.
          </p>

          {loading ? <p className="subtitle" style={{ textAlign: 'center' }}>Generating secure QR code...</p> : null}

          {!loading && qrCode ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <img
                src={qrCode}
                alt="Authenticator app QR code"
                style={{ width: 220, height: 220, margin: '0 auto', borderRadius: 12, border: '1px solid var(--line)', background: '#fff' }}
              />

              <p className="subtitle" style={{ fontSize: 13 }}>
                Manual setup key: <strong>{manualCode}</strong>
              </p>

              <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
                <input
                  className="auth-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit authentication code"
                  aria-label="Enter 6-digit authentication code"
                  {...register('otp')}
                />
                {errors.otp ? <p className="error-text">{errors.otp.message}</p> : null}

                {error ? <p className="error-text">{error}</p> : null}
                {success ? <p style={{ color: 'var(--success)', fontSize: 13 }}>{success}</p> : null}

                <button className="auth-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Verifying...' : 'Verify'}
                </button>

                <button className="auth-link" type="button" onClick={() => void loadQr(currentUserId, currentPreAuthToken)}>
                  Generate new QR code
                </button>
              </form>
            </div>
          ) : null}

          {!loading && !qrCode ? (
            <>
              {error ? <p className="error-text">{error}</p> : null}
              <button className="btn btn-primary" type="button" style={{ width: '100%', marginTop: 8 }} onClick={() => void loadQr(currentUserId, currentPreAuthToken)}>
                Retry MFA Setup
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
