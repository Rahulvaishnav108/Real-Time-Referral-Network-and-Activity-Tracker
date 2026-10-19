# Setup and local development

## Prerequisites

- Node.js 20 or newer (npm is included)
- MongoDB 6 or newer, running locally or available through MongoDB Atlas

## Install

From the repository root:

```bash
npm install
```

## Configure the API

Copy `server/.env.example` to `server/.env` and set the values for your environment:

```dotenv
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/referral_network
JWT_ACCESS_SECRET=use-a-random-secret-of-at-least-32-characters
JWT_REFRESH_SECRET=use-a-different-random-secret-of-at-least-32-characters
CLIENT_ORIGIN=http://localhost:5173
COOKIE_SECURE=false
DEMO_ADMIN_PASSWORD=DemoAdmin123!
DEMO_USER_PASSWORD=DemoUser123!
```

Generate separate random JWT secrets. Keep `server/.env` private; it is ignored by Git. `COOKIE_SECURE=false` is for local HTTP development. For HTTPS deployments set it to `true`, set `CLIENT_ORIGIN` to the deployed frontend origin, and use a protected MongoDB connection string.

## Start the apps

Start MongoDB, then run both the API and web app from the root:

```bash
npm run dev
```

- Web app: <http://localhost:5173>
- API health check: <http://localhost:4000/api/health>

The API seeds the demo organizations and accounts the first time it finds no `acme` organization. When the Acme admin and member accounts exist, it also adds five fictional referrals and matching activity events once. Existing sample emails are skipped, and other organizations are not modified. Set different demo passwords before the first API startup if needed. This seed data is intended for local demos, not production.

## Demo logins

| Organization | Role | Email | Default password |
| --- | --- | --- | --- |
| Acme Studio | Admin | `admin@acme.test` | `DemoAdmin123!` |
| Acme Studio | User | `user@acme.test` | `DemoUser123!` |
| Northstar Labs | User | `user@northstar.test` | `DemoUser123!` |

The login page includes a one-click Acme admin demo login. The Northstar account can be used to confirm that referrals and Socket.IO updates stay within their organization.

## API routes

| Method | Route | Authentication | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | No | Create an organization and its first admin |
| `POST` | `/api/auth/login` | No | Sign in and set the refresh cookie |
| `POST` | `/api/auth/refresh` | Refresh cookie | Rotate refresh token and issue an access token |
| `POST` | `/api/auth/logout` | Optional refresh cookie | Revoke the refresh token and clear the cookie |
| `GET` | `/api/auth/me` | Access token | Return the current user |
| `POST` | `/api/referrals` | Access token | Create a referral |
| `GET` | `/api/referrals` | Access token | List referrals; supports `status`, `email`, `from`, `to`, `page`, and `limit` |
| `PATCH` | `/api/referrals/:id/status` | Access token | Set `pending`, `contacted`, `accepted`, or `rejected` |
| `GET` | `/api/referrals/activity` | Access token | Get the organization's paginated activity history |
| `GET` | `/api/health` | No | Health check |

Protected REST requests use `Authorization: Bearer <accessToken>`. The refresh token is an HTTP-only, same-site cookie scoped to `/api/auth`. Socket.IO clients pass `{ token: accessToken }` in the handshake `auth` object. The server verifies the token and joins the socket to its organization room.

Events emitted to organization members:

- `referral:created` when a referral is created.
- `referral:updated` when its status changes.
- `activity:new` when an audit event is recorded.

## Build and typecheck

```bash
npm test
npm run typecheck
npm run build
```

The Vitest unit tests cover JWT authentication middleware behavior and referral request validation. They run without a MongoDB instance; the running API and full referral persistence flow still require MongoDB.

## Data and production notes

The `Referral` collection stores current referral state and has compound indexes for organization/status/date and organization/candidate email/date. `ActivityEvent` is a separate append-only event collection. All referral and event reads are filtered by the verified organization ID. The user's organization and role are part of the signed access token, so normal requests don't need a user lookup.

Referral persistence and activity-event insertion currently use separate MongoDB operations. Use transactions on a replica set when atomicity across these writes is required. For horizontal scaling, configure the Socket.IO Redis adapter and a shared rate-limit store. Access tokens last 15 minutes; refresh tokens last 7 days and are rotated on use. A user's refresh token is single-session, so a new login revokes the previous refresh session.
