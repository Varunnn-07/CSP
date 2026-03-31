# CSP Security-Hardened Stack

This repository contains:
- `csp-backend-main` (Node.js + Express + PostgreSQL)
- `csp-frontend` (React + TypeScript + Vite)

## Dependency Security Scanning

Run automated dependency vulnerability scans regularly:

Backend:
- `cd csp-backend-main`
- `npm run audit:deps`
- `npm run audit:fix`

Frontend:
- `cd csp-frontend`
- `npm run audit:deps`
- `npm run audit:fix`

Use `npm ci` in CI to ensure deterministic installs and lockfile integrity.

## Security Documentation

See `SECURITY.md` for OWASP Top 10 mapping, authentication flow, audit logging, and security controls implemented in this project.
