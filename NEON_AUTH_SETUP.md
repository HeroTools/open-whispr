# Neon Auth Setup Guide

OpenWhispr supports optional authentication using Neon Auth (managed, Better Auth-based). When enabled, users can sync settings across devices and access account features.

## 1. Create a Neon Project and Enable Neon Auth
1. In the Neon console, create or open your project.
2. Enable Neon Auth for the project.
3. Copy the **Auth URL** for your project.

## 2. Configure Environment Variables
Add the Neon Auth URL to your `.env` file:

```
VITE_NEON_AUTH_URL=https://ep-<branch-id>.neonauth.<region>.aws.neon.tech/neondb/auth
```

## 3. Run the App
If `VITE_NEON_AUTH_URL` is set, the app will show the Neon Auth sign-in UI during onboarding.

## Optional: Run Without Auth
If you don't want authentication, leave `VITE_NEON_AUTH_URL` unset. The app will continue to work without account features.

## Troubleshooting
- Ensure the Auth URL is copied exactly from the Neon console.
- If sign-in fails in Electron, verify that your app origin is allowed by Neon Auth.
- OAuth providers will only appear if configured in the Neon console.
