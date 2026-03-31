# SECURITY.md

## Implemented Security Controls

### Authentication and Session Security
- Password hashing with bcrypt (strong cost factor).
- RFC 6238 TOTP MFA with authenticator apps (Google Authenticator compatible).
- QR-code based MFA enrollment (`/api/auth/mfa/setup` + `/api/auth/mfa/verify`).
- Encrypted MFA secret storage at rest (AES-256-GCM, key derived from `MFA_SECRET_ENCRYPTION_KEY` or `JWT_SECRET`).
- OTP challenge for all MFA-enabled accounts before JWT issuance.
- Access tokens (JWT, 15-minute expiry, issuer/algorithm enforced).
- Account lockout and OTP brute-force controls.

### Access Control
- Central authorization middleware with deny-by-default behavior.
- RBAC enforcement for `admin` and `user` roles.
- Ownership checks for resource-level access control (IDOR mitigation).

### Input Validation and Injection Defense
- Centralized Zod-based request validation middleware.
- Strict schema validation for auth/query/feedback payloads.
- Parameterized SQL queries for all DB access.
- HTML sanitization for user-provided text fields.

### Security Misconfiguration and Headers
- Hardened Helmet configuration with strict CSP.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict referrer policy.
- `x-powered-by` disabled.
- Restricted CORS origin policy.

### Brute Force and Abuse Controls
- Endpoint-specific rate limits (`/auth/login`, `/auth/verify-otp`, `/api/queries`, `/api/feedback`).
- IP blocklist enforcement middleware.
- Automatic IP blocking for repeated failed login events.

### Logging and Monitoring
- Request IDs per request.
- Enhanced audit logs with:
  - `event_type`
  - `severity`
  - `ip`
  - `user_agent`
  - `request_id`
  - `event_timestamp`
- Security event endpoint for admins:
  - recent audit events
  - failed login telemetry
  - blocked IPs

### SSRF Protection
- URL validation helper that only allows HTTPS and blocks localhost/internal/private ranges.

## OWASP Top 10 (2021) Mapping

- **A01 Broken Access Control**: centralized authz, RBAC, ownership checks, deny-by-default.
- **A02 Cryptographic Failures**: bcrypt, encrypted MFA secrets, short-lived JWTs.
- **A03 Injection**: Zod validation + parameterized SQL + sanitization.
- **A04 Insecure Design**: suspicious-login handling, lockout policies, threat-aware rate limits.
- **A05 Security Misconfiguration**: strict Helmet config, CORS restrictions, safe JSON/error handling.
- **A06 Vulnerable Components**: dependency scanning scripts (`npm audit`, `npm audit fix`).
- **A07 Authentication Failures**: MFA, lockout, OTP controls, brute-force/IP blocking controls.
- **A08 Software and Data Integrity Failures**: lockfile-based installs (`npm ci`) and audit checks.
- **A09 Security Logging and Monitoring Failures**: structured audit trail and admin visibility endpoint.
- **A10 SSRF**: hardened outbound URL validator.

## Authentication Flow

1. User signs in with email/password at `/api/auth/login`.
2. If MFA is not enabled, JWT is returned and user can enroll MFA.
3. MFA enrollment:
   - `/api/auth/mfa/setup` generates TOTP secret + otpauth URL + QR code.
   - User scans QR with authenticator app.
   - `/api/auth/mfa/verify` verifies OTP and enables MFA.
4. If MFA is enabled, `/api/auth/login` returns `requireOtp: true` and `userId`.
5. User submits TOTP code to `/api/auth/verify-otp`.
6. On successful OTP verification, server issues JWT.

## Audit Logging System

All critical authz/authn and security events are logged to `audit_logs` with request context.
Examples:
- `login_password_success`
- `login_password_failed`
- `login_otp_success`
- `login_otp_failed`
- `suspicious_login`
- `mfa_enabled`
- `permission_denied`
- `query_created`
- `admin_action`
