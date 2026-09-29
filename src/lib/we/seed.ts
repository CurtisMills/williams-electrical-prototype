// DEMO DATA: fictional people, customers, jobs and hours. Generated relative to today so the
// scenario always has eight weeks of history and six weeks of upcoming work.

import { addDays, daysBetween, isoWeekday, londonIso, todayKey, weekStartOf } from "@/lib/field/dates";
import { dailySplit, isBookedLeave, leaveInterval, intersects, sumDays, worksOn } from "./calc";
import type {
  Assignment,
  Customer,
  Employee,
  Job,
  LeaveDay,
  LeaveRequest,
  Requirement,
  Settings,
  Site,
  StaffRole,
  Timesheet,
  Unavailability,
  WeStore,
  WorkSession,
} from "./types";
import { toMinutes } from "@/lib/field/dates";

const MON_FRI = [1, 2, 3, 4, 5];
const day = { start: "08:00", end: "16:00" };

export const DEMO_EMPLOYEES: Employee[] = [
  { id: "eng-jordan", ref: "EMP-01", name: "Jordan Price", initials: "JP", role: "electrician", pattern: { days: MON_FRI, ...day }, allowanceDays: 25, active: true },
  { id: "eng-sam", ref: "EMP-02", name: "Sam Morgan", initials: "SM", role: "electrician", pattern: { days: MON_FRI, ...day }, allowanceDays: 25, active: true },
  { id: "eng-rhys", ref: "EMP-03", name: "Rhys Davies", initials: "RD", role: "electrician", pattern: { days: MON_FRI, ...day }, allowanceDays: 25, active: true },
  { id: "eng-cerys", ref: "EMP-04", name: "Cerys Thomas", initials: "CT", role: "electrician", pattern: { days: MON_FRI, ...day }, allowanceDays: 25, active: true },
  { id: "eng-owen", ref: "EMP-05", name: "Owen Hughes", initials: "OH", role: "electrician", pattern: { days: [1, 2, 3, 4], ...day }, allowanceDays: 20, active: true },
  { id: "eng-alex", ref: "EMP-06", name: "Alex Evans", initials: "AE", role: "apprentice", pattern: { days: MON_FRI, ...day }, allowanceDays: 25, active: true },
  { id: "eng-pat", ref: "EMP-07", name: "Pat Green", initials: "PG", role: "apprentice", pattern: { days: MON_FRI, ...day }, allowanceDays: 25, active: true },
  { id: "eng-lowri", ref: "EMP-08", name: "Lowri Jenkins", initials: "LJ", role: "apprentice", pattern: { days: MON_FRI, ...day }, allowanceDays: 25, active: true },
];

