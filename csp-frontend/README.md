# CSP Frontend

React + TypeScript frontend for CSP backend.

## Stack
- Vite
- React
- TypeScript
- Axios
- React Router

## Prerequisites
- Node.js 18+
- CSP backend running on `http://localhost:3000`

## Setup
1. `npm install`
2. Create `.env` with:
   `VITE_API_BASE_URL=http://localhost:3000/api`
3. `npm run dev`

App URL: `http://localhost:5173`

## Auth Flow
1. Login with email/password
2. OTP verification
3. Server returns:
   - short-lived access token
   - rotating refresh token
4. Frontend auto-refreshes access tokens on 401 using refresh token rotation
5. Role-based route access:
   - `/dashboard/admin`
   - `/dashboard/user`

## Main Features
- Login + OTP verification
- User query creation/list
- Admin query list
- Admin status update
- Admin reply
- Admin security event view
- Route guards for role protection

## Dependency Security Scanning
- `npm run audit:deps`
- `npm run audit:fix`
