# Williams Electrical Staff Portal (prototype)

A working demonstration of the **Williams Electrical Staff Portal**: a mobile-first Employee experience and an Office experience for planners and administrators. It covers time recording and holiday, plus the attendance, crew planning, timesheet and export tools the office needs around them. Every screen runs on **sample demo data**, which is labelled as such throughout. This is a prototype for discussion, not production code.

## Stack

- **Next.js 16 (App Router)**: React front end and TypeScript API routes in one project
- **Tailwind CSS v4** with the brand tokens in `src/app/globals.css`, **Manrope** loaded locally (`src/app/fonts/`, SIL OFL), **lucide-react** outline icons
- **Shared UI:** `src/components/portal/` (Button, TextField, StatusBadge, PageHeading, JobCard, TimeRecord, HolidayRequest, AvailabilitySummary, Notice, Dialog)
- **Sign-in:** signed, httpOnly session cookies (HMAC-SHA256), one per portal. `src/proxy.ts` checks them, and every page and API route checks the role again on the server.
- **Storage:** a JSON file on the server (`.data/we-store.json`, gitignored). Writes are serialised and use version checks; each change writes an audit entry and, where relevant, a notification.
- **Time zone:** everything is calculated in Europe/London, including across clock changes. A session that runs past midnight is split between the two days.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. The root URL sends phones to the employee sign-in and desktops to the office sign-in.

### Demo accounts

Every account uses the password **`Williams2026!`** (override with `DEMO_PASSWORD`).

| Portal | Person | Email |
| --- | --- | --- |
| Employee | Jordan Price, electrician | `jordan.price@williamselectrical.co.uk` |
| Employee | Rhys Davies, electrician (has an unfinished session from an earlier day) | `rhys.davies@williamselectrical.co.uk` |
| Employee | Also `sam.morgan@`, `cerys.thomas@`, `owen.hughes@` (electricians), `alex.evans@`, `pat.green@`, `lowri.jenkins@` (apprentices) | `…@williamselectrical.co.uk` |
| Office | Megan Lloyd, office administrator | `megan.lloyd@williamselectrical.co.uk` |
| Office | Gareth Williams, director and planner | `gareth.williams@williamselectrical.co.uk` |

Once signed in, **Demo tools** in the strip under the header lets you **view the app as** any other person (employee or office) without signing out. It also has **Reset demo data**, which restores the seeded scenario and clears any taps still waiting on the phone.

## Screens

| Route | Who | What it does |
| --- | --- | --- |
| `/field` | Employee | **Today.** The next job first, with address, maps link, access notes and planned hours, then **Start job**. The button shows "Starting…" and can't be tapped twice; "Started at 08:02" appears only once the server confirms it (or "saved on this phone" when offline). The active job card has Finish job (with a confirm step), Start break/Resume work and Change job. Start other work (another job, travel, or "can't find the job" with a note). If a session is still open from an earlier day, the employee is asked for the finish time first. Also shows what's been recorded today and the next seven days. |
| `/field/leave` | Employee | **Holiday.** Balance left, approved and pending. Request holiday for full or half days, with the duration and balance previewed as you pick dates (blocked if it would go over). Pending, Approved and Declined states with a reference. Withdraw a pending request or ask to cancel approved holiday. History. |
| `/field/hours` | Employee | **Time (My time).** Week-by-week recorded hours, **Correct** on any record, a form for forgotten entries, and correction requests with their status. **Send this week to the office** as a timesheet. |
| `/field/notifications` | Employee | Decisions on holiday, corrections and timesheets, and new assignments. |
| `/office` | Office | **Today ("The crew today").** Summary counts for working, due to start, no start recorded, on holiday and holiday requests; each links to the matching records. Crew table with status, job and site, start, hours worked and last update. **No start recorded** is shown as an information gap, not an absence. Pending holiday requests with crew availability and **Review request**, and a "Needs attention" list. Refreshes every 20 seconds. |
| `/office/exceptions` | Office | **Needs attention.** Missing finishes, no start recorded, correction requests (original and proposed values side by side, approve or reject inline), work without a job, unusually long sessions, conflicting phone taps, needs-replacement slots and timesheets to review. The warning thresholds (Settings) are editable here. |
| `/office/history` | Office | Search records by person, job, customer, date and status. Add a record on someone's behalf. |
| `/office/records/[id]` | Office | Record detail: original values, the phone taps received, a correction form (reason required), remove/restore, and the full audit trail. |
| `/office/leave`, `/office/leave/[id]` | Office | **Holiday.** Requests waiting (with crew availability), cancellation requests, booked holiday and history. The review page shows requested days, the balance, crew availability led by the tightest day with a "View day" link into the crew plan, affected planned work and who could cover, and who else is off. **Approve holiday** (low cover is a warning, not a block) or decline with a reason. The office can also record holiday directly. |
| `/office/planning` | Office | **Crew.** Six-week plan in daily or weekly view: a person-by-day grid with job chips, absences and free hours. Unfilled places and needs-replacement flags. The preview toggle adds pending holiday and tentative jobs with dashed outlines, kept separate from the confirmed plan. |
| `/office/planning/jobs/[id]` | Office | Staffing by day for one job: requirements by role, assign people (single day or across a date range, listing the days skipped), and "Why not others?" explaining each blocked candidate (on leave, wrong role, already booked, not a working day). |
| `/office/jobs` | Office | **Jobs.** Jobs, customers and sites. Create jobs and sites, and change job status (reopening needs a reason). |
| `/office/timesheets`, `/office/timesheets/[employeeId]` | Office | Weekly timesheets by employee or by customer and job, with filters and a comparison with the previous week. Approve or request changes. A later correction reopens an approved week automatically. |
| `/office/exports` | Office | Employee CSV, customer CSV and a printable customer summary. Final exports use approved timesheets only; a draft preview includes unapproved ones. Every export is logged and marked **Superseded** if a later correction changes an approved week. |
| `/office/notifications` | Office | New requests, submissions and phone conflicts. |