// England and Wales bank holidays. Confirm the company calendar before using real balances.
export const DEFAULT_SETTINGS: Settings = {
  longSessionHours: 11,
  noStartGraceMinutes: 30,
  leaveYearStartMonth: 1,
  bankHolidays: [
    { date: "2026-01-01", name: "New Year’s Day" },
    { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-06", name: "Easter Monday" },
    { date: "2026-05-04", name: "Early May bank holiday" },
    { date: "2026-05-25", name: "Spring bank holiday" },
    { date: "2026-08-31", name: "Summer bank holiday" },
    { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-28", name: "Boxing Day (substitute)" },
    { date: "2027-01-01", name: "New Year’s Day" },
    { date: "2027-03-26", name: "Good Friday" },
    { date: "2027-03-29", name: "Easter Monday" },
    { date: "2027-05-03", name: "Early May bank holiday" },
    { date: "2027-05-31", name: "Spring bank holiday" },
    { date: "2027-08-30", name: "Summer bank holiday" },
    { date: "2027-12-27", name: "Christmas Day (substitute)" },
    { date: "2027-12-28", name: "Boxing Day (substitute)" },
  ],
};

const CUSTOMERS: Customer[] = [
  { id: "cus-crosshands", ref: "CUS-01", name: "Cross Hands Developments Ltd", contact: "Bethan Rees · 01269 000 111" },
  { id: "cus-tywi", ref: "CUS-02", name: "Tywi Valley College", contact: "Estates team · 01267 000 222" },
  { id: "cus-glanrhyd", ref: "CUS-03", name: "Glanrhyd Farm Partnership", contact: "Huw Jones · 07700 900 333" },
  { id: "cus-aber", ref: "CUS-04", name: "Aber Housing Association", contact: "Repairs desk · 01554 000 444" },
];

const SITES: Site[] = [
  {
    id: "site-unit4", ref: "SITE-01", customerId: "cus-crosshands", name: "Unit 4, Cross Hands Business Park",
    address: "Unit 4, Cross Hands Business Park, Cross Hands SA14 6RB", contactName: "Bethan Rees", contactPhone: "01269 000 111",
    access: "Sign in at the gate lodge. Hi-vis and boots at all times. Park in bays 20–24.",
  },
  {
    id: "site-unit9", ref: "SITE-02", customerId: "cus-crosshands", name: "Unit 9, Cross Hands Business Park",
    address: "Unit 9, Cross Hands Business Park, Cross Hands SA14 6RB", contactName: "Bethan Rees", contactPhone: "01269 000 111",
    access: "Key safe by the loading door, code from the office. Alarm panel inside on the left.",
  },
  {
    id: "site-tywi", ref: "SITE-03", customerId: "cus-tywi", name: "Tywi Valley College, Block C",
    address: "Block C, Pibwrlwyd Campus, Carmarthen SA31 2NH", contactName: "Estates office", contactPhone: "01267 000 222",
    access: "Report to the estates office for a contractor badge. Plant room key held at reception.",
  },
  {
    id: "site-glanrhyd", ref: "SITE-04", customerId: "cus-glanrhyd", name: "Fferm Glanrhyd",
    address: "Fferm Glanrhyd, Llandeilo SA19 6PP", contactName: "Huw Jones", contactPhone: "07700 900 333",
    access: "Farm dog on site. Park by the grain store and call Huw on arrival.",
  },
  {
    id: "site-harbour", ref: "SITE-05", customerId: "cus-aber", name: "Harbour View Flats",
    address: "Harbour View Flats, Stepney Road, Burry Port SA16 0ER", contactName: "Site warden", contactPhone: "01554 000 444",
    access: "Residents have been notified. Keys from the warden in flat 1, returned by 16:00.",
  },
];

type Slot = { role: StaffRole; count: number; start: string; end: string; assignees: string[] };

function jitter(key: string, min: number, max: number) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return min + (Math.abs(h) % (max - min + 1));
}

const shift = (time: string, minutes: number) => {
  const total = toMinutes(time) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export function buildSeed(now: Date = new Date()): WeStore {
  const settings = structuredClone(DEFAULT_SETTINGS);
  const today = todayKey(now);
  const nowIso = now.toISOString();
  const w0 = weekStartOf(today);
  const histStart = addDays(w0, -56);
  const planEnd = addDays(w0, 41);
  const isWorkday = (d: string) => isoWeekday(d) <= 5 && !settings.bankHolidays.some((b) => b.date === d);
  let prevWorkDay = addDays(today, -1);
  while (!isWorkday(prevWorkDay)) prevWorkDay = addDays(prevWorkDay, -1);

  const counters: Record<string, number> = { S: 10000, L: 500, C: 300, A: 0, R: 0, X: 0, N: 0, U: 0, E: 0, T: 0, AU: 0, J: 2053 };
  const next = (prefix: string) => `${prefix}-${++counters[prefix]}`;

  const employees = structuredClone(DEMO_EMPLOYEES);
  const emp = (id: string) => employees.find((e) => e.id === id)!;

  const j4Start = addDays(w0, -14);
  const j4End = addDays(w0, 11);
  const jobs: Job[] = [
    { id: "job-2041", ref: "WE-2041", customerId: "cus-crosshands", siteId: "site-unit4", title: "Commercial fit-out", type: "Installation", status: "confirmed", startDate: histStart, endDate: planEnd, plannedHours: 1600 },
    { id: "job-2044", ref: "WE-2044", customerId: "cus-crosshands", siteId: "site-unit9", title: "Emergency lighting and fire alarm testing", type: "Testing", status: "confirmed", startDate: histStart, endDate: addDays(w0, 32), plannedHours: 200 },
    { id: "job-2046", ref: "WE-2046", customerId: "cus-tywi", siteId: "site-tywi", title: "BMS controls upgrade", type: "BMS", status: "confirmed", startDate: histStart, endDate: planEnd, plannedHours: 1100 },
    { id: "job-2049", ref: "WE-2049", customerId: "cus-glanrhyd", siteId: "site-glanrhyd", title: "Solar PV installation", type: "Solar", status: "confirmed", startDate: j4Start, endDate: j4End, plannedHours: 290 },
    { id: "job-2050", ref: "WE-2050", customerId: "cus-aber", siteId: "site-harbour", title: "Periodic inspection (EICR) programme", type: "Inspection", status: "confirmed", startDate: histStart, endDate: planEnd, plannedHours: 700 },
    { id: "job-2053", ref: "WE-2053", customerId: "cus-aber", siteId: "site-harbour", title: "Void flat rewire", type: "Rewire", status: "tentative", startDate: addDays(w0, 21), endDate: addDays(w0, 39), plannedHours: 240 },
  ];

  // Who is planned where, per working day.
  const plan = (jobId: string, d: string): Slot[] => {
    const dow = isoWeekday(d);
    const beforeJ4 = d < j4Start;
    switch (jobId) {
      case "job-2041":
        return [
          { role: "electrician", count: 1, ...day, assignees: ["eng-sam"] },
          dow === 2 || dow === 4
            ? { role: "electrician", count: 1, start: "08:00", end: "12:00", assignees: ["eng-jordan"] }
            : { role: "electrician", count: 1, ...day, assignees: ["eng-jordan"] },
          { role: "apprentice", count: 1, ...day, assignees: ["eng-alex"] },
        ];
      case "job-2044":
        return dow === 2 || dow === 4
          ? [{ role: "electrician", count: 1, start: "12:00", end: "16:00", assignees: ["eng-jordan"] }]
          : [];
      case "job-2046":
        return [
          { role: "electrician", count: 1, ...day, assignees: ["eng-rhys"] },
          { role: "apprentice", count: 1, ...day, assignees: ["eng-lowri"] },
        ];
      case "job-2049":
        return [
          { role: "electrician", count: 1, ...day, assignees: ["eng-cerys"] },
          ...(dow === 3 ? [] : [{ role: "apprentice" as const, count: 1, ...day, assignees: ["eng-pat"] }]),
        ];
      case "job-2050":
        if (dow === 5) return [];
        return beforeJ4
          ? [
              { role: "electrician", count: 2, ...day, assignees: ["eng-owen", "eng-cerys"] },
              ...(dow === 3 ? [] : [{ role: "apprentice" as const, count: 1, ...day, assignees: ["eng-pat"] }]),
            ]
          : [{ role: "electrician", count: 1, ...day, assignees: ["eng-owen"] }];
      case "job-2053":
        return [
          { role: "electrician", count: 1, ...day, assignees: [] },
          { role: "apprentice", count: 1, ...day, assignees: [] },
        ];
      default:
        return [];
    }
  };

  const requirements: Requirement[] = [];
  const assignments: Assignment[] = [];
  for (const job of jobs) {
    for (const d of daysBetween(job.startDate, job.endDate)) {
      if (!isWorkday(d)) continue;
      for (const slot of plan(job.id, d)) {
        const req: Requirement = { id: next("R"), jobId: job.id, date: d, role: slot.role, count: slot.count, start: slot.start, end: slot.end };
        requirements.push(req);
        for (const employeeId of slot.assignees) {
          assignments.push({
            id: next("A"), jobId: job.id, requirementId: req.id, employeeId, date: d, start: slot.start, end: slot.end,
            status: "confirmed", createdAt: addDays(d, -21) + "T09:00:00.000Z", createdBy: "office-megan",
          });
        }
      }
    }
  }

  // Apprentice college day every Wednesday for Pat.
  const unavailability: Unavailability[] = daysBetween(histStart, planEnd)
    .filter((d) => isoWeekday(d) === 3 && isWorkday(d))
    .map((d) => ({ id: next("U"), employeeId: "eng-pat", date: d, start: "08:00", end: "16:00", reason: "College day" }));

  const leave: LeaveRequest[] = [];
  const addLeave = (
    employeeId: string,
    days: LeaveDay[],
    status: LeaveRequest["status"],
    note = "",
    decisionReason = "",
    createdDaysAgo = 10,
  ) => {
    const created = new Date(now.getTime() - createdDaysAgo * 86400000).toISOString();
    const decided = status === "pending" ? null : new Date(now.getTime() - (createdDaysAgo - 1) * 86400000).toISOString();
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const request: LeaveRequest = {
      id: next("L"), employeeId, days: sorted, firstDay: sorted[0].date, lastDay: sorted[sorted.length - 1].date,
      totalDays: sumDays(sorted), note, status, cancellation: null, createdAt: created, createdBy: employeeId,
      decidedAt: decided, decidedBy: decided ? "office-megan" : null, decisionReason,
      history: [
        { at: created, by: employeeId, action: "submitted", reason: note },
        ...(decided ? [{ at: decided, by: "office-megan", action: status, reason: decisionReason }] : []),
      ],
      version: 1,
    };
    leave.push(request);
    return request;
  };
  const fullDays = (employeeId: string, first: string, last: string) =>
    daysBetween(first, last)
      .filter((d) => worksOn(emp(employeeId), d, settings))
      .map((d) => ({ date: d, portion: "full" as const }));

  // Earlier in the leave year (before the history window) so balances look lived-in.
  const summer = addDays(histStart, -28);
  addLeave("eng-jordan", fullDays("eng-jordan", summer, addDays(summer, 4)), "approved", "Summer holiday", "", 120);
  addLeave("eng-sam", fullDays("eng-sam", addDays(summer, 7), addDays(summer, 11)), "approved", "", "", 110);
  addLeave("eng-rhys", fullDays("eng-rhys", addDays(summer, -14), addDays(summer, -3)), "approved", "", "", 130);
  addLeave("eng-cerys", fullDays("eng-cerys", addDays(summer, 14), addDays(summer, 18)), "approved", "", "", 100);
  addLeave("eng-owen", fullDays("eng-owen", addDays(summer, 0), addDays(summer, 3)), "approved", "", "", 125);
  addLeave("eng-pat", fullDays("eng-pat", addDays(summer, 21), addDays(summer, 22)), "approved", "", "", 95);
  addLeave("eng-lowri", fullDays("eng-lowri", addDays(summer, -7), addDays(summer, -3)), "approved", "", "", 140);
  addLeave("eng-alex", fullDays("eng-alex", addDays(summer, 1), addDays(summer, 3)), "approved", "", "", 118);

  // Part-day leave in history, and current and upcoming leave.
  addLeave("eng-alex", [{ date: addDays(w0, -12), portion: "am" }], "approved", "Dentist", "", 30);
  addLeave("eng-alex", fullDays("eng-alex", today, addDays(today, 1)), "approved", "Moving house", "", 20);
  addLeave("eng-sam", fullDays("eng-sam", addDays(w0, 9), addDays(w0, 11)), "pending", "Family wedding", "", 2);
  addLeave("eng-cerys", [{ date: addDays(w0, 18), portion: "pm" }], "approved", "School concert", "", 6);
  addLeave("eng-lowri", fullDays("eng-lowri", addDays(w0, 14), addDays(w0, 14)), "approved", "Driving test", "", 8);
  addLeave("eng-owen", fullDays("eng-owen", addDays(w0, 7), addDays(w0, 7)), "declined", "", "Sam is already off that week and the EICR programme is due.", 12);
  addLeave("eng-pat", fullDays("eng-pat", addDays(w0, 25), addDays(w0, 25)), "withdrawn", "", "", 9);

  // Approved leave that clashes with an assignment leaves it needing a replacement.
  for (const a of assignments) {
    const employee = emp(a.employeeId);
    const interval: [number, number] = [toMinutes(a.start), toMinutes(a.end)];
    const clash = leave.find(
      (r) => r.employeeId === a.employeeId && isBookedLeave(r) &&
        r.days.some((d) => d.date === a.date && intersects(leaveInterval(d.portion, employee), interval)),
    );
    if (clash && a.date >= w0) {
      a.status = "needs_replacement";
      a.statusReason = `Approved leave ${clash.id}`;
    }
  }

  // ---- Recorded work (history, earlier this week, and so far today)
  const sessions: WorkSession[] = [];
  const at = (d: string, t: string) => londonIso(d, t);
  const addSession = (
    employeeId: string,
    d: string,
    start: string,
    finish: string | null,
    jobId: string | null,
    breaks: [string, string][] = [],
    activity: WorkSession["activity"] = "job",
    note = "",
  ) => {
    const startedAt = at(d, start);
    if (Date.parse(startedAt) > now.getTime()) return null;
    let finishedAt = finish ? at(d, finish) : null;
    if (finishedAt && Date.parse(finishedAt) > now.getTime()) finishedAt = null;
    const brks = breaks
      .map(([s, e]) => ({ start: at(d, s), end: at(d, e) as string | null }))
      .filter((b) => Date.parse(b.start) < now.getTime())
      .map((b) => (b.end && Date.parse(b.end) > now.getTime() ? { ...b, end: null } : b));
    const lastEventAt = finishedAt ?? [startedAt, ...brks.flatMap((b) => [b.start, b.end ?? b.start])].sort().at(-1)!;
    const session: WorkSession = {
      id: next("S"), employeeId, jobId, activity, note, startedAt, finishedAt, breaks: brks, source: "phone",
      receivedAt: new Date(Date.parse(startedAt) + 4000).toISOString(), lastEventAt, edited: false, voided: false,
      version: 1, original: null,
    };
    sessions.push(session);
    return session;
  };

  const lastWeek = addDays(w0, -7);
  const skipToday = new Set(["eng-jordan", "eng-owen", "eng-rhys"]);
  for (const d of daysBetween(histStart, today)) {
    for (const employee of employees) {
      if (!worksOn(employee, d, settings)) continue;
      if (d === today && skipToday.has(employee.id)) continue;
      if (unavailability.some((u) => u.employeeId === employee.id && u.date === d)) continue;
      const dayLeave = leave
        .filter((r) => r.employeeId === employee.id && isBookedLeave(r))
        .flatMap((r) => r.days)
        .find((x) => x.date === d);
      if (dayLeave?.portion === "full") continue;
      const mine = assignments
        .filter((a) => a.employeeId === employee.id && a.date === d)
        .sort((a, b) => a.start.localeCompare(b.start));
      if (mine.length === 0) continue;
      const k = `${employee.id}-${d}`;
      const early = jitter(k + "s", 0, 16);
      const late = jitter(k + "f", -8, 24);
      const lunch = jitter(k + "b", -10, 15);

      if (employee.id === "eng-rhys" && d === prevWorkDay) {
        addSession(employee.id, d, "07:48", null, mine[0].jobId, [["12:05", "12:35"]]);
        continue;
      }
      if (employee.id === "eng-sam" && d === addDays(lastWeek, 2)) {
        addSession(employee.id, d, "06:30", "19:45", mine[0].jobId, [["12:00", "12:30"]]);
        continue;
      }
      if (employee.id === "eng-lowri" && d === addDays(lastWeek, 4)) {
        addSession(employee.id, d, "08:02", "20:58", mine[0].jobId, [["12:00", "12:30"]]);
        continue;
      }
      if (employee.id === "eng-owen" && d === addDays(lastWeek, 3)) {
        addSession(employee.id, d, "07:55", "12:40", mine[0].jobId);
        addSession(employee.id, d, "13:10", "15:40", null, [], "unassigned", "Emergency call-out: tripping supply at the Harbour View shop. Couldn’t find a job for it.");
        continue;
      }
      if (dayLeave?.portion === "am") {
        addSession(employee.id, d, shift("12:30", early / 4), shift("16:00", late), mine[0].jobId);
        continue;
      }
      if (employee.id === "eng-cerys" && d === today) {
        addSession(employee.id, d, "07:58", "16:10", mine[0].jobId, [["10:15", "10:35"], ["12:00", "12:30"]]);
        continue;
      }
      if (mine.length === 1) {
        addSession(employee.id, d, shift("08:00", -early), shift("16:00", late), mine[0].jobId, [
          [shift("12:00", lunch), shift("12:30", lunch)],
        ]);
      } else {
        // Two jobs in a day: morning job, travel between sites, afternoon job.
        const [am, pm] = mine;
        const amEnd = shift(am.end, jitter(k + "e", 0, 8));
        addSession(employee.id, d, shift(am.start, -early), amEnd, am.jobId);
        addSession(employee.id, d, amEnd, shift(amEnd, 18), null, [], "travel", "Unit 4 to Unit 9");
        addSession(employee.id, d, shift(amEnd, 48), shift(pm.end, late), pm.jobId);
      }
    }
  }

  // ---- Timesheets: older weeks approved, last week in review, this week still draft.
  const weekMinutes = (employeeId: string, weekStart: string) =>
    sessions
      .filter((s) => s.employeeId === employeeId && !s.voided)
      .flatMap(dailySplit)
      .filter((x) => x.date >= weekStart && x.date <= addDays(weekStart, 6))
      .reduce((n, x) => n + x.netMinutes, 0);
  const lastWeekStatus: Record<string, Timesheet["status"]> = {
    "eng-jordan": "approved", "eng-alex": "approved", "eng-sam": "submitted", "eng-cerys": "submitted",
    "eng-pat": "submitted", "eng-lowri": "submitted", "eng-rhys": "changes_requested", "eng-owen": "draft",
  };
  const timesheets: Timesheet[] = [];
  for (let w = 8; w >= 1; w--) {
    const weekStart = addDays(w0, -7 * w);
    for (const employee of employees) {
      const status = w === 1 ? lastWeekStatus[employee.id] : "approved";
      const submittedAt = status === "draft" ? null : at(addDays(weekStart, 4), "16:30");
      const approvedAt = status === "approved" ? at(addDays(weekStart, 7), "10:00") : null;
      const minutes = weekMinutes(employee.id, weekStart);
      timesheets.push({
        id: next("T"), employeeId: employee.id, weekStart, status, revision: 1,
        approvedMinutes: status === "approved" ? minutes : null, approvedAt, approvedBy: approvedAt ? "office-megan" : null,
        submittedAt, returnReason: status === "changes_requested" ? "Please add your lunch break on Thursday." : "",
        reopenedReason: "",
        history: [
          ...(submittedAt ? [{ at: submittedAt, by: employee.id, action: "submitted", revision: 1, reason: "" }] : []),
          ...(approvedAt ? [{ at: approvedAt, by: "office-megan", action: "approved", revision: 1, reason: "" }] : []),
          ...(status === "changes_requested"
            ? [{ at: at(addDays(weekStart, 7), "09:30"), by: "office-megan", action: "changes_requested", revision: 1, reason: "Please add your lunch break on Thursday." }]
            : []),
        ],
        version: 1,
      });
    }
  }

  const lowriFriday = sessions.find((s) => s.employeeId === "eng-lowri" && s.startedAt.startsWith(addDays(lastWeek, 4)));
  const corrections: WeStore["corrections"] = lowriFriday
    ? [
        {
          id: next("C"), employeeId: "eng-lowri", sessionId: lowriFriday.id,
          proposed: { date: addDays(lastWeek, 4), start: "08:02", finish: "16:15", breakMinutes: 30, jobId: lowriFriday.jobId, activity: "job" },
          reason: "Forgot to press Finish work. I left site at 16:15 and remembered at home.",
          status: "pending", createdAt: at(addDays(lastWeek, 4), "21:02"), decidedAt: null, decidedBy: null, decisionNote: "",
        },
      ]
    : [];

  const notifications: WeStore["notifications"] = [
    {
      id: next("N"), userId: "eng-alex", at: nowIso, title: "Leave approved",
      body: "Your leave for today and tomorrow was approved.", href: "/field/leave", read: false,
    },
  ];

  return {
    version: 2,
    seededAt: nowIso,
    settings,
    employees,
    customers: structuredClone(CUSTOMERS),
    sites: structuredClone(SITES),
    jobs,
    requirements,
    assignments,
    sessions,
    events: [],
    corrections,
    leave,
    unavailability,
    timesheets,
    exports: [],
    audit: [],
    notifications,
    counters,
  };
}
