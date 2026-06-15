# Atlas — Research Intelligence Platform

A full-featured React + TypeScript + Tailwind CSS frontend for the Atlas research platform.

## Features

- **Login Page** — Email/password auth, Google SSO, show/hide password, loading states
- **Register / Create Account Page** — Full name, email, company (optional), password with strength meter, confirm password
- **Forgot Password Page** — Email reset flow with confirmation state
- **Dashboard** — Workspace grid, create/delete workspaces, modal form
- **Workspace (3-panel Studio)**:
  - Left: Source management — upload files, add URLs, live processing status, delete sources
  - Center: Research Chat with AI replies, citation markers, suggested questions, typing indicator
  - Center: Workspace Editor with editable title & rich content
  - Right: Studio Tools (13 tools) — click to generate via chat

## Tech Stack

- React 18 + TypeScript
- React Router DOM v6
- Zustand (state management)
- Tailwind CSS v3 (with custom design tokens from DESIGN.md)
- Lucide React (icons)
- Vite

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Project Structure

```
src/
├── pages/
│   ├── auth/       LoginPage, RegisterPage, ForgotPasswordPage
│   ├── dashboard/  DashboardPage
│   └── workspace/  WorkspacePage (3-panel studio)
├── components/
│   └── navigation/ TopNav
├── store/          authStore, workspaceStore, uiStore
└── App.tsx         Routes (/ /register /forgot-password /dashboard /workspace/:id)
```

## Authentication Flow

The app uses a mock auth system. Enter any email/password to log in or register — it simulates a 1.4s API call then redirects to the dashboard. State persists via localStorage using Zustand persist middleware.

## Design System

All design tokens (colors, typography, spacing, radii) from `DESIGN.md` are wired into `tailwind.config.js`.
