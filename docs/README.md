# SkillAd

## Project Overview

SkillAd is a production-ready service marketplace platform that connects customers with verified local service providers.

The project consists of a mobile application, backend API, admin panel, landing page, and shared libraries.

---

## Project Structure

```
SkillAd/
│
├── admin-panel      # Web admin dashboard
├── api-server       # Node.js + Express backend
├── landing-page     # Marketing website
├── mobile-app       # Expo React Native application
├── shared-libs      # Shared code
```

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

### Admin

- React
- Vite

### Database

- Supabase PostgreSQL

---

## Running the Project

### Backend

```bash
cd api-server
pnpm start
```

### Mobile App

```bash
cd mobile-app
pnpm start
```

### Landing Page

```bash
cd landing-page
pnpm dev
```

### Admin Panel

```bash
cd admin-panel
pnpm dev
```

---

## Development Workflow

1. Start the API server.
2. Start the mobile app.
3. Edit code in Cursor.
4. Let Expo hot reload automatically.
5. Test every change before committing.

---

## Project Rules

- Preserve existing functionality.
- Do not rewrite working modules.
- Make minimal changes.
- Preserve API compatibility.
- Preserve database compatibility.
- Preserve mobile app compatibility.
- Keep UI consistent.
- Explain root cause before changing code.
- Explain how to test changes.

---

## Deployment

Backend:
- Node.js
- Express
- Hostinger

Database:
- Supabase

Mobile:
- Expo / EAS Build

Website:
- Vite

---

## Important Modules

- Authentication
- OTP
- Provider Registration
- Provider Verification
- Customer Dashboard
- Provider Dashboard
- Chat
- Reviews
- Earnings
- Subscription
- Notifications
- Image Upload
- Location Services