Both portals can be signed in at the same time in one browser. Employees can't open the office portal and vice versa.

## Defaults used where company policy wasn't specified

These are sensible defaults for the demo. Confirm each one before real use.

- **Leave year:** January to December. The allowance is 25 days (Owen Hughes 20, as he works Monday to Thursday). Bank holidays are extra and never taken from the allowance.
- **Bank holidays:** England and Wales, 2026–2027 (`src/lib/we/seed.ts`).
- **Half days:** morning 08:00–12:00 and afternoon 12:00–16:00. A full working day is 08:00–16:00.
- **Timesheet week:** Monday to Sunday.
- **Long session warning:** over 11 hours. **No start recorded:** 30 minutes after the planned start with nothing received. Both can be changed under Settings on the Needs attention page.
- **Role matching is strict:** an apprentice can't fill an electrician place and vice versa.
- **A break entered by hand** in a correction is placed in the middle of the session.
- **A forgotten finish from an earlier day**, entered by the employee, applies straight away so they can start today. It still goes to the office to confirm, and the office can edit or reject it.
- **Duplicates:** starting while already working is rejected, and each phone tap carries a unique ID so a retried tap is never counted twice.

## Working offline

Taps on the employee app are saved on the phone with the time they happened, and sent in order when the signal returns. The screen shows the queued taps straight away with a "waiting to send" banner. The office sees the record once it arrives. The recorded time is when the employee tapped, not when it synced, and "Last update received" shows the gap. If a queued tap conflicts with something the office changed in the meantime, it is kept and flagged on the Needs attention page rather than silently dropped. A service worker keeps the `/field` pages available without a connection.

## Eight-step demo script

1. Sign in as **Jordan** on a phone and tap **Start job**. Sign in as **Megan** on a desktop: Jordan shows as Working on Office Today.
2. Jordan taps **Change job**, then **Finish job**. Both records appear under My time and in Work history.
3. Jordan requests holiday on a future day with planned work. Megan sees it on Holiday with crew availability and the affected work.
4. Megan approves despite the warning. The job's slot now shows as unfilled on Crew and Needs attention.
5. On the job's planning page, Megan assigns a replacement. The shortage clears and the replacement gets a notification.
6. Megan corrects **Rhys's** missing finish from an earlier day, giving a reason. The audit trail records it and his totals update.
7. Jordan sends the week from My time. Megan approves it on Timesheets.
8. Megan downloads the employee and customer CSVs and opens the printable customer summary on Exports.

To check the same scenario automatically against a temporary copy of the data:

```bash
npm run demo:check
```

It runs all eight steps plus a check that a correction to an approved week reopens it and supersedes its export.

The presentation rules behind the time and holiday screens (which job shows first, crew availability and low cover, "Not available" balances) have their own check:

```bash
npm run ui:check
```

## Configuration

| Variable | Default | Effect |
| --- | --- | --- |
| `DEMO_PASSWORD` | `Williams2026!` | Password for every demo account |
| `DEMO_MODE` | on | Set to `off` to hide the view-as switch, the reset and the demo labels |
| `SESSION_SECRET` | dev value | Set for anything beyond local use |
| `FIELD_DATA_DIR` | `.data` | Where the JSON store is written |

To reset the data, use **Reset demo data** in the Demo menu, or stop the server and delete `.data/we-store.json`.

## What is still sample data

- The staff directory and shared password (`src/lib/auth/users.ts`, `src/lib/we/seed.ts`).
- Customers, sites, jobs, assignments, leave and recorded sessions, all seeded relative to today in `src/lib/we/seed.ts`. A job system integration would replace the jobs and assignments.
- The file store needs a writable disk, so it won't persist on serverless hosting as it stands.

## Customer portal wireframe

The earlier customer-facing wireframe (quotes, services, job tracking) is kept at `/customer`. It isn't linked from the staff app and isn't behind sign-in.

## Project layout

```
src/
  proxy.ts              # Route gating for /field and /office
  app/
    field/              # Employee: login/ and (app)/ Today, leave, hours, notifications
    office/             # Office: login/, (app)/ screens, print/ customer summary
    api/                # auth/, field/, office/, demo/, notifications
  components/           # Shared, field/ and office/ UI, offline queue, demo menu
  lib/
    auth/               # Session token, staff directory, session helpers
    we/                 # Types, store, calculations, seed, and domain actions
                        # (work, leave, planning, timesheets, exports, views, admin)
scripts/demo-check.ts   # Automated eight-step demo run
public/sw.js            # Service worker for offline employee pages
```
