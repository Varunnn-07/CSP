import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { login } from '../api/authApi';
import { getApiErrorPayload } from '../api/client';
import { setToken } from '../utils/auth';

const loginFormSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

function UserAvatarIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 19C5.8 15.2 8.5 13.4 12 13.4C15.5 13.4 18.2 15.2 19.5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2.2 2.2L21.8 21.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M10 6.2C10.6 6.1 11.3 6 12 6C17 6 20.6 9.1 22 12C21.4 13.3 20.3 14.8 18.8 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M14.3 14.3C13.7 14.9 12.9 15.2 12 15.2C10.1 15.2 8.5 13.7 8.5 11.8C8.5 10.9 8.8 10.1 9.4 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M6.6 6.7C4.6 8 3.1 9.9 2 12C2.9 13.8 4.2 15.5 5.9 16.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12C3.4 9.1 7 6 12 6C17 6 20.6 9.1 22 12C20.6 14.9 17 18 12 18C7 18 3.4 14.9 2 12Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  async function onSubmit(values: LoginFormValues) {
    setLoading(true);
    setError('');

    try {
      const result = await login({ email: values.email.trim().toLowerCase(), password: values.password });

      if (!result.success) {
        throw new Error(result.message || 'Login failed');
      }

      const mfaSetupRequired = result.mfa_setup_required || result.mfaSetupRequired;
      const mfaRequired = result.mfa_required || result.requireOtp || result.mfaRequired;

      if (mfaSetupRequired && result.userId) {
        navigate('/mfa/enable', {
          state: {
            userId: result.userId,
            preAuthToken: result.preAuthToken,
            qrCode: result.qrCode,
            manualCode: result.manualCode
          }
        });
        return;
      }

      if (mfaRequired && result.userId) {
        navigate('/verify-otp', {
          state: {
            userId: result.userId,
            preAuthToken: result.preAuthToken
          }
        });
        return;
      }

      const token = result.accessToken || result.token;

      if (token) {
        onOtpVerified(token);
        return;
      }

      setError('Unable to complete sign in');
    } catch (err: unknown) {
      console.error('Login request failed:', err);
      setError(getApiErrorPayload(err).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function onOtpVerified(token: string) {
    setToken(token);
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="auth-scene">
      <div className="auth-glow" aria-hidden="true" />

      <div className="auth-panel">
        <div className="auth-icon">
          <UserAvatarIcon />
        </div>

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
          <input
            className="auth-input"
            type="email"
            placeholder="Email Address"
            aria-label="Email Address"
            autoComplete="email"
            {...register('email')}
          />
          {errors.email ? <p className="error-text">{errors.email.message}</p> : null}

          <div className="auth-input-wrap">
            <input
              className="auth-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              aria-label="Password"
              autoComplete="current-password"
              {...register('password')}
            />
            <button
              className="auth-eye-btn"
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon hidden={!showPassword} />
            </button>
          </div>
          {errors.password ? <p className="error-text">{errors.password.message}</p> : null}

          <div className="auth-meta">
            <label className="remember-row">
              <input type="checkbox" defaultChecked />
              Remember me
            </label>
            <button className="auth-link" type="button" onClick={() => setError('Please contact administrator to reset password.')}>Forgot password?</button>
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
