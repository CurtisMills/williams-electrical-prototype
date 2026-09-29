# Williams Electrical – Staff App Prototype

A mobile-first, full-stack TypeScript prototype for **Williams Electrical**: a field app for engineers and an office portal, both behind a sign-in. It is a working prototype for discussion, not production code.

## Stack

- **Next.js 16 (App Router)**: React front end and TypeScript API routes in one project
- **Tailwind CSS v4**, **lucide-react** icons
- **Sign-in:** signed, httpOnly session cookies (HMAC-SHA256), one per portal, checked by `src/proxy.ts` and again in every page and API route
- **Storage:** JSON file on the server (`.data/field-store.json`, gitignored) for time logs and holiday requests

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. The root URL sends phones to the field sign-in and desktops to the office sign-in (or straight into the app if already signed in).

| Route | For | Notes |
| --- | --- | --- |
| `/field/login` | Engineers (mobile-first) | Also works on desktop |
| `/field` | Today's jobs, start/finish job | Bottom tabs on phones, header tabs on desktop |
| `/field/holiday` | Request holiday, see status | |
| `/office/login` | Office staff (desktop-first) | Also works on phones |
| `/office` | Holiday requests, approve/decline, availability by date | Sidebar on desktop, top tabs on phones |
| `/office/team` | Each engineer's jobs today with recorded start/finish times | |

Both portals can be signed in at the same time in one browser. Sign out is in the account menu (field) or the sidebar (office).

### Demo accounts (sample)

All demo accounts use the password **`Williams2026!`** (override with `DEMO_PASSWORD`).

| Portal | Email |
| --- | --- |
| Field | `jordan.price@williamselectrical.co.uk` (also `sam.morgan@…`, `rhys.davies@…`, `cerys.thomas@…`, `owen.hughes@…`, `lowri.jenkins@…`, `alex.evans@…`, `pat.green@…`) |
| Office | `megan.lloyd@williamselectrical.co.uk`, `gareth.williams@williamselectrical.co.uk` |

Engineer accounts can't sign in to the office portal and vice versa.

## Rules enforced on the server

- Only one active job per engineer; a job can be started once and finished once (double taps are rejected).
- Holiday: first day today or later, last day on or after the first, at least one working day, up to 15 working days, no overlap with the engineer's own pending or approved requests. Weekends are excluded; bank holidays are not.
- Only office users can approve or decline, and only pending requests.
- Engineers only ever see their own holiday requests and jobs.

## What is still sample data

- The staff directory and shared demo password (`src/lib/auth/users.ts`).
- Engineers' daily jobs: `getAssignedJobs(engineerId, date)` in `src/lib/field/sample-data.ts` is the JobLogic seam. It returns `AssignedJob[]`, and an integration only needs to replace that function.
- Seeded holiday requests and the 25-day annual allowance.
- To reset field data, stop the server and delete `.data/field-store.json`, or `POST /api/field/reset` while signed in to the office.
- Set `SESSION_SECRET` for anything beyond local use. The file store needs a writable disk, so it won't persist on serverless hosting as-is.

## API

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/auth/login` `{ email, password, portal: "field" \| "office" }` | Public |
| POST | `/api/auth/logout` (form field `portal`) | Public |
| GET | `/api/field/today` | Engineer |
| POST | `/api/field/jobs/:id/start`, `/api/field/jobs/:id/finish` | Engineer |
| GET | `/api/field/holidays` (`?status=`) | Engineer (own) / Office (all) |
| POST | `/api/field/holidays` `{ firstDay, lastDay, note? }` | Engineer |
| PATCH | `/api/field/holidays/:id` `{ status: "approved" \| "declined" }` | Office |
| POST | `/api/field/reset` | Office |

## Customer portal wireframe

The earlier customer-facing wireframe (quotes, services, job tracking) is kept at `/customer`. It is not linked from the staff app and is not behind sign-in.

## Project layout

```
src/
  proxy.ts            # Route gating for /field and /office
  app/
    page.tsx          # Root redirect (device + session aware)
    field/            # login/ and (app)/ Today + Holiday
    office/           # login/ and (app)/ Overview + Team
    customer/         # Customer wireframe
    api/              # auth/, field/, and customer endpoints
  components/         # auth/, field/, office/ UI
  lib/
    auth/             # Session token, staff directory, session helpers
    field/            # Types, dates, sample data, file store
```
