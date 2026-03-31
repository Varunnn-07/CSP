import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { verifyOtp } from '../api/authApi';

const otpFormSchema = z.object({
  otp: z.string().regex(/^[0-9]{6}$/, 'Enter a valid 6-digit code')
});

type OtpFormValues = z.infer<typeof otpFormSchema>;

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

type Props = {
  pendingUserId: string;
  loading: boolean;
  onVerified: (token: string) => void;
  onBack: () => void;
  setLoading: (value: boolean) => void;
  setError: (value: string) => void;
};

function ShieldIcon() {
  return (
    <svg width="58" height="58" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3L19 6V11.5C19 15.9 16.2 19.8 12 21C7.8 19.8 5 15.9 5 11.5V6L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 8V13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="16.2" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function OtpVerification({ pendingUserId, loading, onVerified, onBack, setLoading, setError }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpFormSchema),
    defaultValues: {
      otp: ''
    }
  });

  async function onSubmit(values: OtpFormValues) {
    setLoading(true);
    setError('');

    try {
      const result = await verifyOtp({ userId: pendingUserId, otp: values.otp });

      if (!result.success || !result.token) {
        setError(result.message || 'OTP verification failed');
        return;
      }

      onVerified(result.token);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Unable to verify OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="auth-icon">
        <ShieldIcon />
      </div>

      <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
        <p className="auth-note" style={{ marginBottom: 4 }}>Two-Factor Authentication</p>
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

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify'}
        </button>

        <button className="auth-link" type="button" onClick={onBack} style={{ margin: '0 auto', display: 'block' }}>
          Back to login
        </button>
      </form>
    </>
  );
}
