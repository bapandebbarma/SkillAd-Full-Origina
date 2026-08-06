# SkillAd Architecture

## Project Overview

SkillAd is a production service marketplace application.

The workspace contains:

- admin-panel
- api-server
- landing-page
- mobile-app
- shared-libs

---

## Technology Stack

### Mobile

- Expo SDK 54
- React Native
- Expo Router
- TypeScript

### Backend

- Node.js
- Express
- Supabase
- REST API

### Admin Panel

- React
- Vite
- TypeScript

### Database

- Supabase PostgreSQL

---

## Project Rules

- Preserve existing functionality.
- Make the minimum required code changes.
- Never rewrite working modules.
- Preserve mobile app compatibility.
- Preserve API compatibility.
- Preserve database compatibility.
- Keep UI consistent.
- Reuse existing components.
- Never remove existing features without permission.
- Explain the root cause before modifying code.
- Explain which files will be modified.
- Provide testing steps after completing changes.

---

## Development Workflow

Before changing code:

1. Read all related files.
2. Understand the existing implementation.
3. Find the root cause.
4. Modify only the required files.
5. Explain the changes.
6. Provide verification steps.

---

## Coding Standards

- Use existing architecture.
- Keep code readable.
- Keep TypeScript strict.
- Avoid duplicate code.
- Prefer reusable components.
- Avoid unnecessary refactoring.

---

## Important Modules

Do not accidentally break:

- Authentication
- OTP
- Provider Registration
- Provider Verification
- Customer Dashboard
- Provider Dashboard
- Reviews
- Chat
- Earnings
- Subscription
- Notifications
- Location Services
- Image Upload
- Admin Panel
- Landing Page

---

## Database

Backend uses Supabase.

Never change:

- table structure
- RLS policies
- SQL migrations

unless explicitly requested.

---

## Final Checklist

Before finishing:

✓ No existing feature broken

✓ TypeScript passes

✓ Explain changes

✓ Explain testing procedure