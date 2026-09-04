# AquaTrack — Backend REST API

Production-grade, secure REST API for **AquaTrack** — a daily water intake tracker web application featuring strict Role-Based Access Control (RBAC), JWT authentication, cascade deletions, ownership validation, and automated testing.

Developed for the **Kravix Tech Fullstack Internship Assignment**.

---

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture & Design Decisions](#architecture--design-decisions)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Admin Account Seeding](#admin-account-seeding)
- [API Documentation & Contract](#api-documentation--contract)
- [Status Code Matrix](#status-code-matrix)
- [Testing & Quality Assurance](#testing--quality-assurance)

---

## Overview

AquaTrack backend powers daily hydration tracking with two distinct roles:
1. **User**: Logs daily water intake, views today summary against daily goals, tracks historical logs grouped by day, and manages their own entries.
2. **Admin**: Inspects all registered users, views any user's intake history, updates the system-wide recommended daily goal, and deletes accounts with automatic cascade cleanup of all associated logs.

---

## Key Features

- **JWT Authentication**: Stateless authentication with signed tokens and generic invalid credential errors to prevent account enumeration.
- **Server-Side RBAC**: Route gates enforce roles server-side returning explicit `403 Forbidden` status codes.
- **Intake Ownership Enforcement**: Non-owners attempting to delete intake entries are rejected with `403 Forbidden`.
- **Admin Self-Deletion Safeguard**: Admins are strictly prevented from deleting their own account (`400 Bad Request`).
- **Cascade Deletions**: Deleting a user permanently purges all associated `IntakeLog` records, preventing orphan documents.
- **Defensive Goal Fallback**: Returns a guaranteed default `2000 ml` goal if no custom goal is configured in the database.
- **Consistent UTC Day Boundaries**: All timestamps and date aggregations use strict UTC midnight-to-midnight calculation (`00:00:00.000Z` to `23:59:59.999Z`).

---

## Tech Stack

- **Runtime**: Node.js (v20+)
- **Framework**: Express.js
- **Language**: TypeScript (strict mode)
- **Database**: MongoDB with Mongoose ODM
- **Security**: `bcryptjs` for password hashing, `jsonwebtoken` for JWT tokens, `cors`
- **Testing**: Jest, Supertest, `mongodb-memory-server` (in-memory automated tests)

---

## Architecture & Design Decisions

### 1. Single Active Goal Philosophy
In accordance with the PRD specification, AquaTrack maintains a single active `AppSettings` document for the system-wide recommended daily goal. Historical days calculate achievement percentage against the currently active goal.
> *Design Note for Interview Defense*: AquaTrack intentionally avoids storing a historical goal snapshot per entry for this MVP to keep data models lean and fully compliant with the assignment contract. In a multi-tenant enterprise system, a versioned `DailyGoal` schema with `effectiveFrom` timestamps would be utilized.

### 2. Timezone Policy
All date operations, daily sums, and history groupings calculate boundaries using UTC. This eliminates server/client timezone drift and ensures reproducible date calculations.

### 3. Public Registration vs Admin Creation
Public registration (`POST /api/auth/register`) strictly sanitizes incoming requests and forces `role = "user"`. Administrative accounts can never be created via the public register route; they are initialized exclusively through the controlled CLI seed script: `npm run seed:admin`.

---

## Project Structure

```
aquatrack-backend/
├── src/
│   ├── config/          # Database connection (db.ts) and env validator (env.ts)
│   ├── controllers/     # Business logic for auth, intake, users, and settings
│   ├── middleware/      # authenticate, authorize, validate, errorHandler, notFound
│   ├── models/          # Mongoose schemas: User, IntakeLog, AppSettings
│   ├── routes/          # Express route definitions
│   ├── scripts/         # CLI admin seed script (seedAdmin.ts)
│   ├── types/           # TypeScript ambient declarations (express.d.ts)
│   ├── utils/           # API response helpers, JWT token helpers, UTC date logic
│   ├── app.ts           # Express application initialization & middleware pipeline
│   └── server.ts        # Server entrypoint connecting to DB and listening on port
├── tests/               # 28+ End-to-End Jest & Supertest automated test cases
├── .env.example         # Template for environment variables
├── package.json         # Dependencies, build, test, and verify scripts
├── tsconfig.json        # TypeScript configuration
└── README.md            # Complete documentation
```

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- MongoDB instance (local or MongoDB Atlas)

### Installation
1. Clone the repository and navigate into the directory:
   ```bash
   git clone https://github.com/Chandradeep05/aquatrack-backend.git
   cd aquatrack-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your MongoDB connection string and JWT secret.

4. Seed the initial Administrator account:
   ```bash
   npm run seed:admin
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The server will run at `http://localhost:5000`. Test health with:
`GET http://localhost:5000/api/health`

---

## Environment Configuration

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `PORT` | No | `5000` | HTTP server port |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string (exits if missing) |
| `JWT_SECRET` | **Yes** | — | Secret key used to sign JWT tokens (exits if missing) |
| `JWT_EXPIRES_IN` | No | `7d` | JWT expiration duration |
| `CLIENT_URL` | No | `http://localhost:5173` | Allowed origin for CORS |
| `ADMIN_NAME` | No | `Admin` | Name for seeded admin account |
| `ADMIN_EMAIL` | No | `admin@aquatrack.com` | Email for seeded admin account |
| `ADMIN_PASSWORD` | No | `AdminPassword123!` | Password for seeded admin account |

---

## Admin Account Seeding

To create or reset the administrator credentials:
```bash
npm run seed:admin
```
This script is idempotent: if the user already exists, it elevates their role to `admin` and updates their password.

---

## API Documentation & Contract

All responses conform to a unified JSON envelope:
- Success: `{ "success": true, "data": { ... }, "message": "..." }`
- Error: `{ "success": false, "message": "..." }`

### Authentication Endpoints
| Method | Route | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Registers a new user (always role: `user`) |
| `POST` | `/api/auth/login` | Public | Verifies credentials and returns JWT token |
| `GET` | `/api/auth/me` | Authenticated | Restores user session from JWT Bearer token |

### Water Intake Endpoints
| Method | Route | Access | Description |
|---|---|---|---|
| `POST` | `/api/intake` | Authenticated | Logs water intake (amount in ml > 0) |
| `GET` | `/api/intake/today` | Authenticated | Returns today intake, goal, percentage, and entries |
| `GET` | `/api/intake/history` | Authenticated | Returns historical entries grouped chronologically |
| `DELETE` | `/api/intake/:id` | Owner Only | Deletes entry (rejects non-owner with 403) |

### Admin & User Management Endpoints
| Method | Route | Access | Description |
|---|---|---|---|
| `GET` | `/api/users` | Admin Only | Lists all users, log counts, and system metrics |
| `GET` | `/api/users/:id/intake` | Admin Only | Inspects any user's intake history |
| `DELETE` | `/api/users/:id` | Admin Only | Cascade deletes user and all their intake logs |

### Settings Endpoints
| Method | Route | Access | Description |
|---|---|---|---|
| `GET` | `/api/settings/daily-goal` | Authenticated | Returns current daily goal (default 2000 ml) |
| `PUT` | `/api/settings/daily-goal` | Admin Only | Updates system-wide recommended daily goal |

---

## Status Code Matrix

| Status Code | Reason |
|---|---|
| `200 OK` | Successful GET, PUT, or DELETE request |
| `201 Created` | Successful POST resource creation (register, intake log) |
| `400 Bad Request` | Validation error, amount <= 0, or admin self-deletion attempt |
| `401 Unauthorized` | Missing, invalid, or expired JWT |
| `403 Forbidden` | Insufficient role permissions or deleting another user's entry |
| `404 Not Found` | Target user or intake record ID does not exist |
| `409 Conflict` | Duplicate email registration attempt |
| `500 Internal Server Error` | Unhandled server exception |

---

## Testing & Quality Assurance

AquaTrack backend comes with **28 automated end-to-end test cases** executed with Jest, Supertest, and `mongodb-memory-server` for isolated, deterministic execution without external database dependencies.

Run tests:
```bash
npm test
```

Run full verification (linting, build compilation, and automated tests):
```bash
npm run verify
```
