# ReachFlow 🚀

> **Portfolio-Grade Multi-Tenant Outbound Sales CRM**  
> Engineered for B2B SaaS sales teams (SDRs & AEs) to build automated email sequences, manage contacts with custom tags, track inbound replies, and close deals on an interactive drag-and-drop Kanban pipeline.

---

## 📸 Screenshots

### 1. Authentication & 1-Click Recruiter Demo
![Sign in & 1-Click Demo](Docs/Screenshots/Screenshot%202026-11-20%20030025.png)
*Authentication screen featuring instant 1-click recruiter demo access into the pre-seeded Acme Corp workspace.*

### 2. Contacts & Accounts Management
![Contacts & Accounts Management](Docs/Screenshots/Screenshot%202026-11-20%20030044.png)
*Prospect data table with tag filtering, real-time search, workspace switcher, and cursor pagination.*

### 3. Interactive Deals Kanban Pipeline
![Deals Kanban Board](Docs/Screenshots/Screenshot%202026-11-20%20030101.png)
*Drag-and-drop Kanban board across 6 deal stages with real-time pipeline value aggregation and optimistic updates.*

### 4. Multi-Step Email Sequence Builder
![Email Sequence Builder](Docs/Screenshots/Screenshot%202026-11-20%20030133.png)
*Visual sequence builder displaying scheduled email touchpoints with delay intervals and dynamic merge tags.*

### 5. Sequence Enrollment & Inbound Reply Simulation
![Sequence Enrollment & Reply Simulation](Docs/Screenshots/Screenshot%202026-11-20%20030146.png)
*Prospect enrollment tracker with sent email metrics and 1-click inbound reply simulation to immediately halt outbound drips.*

---

## ⚡ Quickstart (Local Setup in Under 5 Commands)

```bash
# 1. Start MySQL 8 container
docker compose up -d

# 2. Install monorepo dependencies and approve build scripts
pnpm install && pnpm approve-builds --all

# 3. Synchronize database schema and generate Prisma client
pnpm db:push

# 4. Seed demo workspace (Acme Corp, contacts, sequences, and deals)
pnpm db:seed

# 5. Start API and Next.js frontend in parallel
pnpm dev
```

- **Frontend Application**: `http://localhost:3000` (Click **"Try Demo Workspace"** for instant 1-click recruiter login)
- **Backend API**: `http://localhost:4000/v1`
- **Health Check**: `http://localhost:4000/health`
- **Demo Credentials**: `demo@reachflow.io` / `Password123!`

---

## 🏗️ Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Frontend Client (Next.js 15 + React 19)"]
        UI["Web App (apps/web)"]
        AuthContext["Auth Context + Token Storage"]
        ContactsView["Contacts Table + Tag Filtering"]
        KanbanView["Interactive Kanban Board (HTML5 Dnd)"]
        SequenceView["Sequence Builder + Reply Simulator"]
    end

    subgraph API["Backend Service (Express.js + TypeScript)"]
        Server["Express App (apps/api - Port 4000)"]
        AuthMW["JWT + Rotating Refresh Cookie (/v1/auth)"]
        TenantMW["Zero-Trust Tenant Scoping (x-workspace-id)"]
        Engine["Sequence Engine & Cron Runner"]
    end

    subgraph Data["Persistence Layer"]
        MySQL[("MySQL 8 Database")]
        PrismaORM["Prisma ORM Client (@reachflow/db)"]
    end

    UI -->|REST / JSON Envelope| Server
    Server --> AuthMW --> TenantMW
    TenantMW --> PrismaORM
    Engine -->|Idempotent Drips| PrismaORM
    PrismaORM --> MySQL
```

---

## 🔐 Zero-Trust Multi-Tenancy & Security Architecture

1. **Strict Logical Isolation**: Every database entity (`Contact`, `Deal`, `Sequence`, `Enrollment`, `EmailMessage`) possesses a mandatory `workspaceId` foreign key and composite index.
2. **Zero Information Leakage (403/404)**: Accessing another workspace's resource yields `404 Not Found` (to avoid resource enumeration) or `403 Forbidden` if cross-tenant workspace headers are forged.
3. **Automated Tenant Isolation Test Suite**: Dedicated Vitest + Supertest integration suite verifying that Workspace B cannot read, update, or delete Workspace A's contacts, deals, or sequences.
4. **Token Security**:
   - Short-lived JWT Access Tokens (15 min lifespan).
   - Rotating Refresh Tokens stored hashed (`sha256`) in database and delivered via `httpOnly`, `SameSite=Lax`, `Secure` cookies.

---

## 📬 Sequence Engine & Idempotency Guarantee

Outbound sequences execute as automated state machines:
- **Delay Intervals**: Steps specify wait times in hours between touchpoints.
- **Merge Variable Personalization**: Dynamic templating parses `{{firstName}}`, `{{lastName}}`, and `{{company}}` with safe fallbacks.
- **Strict Idempotency**: Each email dispatch generates a deterministic idempotency key (`enrollment_${id}_step_${stepId}`). If a worker restarts or retries, the unique database constraint prevents duplicate emails from ever being dispatched.
- **Inbound Reply Stoppage**: Simulating a prospect reply (`POST /v1/sequences/enrollments/:id/simulate-reply`) transitions enrollment status to `REPLIED`, instantly halting all future sequence steps.

---

## 📊 Environment Variables Reference

| Variable | Description | Default / Example |
|---|---|---|
| `DATABASE_URL` | MySQL 8 connection string | `mysql://reachflow:reachflowpassword@localhost:3306/reachflow` |
| `JWT_ACCESS_SECRET` | Secret key for signing 15m access JWTs | Min. 32 character cryptographic string |
| `JWT_REFRESH_SECRET` | Secret key for refresh token hashing | Min. 32 character cryptographic string |
| `JWT_ACCESS_EXPIRATION` | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRATION_DAYS` | Refresh token validity window | `7` |
| `PORT` | API server listening port | `4000` |
| `NODE_ENV` | Runtime environment | `development` / `production` / `test` |
| `FRONTEND_URL` | Allowed CORS origin for web app | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Base API URL exposed to frontend client | `http://localhost:4000/v1` |

