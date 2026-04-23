# ai-bot

A multi-tenant Telegram + AI SaaS platform. Businesses sign up, configure a bot (either a slug on a shared general bot or a dedicated one with their own token), plug their own system prompt + product/service catalog, and the bot starts capturing **orders** or **leads** from Telegram — routing questions through a configurable LLM provider (Gemini or OpenAI).

A React admin panel lets operators manage clients, catalogs, orders, leads, chat history, bot configuration, QR/share assets, and analytics. Two role tiers (`super_admin`, `client_admin`) keep multi-tenant boundaries enforced both in UI and at the service layer.

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [AI capabilities](#ai-capabilities)
- [Tech stack](#tech-stack)
- [Installation & setup](#installation--setup)
- [Configuration](#configuration)
- [API overview](#api-overview)
- [Current limitations](#current-limitations)
- [Future improvements](#future-improvements)
- [What this system can do (full capability breakdown)](#what-this-system-can-do-full-capability-breakdown)

---

## Overview

**What it is.** A production-oriented starter for spinning up AI-assisted Telegram bots for many small businesses off a single deployment. Each business is a *client* in the system and gets:

- A Telegram entry point (shared general bot via slug deeplink, or their own branded bot).
- An AI chat tuned by their own system prompt, language, and model.
- One of two conversation flows: **order** (shop/restaurant) or **lead** (clinic, school, service business).
- A product/service catalog shown to end users and fed into the AI's context.
- A dashboard showing everything that happens through the bot — conversations, orders, leads, chat transcripts.

**Problem it solves.** Building the same bot over and over for every SMB is wasteful. This system lets an operator (the "super admin") onboard a new business in minutes — one form, one slug, one system prompt — and hand that business their own login scoped to just their client record. Businesses that outgrow the shared bot can bring their own token without redeploying.

**Value proposition.**

- **Zero-infra onboarding.** Ship branded Telegram bots without each business needing their own server.
- **Provider-agnostic AI.** Switch Gemini↔OpenAI per client without touching code.
- **Built-in sales surfaces.** Orders (multi-item cart) and leads (contact capture) come turn-key, not as something you have to add later.
- **Multi-language.** Every bot and admin surface speaks Uzbek, Russian, or English.

---

## Features

### Bot runtime

- Single general Telegram bot (polling) routes users to the right business via `/start <slug>` deeplinks.
- Optional dedicated bot per client — bring-your-own Telegram token, validated against the Telegram `getMe` API and started as an independent polling instance.
- `BotRegistry` service manages N+1 bot instances (general + per-client); adds/removes bots at runtime as tokens change.
- Auto-provisions a chat session on dedicated bots when users type before hitting `/start`.
- Clean-UI defaults: old inline keyboards stripped after every tap, reply keyboards removed when flows start.

### Order flow (shops, restaurants)

- Product catalog rendered as an inline keyboard grouped by client.
- Multi-item cart: add product → pick quantity → continue shopping or checkout.
- Checkout collects phone and address.
- Order confirmation, server-persisted status (`pending` / `confirmed` / `cancelled`).
- Admin Telegram notification on new order (with line items and total formatted in the client's currency).

### Lead flow (clinics, schools, services)

- AI chat mode with "Leave your contact" CTA on every reply.
- Contact capture: name + phone + optional AI-summarized question.
- Server-persisted status (`new` / `contacted` / `closed`).
- Admin Telegram notification on new lead.

### Admin panel (web)

- **Dashboard** — totals for clients, conversations, messages, messages-today, orders, leads, plus recent activity and latest records.
- **Client list** (super admin) — create from scratch or one-click demo seeds (Pizza Place, Dental Clinic; uz/ru/en variants) with prefilled catalog and prompt.
- **Client detail** with tabbed layout:
  - *General* — name, slug, system prompt with starter templates, default language, bot type (order/lead), currency, active toggle, admin chat ID, and a live prompt preview.
  - *AI provider* — switch between Gemini and OpenAI, with dynamic model dropdown per provider.
  - *Dedicated bot* — paste a Telegram token to go branded; disconnect to fall back to the shared bot.
  - *Products / Services* — card-grid catalog with AI-generated descriptions, prices in client currency.
  - *Orders / Leads* — table on desktop, card list on mobile with tappable action buttons. Status transitions inline.
  - *Bot config* — per-client welcome message, button icons, enabled menu buttons, contact phone / website.
  - *Chat history* — paginated message archive per client.
- **Users** (super admin) — user CRUD, password reset, toggle active.
- **Role-aware UI** — CLIENT_ADMIN users see only their own client, can't edit `slug`, `isActive`, bot type, currency, default language, or feature toggles.
- **Bot sharing** — every client detail surface has a Share Bot button that opens a QR code (Telegram-blue branded), the direct deeplink, and Download PNG / Print / Web-Share actions. Empty order/lead states include the same share dialog as a CTA.
- **i18n** — full uz/ru/en translations across every user-facing string.

### Authentication & authorization

- JWT-based login (bcrypt-hashed passwords).
- Roles: `super_admin` (everything), `client_admin` (only their own client).
- `RolesGuard` gates endpoints; `ClientAccessGuard` scopes CLIENT_ADMIN to their `clientId`.
- Server-side field locking — CLIENT_ADMIN requests to change `type`, `currency`, `defaultLang`, `hasProducts`, or `hasServices` are silently stripped and logged.

### Multilingual content

- Bot UI (menus, prompts, error messages) in uz/ru/en, driven by a JSON catalog.
- Per-user language preference stored in `chat_sessions`.
- Per-client `defaultLang` used as the fallback for fresh chats.

### Currency

- Three currencies: `UZS` (so'm, suffix), `USD` ($, prefix), `RUB` (₽, suffix).
- Shared `formatPrice` util on both backend (Telegram messages, admin notifications) and frontend (catalog, orders page).
- Space-grouped thousands, zero-fraction numbers rendered without decimals.

### Demo mode

- `POST /api/clients/demo` seeds a ready-to-demo client with realistic catalog and prompt in the requested language. Handy for sales conversations.

---

## Architecture

```
┌─────────────┐   HTTPS    ┌────────────────────┐  TypeORM   ┌─────────────┐
│ admin-panel │ ─────────► │   backend (Nest)   │ ─────────► │ PostgreSQL  │
│  (Vite SPA) │            │                    │            └─────────────┘
└─────────────┘            │  ┌──────────────┐  │
                           │  │ BotRegistry  │  │   polling
                           │  │ (N bots)     │ ◄┼────────── Telegram users
                           │  └──────────────┘  │
                           │  ┌──────────────┐  │
                           │  │ AiService    │  │   HTTPS
                           │  │ (router)     │ ─┼──────────►  Gemini / OpenAI
                           │  └──────────────┘  │
                           └────────────────────┘
```

### Backend modules (NestJS)

- **AuthModule** — login, JWT issuance, user CRUD, password reset.
- **ClientModule** — clients, products, services, demo seeding. Owns role-based field filtering and bot reconciliation hook.
- **BotModule** — `BotRegistry` (manages live Telegram bot instances), `BotService` (handlers, message routing), `BotUiService` (inline/reply keyboard builders), `telegram-token-validator` (validates bring-your-own tokens).
- **AiModule** — `AiService` (router), `GeminiService` (implements `LlmProvider` via `@google/generative-ai`), `OpenAiService` (implements `LlmProvider` via `openai` SDK), `AiController` (AI-assisted admin tooling).
- **FlowModule** — `FlowRouterService` + `FlowStateService` + `OrderFlowService` + `LeadFlowService`. In-memory state keyed by `chatId` with TTL.
- **ChatModule** — `ChatSession` and `ChatHistory` persistence; language preference per chat.
- **OrderModule** / **LeadModule** — persistence + status CRUD for the two flows.
- **NotificationModule** — admin Telegram notifications when new orders/leads come in.
- **AnalyticsModule** — dashboard counters and recent activity.
- **I18nModule** — translation service with interpolation.

### Patterns used

- **Dependency injection** everywhere — services inject each other, no global singletons.
- **Interface + strategy** for LLMs (`LlmProvider` with `GeminiService` / `OpenAiService` implementations, routed by `AiService`).
- **Registry** pattern for multi-bot lifecycle (`BotRegistry`).
- **Guards + decorators** for RBAC (`@Roles()`, `ClientAccessGuard`).
- **Repository** pattern via TypeORM.
- `forwardRef` used to break two real module cycles: `Auth ↔ Client`, `Client ↔ Bot`.

### Frontend

- React 19 + Vite + Tailwind v4 + shadcn/ui primitives (Radix under the hood).
- Routing via `react-router-dom` v7 with nested routes (client detail uses `<Outlet>` + `useOutletContext`).
- Auth context + `useAuth()` hook exposing `{ user, isSuperAdmin, isClientAdmin }`.
- i18n via `i18next` + `react-i18next` + browser language detector, JSON catalogs.
- Form state is local React state (no form library).
- `BackButton` hides when there's no SPA history — `location.key === 'default'` signal.

---

## AI capabilities

- **Provider-agnostic abstraction.** Every LLM is accessed through the `LlmProvider` interface (`kind`, `generateResponse(input, config)`). Adding a third provider means writing one service — the callers don't change.
- **Per-client provider + model.** `Client.aiProvider` (`gemini` | `openai`) and `Client.aiModel` (e.g. `gpt-4o-mini`, `gemini-2.5-flash`) are read on every call and passed into the router.
- **Supported models (explicitly surfaced in the UI):**
  - Gemini: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`, `gemini-1.5-pro`
  - OpenAI: `gpt-4o-mini`, `gpt-4o`
- **System prompt + history.** Every AI call receives the client's `systemPrompt` (augmented with the product/service list and active language) plus the last N messages from `chat_history` so replies stay in context.
- **Timeouts + fallbacks.** 30s default chat timeout, 15s for admin one-shot calls. A provider error returns a polite "Sorry, something went wrong" rather than crashing the bot.
- **Admin tooling.** `POST /api/ai/generate-description` produces a short, on-brand description for a new product/service from a name + optional keywords. Always uses the default Gemini model for predictable results.
- **Default + fallback.** `DEFAULT_PROVIDER = 'gemini'`. If a client has no `aiModel`, the env `AI_MODEL` (or the catalog default) applies. If OpenAI is selected but `OPENAI_API_KEY` is missing, the service returns a user-facing error instead of throwing.

---

## Tech stack

**Backend**
- NestJS 11 + TypeScript (ESM, `.js` specifiers)
- TypeORM + `pg` (PostgreSQL driver)
- `node-telegram-bot-api` (long polling)
- `@google/generative-ai`, `openai`
- `@nestjs/passport` + `passport-jwt` + `bcrypt`
- `class-validator` + `class-transformer`
- `@nestjs/config` for env

**Frontend**
- React 19, Vite 6, TypeScript 5.9
- Tailwind CSS v4 + `@tailwindcss/vite`
- Radix UI primitives (`radix-ui`) + shadcn component style
- `react-router-dom` v7
- `react-i18next`
- `qrcode.react`
- `sonner` for toasts
- `lucide-react` for icons

**Database**
- PostgreSQL (tested 13+). Five migrations shipped under `backend/src/database/migrations/`.

**External services**
- Telegram Bot API (polling mode)
- Google Generative AI (Gemini)
- OpenAI Chat Completions

---

## Installation & setup

### Prerequisites

- Node.js 20+
- pnpm 10+ (both packages use pnpm)
- PostgreSQL 13+
- A Telegram bot token from `@BotFather` (for the general bot)
- A Google Gemini API key; optionally an OpenAI API key

### 1. Clone

```bash
git clone <repo-url> ai-bot
cd ai-bot
```

### 2. Backend

```bash
cd backend
pnpm install
cp .env.example .env    # or create .env manually; see next section
# create DB first, then:
pnpm run migration:run   # if this script exists in your package.json
pnpm run start:dev
```

The backend listens on `PORT` (default `3000`).

### 3. Admin panel

```bash
cd admin-panel
pnpm install
echo 'VITE_API_URL=http://localhost:3000' > .env    # or set in your shell
pnpm run dev
```

The Vite dev server runs on port `5173` by default.

### 4. First login

Create a super-admin user directly in the DB (the bootstrap path). Then log in through `/login` and start creating clients — or hit `POST /api/clients/demo` for a fully seeded one.

---

## Configuration

### Backend `.env`

```dotenv
# ── Server ─────────────────────────────────────
PORT=3000
JWT_SECRET=change-me-to-a-long-random-string

# ── Database ───────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=ai_bot
DB_SYNC=false                # true in dev only; migrations in prod

# ── Telegram ───────────────────────────────────
# Token for the shared general bot (required).
# Per-client dedicated bots are configured at runtime via the admin UI.
TELEGRAM_BOT_TOKEN=123456:ABCDEF...

# ── AI ─────────────────────────────────────────
# At least one must be set. GEMINI_API_KEY is required today
# (it's fetched via getOrThrow).
GEMINI_API_KEY=AIza...
OPENAI_API_KEY=sk-...         # optional; clients picking "openai" fail gracefully if missing

# Default model used when a client hasn't overridden Client.aiModel
AI_MODEL=gemini-2.5-flash

# Default system prompt if a client has no systemPrompt set
SYSTEM_PROMPT=You are a helpful AI assistant. Answer clearly and concisely.
```

### Admin panel `.env`

```dotenv
VITE_API_URL=http://localhost:3000
```

### Where things live

- Per-client AI, bot, catalog, and UI config lives in the **database** (the `clients` row and child tables), edited through the admin panel.
- Only the **general bot token** and provider API keys live in env.

---

## API overview

Base path: `/api`. All endpoints require `Authorization: Bearer <jwt>` except `POST /auth/login`. `ClientAccessGuard` confines `client_admin` users to their own `clientId`.

### Auth — `/api/auth`

| Method | Path | Who | What |
|---|---|---|---|
| POST | `/login` | — | Exchange login + password for a JWT |
| GET | `/me` | any | Current user profile |
| GET | `/users` | super_admin | List all admin users |
| POST | `/users` | super_admin | Create a user |
| PATCH | `/users/:id/reset-password` | super_admin | Reset a user's password |
| PATCH | `/users/:id/active` | super_admin | Activate/deactivate a user |
| PATCH | `/users/me/password` | any | Change own password |

### Clients — `/api/clients`

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/` | any | List clients (CLIENT_ADMIN gets only their own) |
| GET | `/:id` | client-scoped | Full client + products + services |
| POST | `/` | super_admin | Create client (optionally with `adminCredentials` to also create a `client_admin` user) |
| POST | `/demo` | super_admin | Seed a demo client (`{ type, lang }`) |
| PATCH | `/:id` | client-scoped | Update client (role-aware field filtering) |
| DELETE | `/:id` | super_admin | Delete client + stop its dedicated bot |
| POST | `/:id/products` | client-scoped | Add product |
| PATCH | `/products/:productId` | any | Update product |
| DELETE | `/products/:productId` | any | Delete product |
| POST | `/:id/services` | client-scoped | Add service |
| PATCH | `/services/:serviceId` | any | Update service |
| DELETE | `/services/:serviceId` | any | Delete service |

### Orders — `/api/orders`

| Method | Path | What |
|---|---|---|
| GET | `/` | List orders (scoped to own client for CLIENT_ADMIN) |
| GET | `/client/:clientId` | Orders for a client |
| GET | `/:id` | Order detail |
| PATCH | `/:id/status` | Set `pending` / `confirmed` / `cancelled` |

### Leads — `/api/leads`

| Method | Path | What |
|---|---|---|
| GET | `/` | List leads (scoped for CLIENT_ADMIN) |
| GET | `/client/:clientId` | Leads for a client |
| GET | `/:id` | Lead detail |
| PATCH | `/:id/status` | Set `new` / `contacted` / `closed` |

### AI — `/api/ai`

| Method | Path | What |
|---|---|---|
| POST | `/generate-description` | Generate a short product/service description `{ name, type, keywords? }` |

### Analytics — `/api/analytics`

| Method | Path | What |
|---|---|---|
| GET | `/dashboard` | Aggregate stats + recent activity |
| GET | `/clients/:id/messages` | Paginated chat transcript (`?page=&limit=`) |

---

## Current limitations

These are *not currently in the code* — mentioned so you don't have to go looking.

- **Polling only.** Telegram bots run in long-polling mode; there is no webhook server. Not a problem at moderate volume; start with webhooks if you expect heavy traffic on one bot.
- **Plaintext bot tokens at rest.** Per-client Telegram tokens are stored as plain `varchar` in the DB. Production deployments should wrap this column with application-level encryption or column-level DB encryption.
- **Plaintext provider API keys in `.env`.** Same posture as the general bot token. No secret manager integration.
- **No payment integration.** The order flow captures intent (items, phone, address) but does not charge. Stripe / Click / Payme etc. must be added.
- **No webhooks to the admin.** Admin notifications go to Telegram only — no email, SMS, or webhook outbound.
- **No rate limiting / abuse controls.** A hostile user can spam messages into the AI; the bot will keep answering until the provider errors.
- **Flow state is in-memory.** `FlowStateService` uses a process-local `Map` with TTL. Restarting the backend mid-conversation drops any in-progress cart/lead state. Scaling to multiple backend instances would need a shared store (Redis).
- **No end-to-end tests.** Only the `tsc --noEmit` gate is wired up.
- **No Docker / Compose file.** Deployment is currently "run it yourself."
- **No CI.** No GitHub Actions or similar.
- **No CSV / export.** Orders and leads can only be viewed through the admin; no CSV download.
- **Single-region assumption.** No multi-region DB strategy, no CDN config for the admin panel.

---

## Future improvements

Practical, incremental things — not speculative.

- **Encrypted secret columns** (`bot_token`, provider keys if stored per client) using `pgcrypto` or application-side AES.
- **Webhook mode for bots** so the service works behind stateless load balancers.
- **Redis-backed flow state** so in-progress carts survive restarts and horizontal scaling.
- **Payment integration** (Click / Payme for the Uzbek market, Stripe internationally) bolted onto the order flow's confirmation step.
- **Bulk operations** in the admin (import products from CSV, export orders/leads to CSV).
- **Analytics time-series**: daily message / order / lead charts on the dashboard (currently only counters + recents).
- **Webhooks out** (POST to a client-configured URL on new order/lead) so businesses can wire this into their own CRM.
- **Third LLM provider** (Anthropic) — one service file, zero caller changes thanks to the `LlmProvider` interface.
- **Voice messages / images** in the bot — Telegram supports them; the AI layer would need per-provider branches.
- **Audit log** of admin actions (who changed a client's prompt, when) — useful for trust with paying customers.
- **Rate limiting per chat** at the bot layer — simple token-bucket in memory, or Redis-backed.
- **CI** (typecheck + build + migration dry-run) and a **Dockerfile** + compose file.
- **Rotate-friendly token validation** — periodic `getMe` call on each dedicated bot to surface revoked tokens in the admin UI.

---

## What this system can do (full capability breakdown)

This section enumerates everything the code in this repository currently does. If a behavior isn't listed here, it isn't implemented.

### End-user flows (Telegram side)

**Joining a business's bot.** Two paths:
1. **Shared bot.** The user taps a deeplink `https://t.me/<general-bot>?start=<slug>`. The backend looks up the client by slug, stores a chat session binding the `chatId` to the `clientId`, and sends the client's welcome message + localized main menu. The language is preserved if the user has used the platform before; otherwise the client's `defaultLang` applies.
2. **Dedicated bot.** The user taps `https://t.me/<client-specific-bot>`. No slug required — the bot's binding fixes the `clientId`. If the user types before hitting Start, a session is auto-provisioned.

**Main menu.** Rendered as a reply keyboard. Buttons are driven by the client's `botConfig.menuButtons` and `botConfig.buttonIcons` — so different clients can show different button sets. Possible buttons:
- *Products*, *Services*, *Order* (order-type clients)
- *About*, *Prices* (lead-type clients)
- *Contact*, *Language*, *AI chat* (all clients)

**Language switching.** `/lang` or the Language button shows an inline keyboard of uz / ru / en. Selection persists to the `chat_sessions` row and is applied to every subsequent message.

**Browsing products.** Clicking *Products* renders an inline keyboard of active products with inline prices in the client's currency. Tapping a product shows its detail with a "Buy" button (order-type) or a "Back" button (lead-type).

**Placing an order (order-type clients).**
- Select a product from the catalog or directly from *Order*.
- Pick quantity via inline buttons (+/- or numeric).
- Add another product (cart) or continue to checkout.
- Enter phone number (free text).
- Enter delivery address (free text, optional).
- Confirm order. Row written to `orders` + `order_items`. An admin notification is sent to the client's `adminChatId` through *that client's* bot (dedicated if configured, general otherwise), including line items and total.

**Leaving a lead (lead-type clients).**
- Any free-text message is treated as an AI chat question. The reply is shown with a persistent "Leave your contact" button.
- Tapping the button collects name, phone, and optionally an AI-summarized version of the last question, then writes a row to `leads` and notifies the admin via Telegram.

**AI chat.**
- Order-type: user enters AI chat mode by tapping the AI Chat menu button; any free-text message is sent to the configured LLM with the client's system prompt + recent history, and the reply comes back.
- Lead-type: the lead flow transparently wraps AI chat so that every reply re-exposes the "Leave contact" CTA.

**Contact.** Shows the client's `botConfig.contactPhone` and `contactWebsite` if configured.

**Expired state.** If a user taps an old inline button after the in-memory flow TTL has elapsed, the router falls back gracefully and re-initializes the relevant flow.

### Admin capabilities

**Super admin (`super_admin`).**
- Log in, view dashboard totals and recent activity.
- List, create, update, delete clients.
- Seed a demo client with a single API call or UI action (Pizza Place / Dental Clinic, uz/ru/en).
- Change every client field — including the ones locked for client admins: bot type, default language, currency, `hasProducts`, `hasServices`, `slug`, `isActive`.
- Enable/disable admin user accounts, reset their passwords, change own password.
- Access every client's orders, leads, chat history.

**Client admin (`client_admin`).**
- See only their own client — the `/clients` list is auto-redirected to `/clients/<their id>`.
- Edit name, system prompt, admin chat ID, AI provider, AI model, and bot token / dedicated-bot connection.
- Manage products and services (add, edit, delete, toggle active).
- Browse their orders and leads; update statuses.
- Browse chat history for their bot.
- View/copy/print/share their bot's QR and deep link.

**Shared UI affordances.**
- Back button (history-aware, hides on root).
- Mobile card layout on orders/leads; desktop table.
- Empty states that tell you what to do next (share the bot link).
- Toast notifications for save/delete/error outcomes.
- QR share dialog from any page within client detail.

### AI behavior

- Every incoming free-text message (order or lead flow, AI chat mode) is routed to the client's configured provider/model.
- System prompt is built per call: starts from `client.systemPrompt`, appends a "respond in <language>" directive, then lists active products/services with names, descriptions, and prices in the client currency.
- Recent chat history (from `chat_history`) is prepended so the model has continuity.
- Replies longer than 2000 chars are truncated with an ellipsis so Telegram doesn't reject them.
- Admins can generate a product/service description from just a name + optional keywords via the modal in the catalog page.

### Automation

- **Bot lifecycle.** `BotRegistry` starts the general bot on boot, walks the DB for clients with `botToken`, and starts a dedicated polling instance for each. When a client updates/removes its token, the registry validates via `getMe` and reconciles (`stopPolling` + relaunch, or shutdown). On client delete, the dedicated bot is shut down before the DB row is removed.
- **Admin notifications.** On every new order and new lead, a templated Telegram message goes to the client's `adminChatId` through the same bot instance the user interacted with. Zero manual polling needed.
- **Session persistence.** `chat_sessions` survives restarts, so users don't lose their language preference or their client binding.
- **Demo seeding.** One call builds a realistic client (name with random suffix, unique slug, localized catalog, localized system prompt) so a fresh environment is immediately demoable.

### Integrations

- **Telegram Bot API** via `node-telegram-bot-api`. Polling. Multiple concurrent instances (one per dedicated client + one general).
- **Google Generative AI** via `@google/generative-ai`.
- **OpenAI** via the `openai` SDK (Chat Completions endpoint).
- **PostgreSQL** via TypeORM repositories.
- **Web Share API** in the admin panel (native mobile share sheet when available, clipboard fallback on desktop).

### Security posture

- Bcrypt-hashed passwords.
- JWT in `Authorization` header; `localStorage` on the admin panel.
- Two guards applied globally on client-scoped endpoints: `RolesGuard` + `ClientAccessGuard`.
- DTO validation on every write (`class-validator`).
- Server-side defense-in-depth on client updates: even if a CLIENT_ADMIN crafts a request touching locked fields, the service strips them before the save.
- Tokens and keys are plaintext in env / DB — the honest baseline, with [encryption listed as the first future improvement](#future-improvements).

### Operational shape

- Two separately deployable packages (`backend/`, `admin-panel/`). The backend is the long-running process; the admin panel is a static SPA.
- Runtime config lives in the DB (clients, products, services, prompts, tokens, bot configs). Only the general bot token and provider keys stay in env.
- Polling workers are in-process; scaling beyond one backend instance requires externalizing flow state (noted above).
