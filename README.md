# Williams Electrical – Mobile Web App Prototype

A lightweight, mobile-first, full-stack TypeScript prototype showing what a customer-facing app for **Williams Electrical** could look like. It's intended as a clickable wireframe for scoping conversations, not production code.

## Stack

- **Next.js 16 (App Router)** – React front end and TypeScript API in one project
- **TypeScript** throughout, with shared types in `src/lib/types.ts`
- **Tailwind CSS v4** for styling, **lucide-react** for icons
- **In-memory data store** (`src/lib/db.ts`) seeded with demo data. It resets when the server restarts.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. On a desktop browser the app renders inside a phone frame. On a phone it fills the screen, so you can open it via your machine's LAN IP to demo on a real device.

## What's in the prototype

| Screen | Route | Purpose |
| --- | --- | --- |
| Home | `/` | Emergency call CTA, quick actions, upcoming visit, popular services |
| Services | `/services` | Service catalogue with "from" pricing, grouped by home, business and emergency |
| Request a quote | `/quote` | 3-step form (job, location, contact) that posts to the API |
| My jobs | `/jobs` | Active and completed jobs with live status |
| Job detail | `/jobs/[id]` | Progress tracker, engineer contact, documents, activity timeline |
| Account | `/account` | Profile, saved properties, settings placeholders |

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/services` | List services |
| GET | `/api/jobs` | List the customer's jobs |
| GET | `/api/jobs/:id` | Job detail |
| POST | `/api/quotes` | Create a quote request (validated server-side, returns the new job) |

## Project layout

```
src/
  app/            # Pages (server components) and API route handlers
  components/     # Shared UI (bottom nav, cards, badges, icons)
  lib/            # Types, data layer, formatting helpers
```

## Possible next steps for the full build

- Real database (Postgres + Prisma/Drizzle) behind the existing `src/lib/db.ts` functions
- Authentication (magic link / SMS OTP) and per-customer data
- Engineer/admin views: job scheduling, quoting, certificate upload
- Online payments (Stripe), quote acceptance and booking slots
- Push/SMS notifications for job updates, PWA install support
- Photo uploads for quote requests
