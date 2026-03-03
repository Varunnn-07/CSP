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
- CSP backend running on http://localhost:3000

## Setup
1. npm install
2. Create .env with:
   VITE_API_BASE_URL=http://localhost:3000/api
3. npm run dev

App URL: http://localhost:5173

## Login Credentials (Seeded)
- Admin: admin1@example.com / TestPassword123!
- User: user1@example.com / TestPassword123!

## Auth Flow
1. Login with email/password
2. OTP screen
3. JWT stored in localStorage (key: csp_token)
4. Role-based route access:
   - /dashboard/admin
   - /dashboard/user

## Main Features
- Login + OTP verification
- User query creation/list
- Admin query list
- Admin status update
- Admin reply
- Route guards for role protection