---

## 🧪 Testing Commands

```bash
# Run all unit and integration test suites
pnpm test

# Run typecheck across shared package, db, api, and web
pnpm typecheck

# Run production build across all workspaces
pnpm build
```

### Verified Test Suites:
- `tests/tenant-isolation.test.ts`: Proves BOLA/IDOR protection and workspace boundaries.
- `tests/auth.test.ts`: Validates signup, login, refresh rotation, and cookie handling.
- `tests/sequence-idempotency.test.ts`: Proves retry safety, zero duplicate email sends, and reply stoppage.

---

## 🎯 Current Features (Tonight's Working MVP)

- [x] **Monorepo Architecture**: `pnpm` workspaces with `@reachflow/shared`, `@reachflow/db`, `@reachflow/api`, and `@reachflow/web`.
- [x] **MySQL 8 & Prisma**: Fully normalized relational schema with committed migrations and rich seed data.
- [x] **Full Authentication**: Signup, login, JWT access tokens, rotating refresh token cookies, and password hashing with bcrypt.
- [x] **Zero-Trust Tenant Isolation**: Every query scoped by `workspaceId` with role-based access control.
- [x] **Contacts Management**: High-density table, debounced search, tag filtering, cursor pagination, and add/delete forms.
- [x] **Deals Kanban Pipeline**: Drag-and-drop board across 6 sales stages (Lead, Qualified, Demo, Negotiation, Won, Lost) with stage value totals and optimistic updates.
- [x] **Automated Sequence Engine**: Multi-step sequence builder, contact enrollment, background cron runner, idempotent dispatches, and simulated reply button.
- [x] **Recruiter Demo Mode**: "Try Demo Workspace" 1-click button for immediate platform evaluation.
- [x] **Robust Error Handling**: Standardized `{ success, data, error, meta }` response envelope with loading, empty, and error states on every screen.
- [x] **CI/CD Pipeline**: GitHub Actions workflow running lint, typecheck, integration tests, and production build.

---

## 🗺️ Product Roadmap (Subsequent Phases)

- **Distributed Background Workers**: Migrate from in-process node-cron to BullMQ + Redis with dead-letter queue (DLQ) and exponential backoff.
- **Production Email Delivery**: Connect Resend API and Mailpit SMTP inspector for visual deliverability testing.
- **CSV Import Wizard**: Stream-based chunked CSV file upload with column mapping and deduplication preview.
- **Analytics Dashboard**: Pipeline conversion charts, email open/reply rates, and sequence performance comparisons.
- **System Audit Logs**: Comprehensive actor and workspace activity audit log.
- **End-to-End Testing**: Headless Playwright suite covering full browser user journeys.
- **OpenAPI Documentation**: Swagger UI served at `/docs` generated from Zod contracts.

---

## 💡 Key Design Decisions & Interview Defense

1. **Why Express as a Separate Service instead of Next.js Route Handlers?**  
   *Separating the API decouples business logic, simplifies horizontal scaling of background workers, enables clean OpenAPI generation, and models authentic production microservice architectures.*

2. **Why Shared Database with Row-Level Tenant Scoping over Database-per-Tenant?**  
   *For a high-density B2B SaaS platform, shared database with strict `workspaceId` query filtering delivers maximum connection pooling efficiency and lower infrastructure overhead while maintaining mathematical isolation through composite unique indexes and automated isolation suites.*

3. **How is Send Idempotency Guaranteed?**  
   *Before sending, the engine writes an `EmailMessage` with a deterministic `idempotencyKey` (`${enrollmentId}_step_${stepId}`). The database unique constraint guarantees that even if concurrent workers pick up the same job, exactly one email can ever be recorded and dispatched.*
