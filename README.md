# Relay — Real-Time Referral Network and Activity Tracker

Relay helps teams share warm introductions, track referral progress and see organization activity as it happens. The project includes a typed REST API, multi-tenant authorization, rotating JWT sessions, MongoDB persistence, Socket.IO updates and a responsive React dashboard.

## Features

- Email and password authentication with short-lived access tokens and rotating, HTTP-only refresh cookies.
- Organization membership and roles (`user` and `admin`) carried in signed access tokens.
- Referral creation, searchable/status/date-filtered lists, and status updates.
- Organization-scoped dashboard activity feed with paginated, append-only event records.
- Live referral and activity notifications through authenticated Socket.IO organization rooms.
- Strict Zod request validation, Helmet security headers, JSON size limits and write rate limiting.
- A seeded Acme demo workspace plus a second Northstar tenant for isolation demonstrations.

## Stack

| Area | Tools |
| --- | --- |
| API | Node.js, Express, TypeScript, Mongoose, Zod, JWT, Socket.IO |
| Web | React, TypeScript, Vite, Tailwind CSS, Socket.IO client |
| Database | MongoDB |

## Quick start

See [SETUP.md](SETUP.md) for prerequisites, environment configuration, local development, demo accounts, API endpoints and deployment notes.

```bash
npm install
# Copy server/.env.example to server/.env and configure secrets/database
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs on [http://localhost:4000](http://localhost:4000).

## Demo accounts

| Organization | Role | Email | Default local password |
| --- | --- | --- | --- |
| Acme Studio | Admin | `admin@acme.test` | `DemoAdmin123!` |
| Acme Studio | User | `user@acme.test` | `DemoUser123!` |
| Northstar Labs | User | `user@northstar.test` | `DemoUser123!` |

Demo accounts are local development conveniences. Change their passwords using `DEMO_ADMIN_PASSWORD` and `DEMO_USER_PASSWORD` before the first seed, and never use demo credentials in a deployed environment.

## Project checks

```bash
npm test
npm run typecheck
npm run build
```

`npm test` runs Vitest unit tests for access-token middleware and referral request validation. These focused tests don't require MongoDB.

## Architecture

```text
client/                 React dashboard and Socket.IO client
server/src/routes/      API route definitions
server/src/controllers/ Request handling and response composition
server/src/services/    Token and activity operations
server/src/models/      Organization, User, Referral and ActivityEvent
server/src/middleware/  Authentication and runtime validation
```

Referral documents keep current status for quick dashboard reads. Activity events are stored separately as an append-only audit history. Referral indexes are ordered by organization, status or candidate email, and creation date. All data access and Socket.IO rooms use the verified organization claim.

## Operational notes

- Referral updates and event inserts are separate MongoDB writes. Use replica-set transactions if atomic persistence is required.
- For multi-instance deployments, configure a Socket.IO Redis adapter and a shared rate-limit store.
- Refresh-token rotation is single-session per user; signing in again replaces that user's previous refresh token.
- Use HTTPS and `COOKIE_SECURE=true` in production, and set strong, separate JWT secrets.
