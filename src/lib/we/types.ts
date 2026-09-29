// Shared records for the prototype. Assignments are the plan, work sessions are what the
// employee reported, and timesheets summarise sessions. An assignment never creates hours.

export type StaffRole = "electrician" | "apprentice";

export interface WorkingPattern {
  /** ISO weekdays worked, 1 = Monday. */
  days: number[];
  /** Planning window, HH:mm London time. */
  start: string;
  end: string;
}

export interface Employee {
  id: string;
  ref: string;
  name: string;
  initials: string;
  role: StaffRole;
  pattern: WorkingPattern;
  allowanceDays: number;
  active: boolean;
}

export interface Customer {
  id: string;
  ref: string;
  name: string;
  contact: string;
}

export interface Site {
  id: string;
  ref: string;
  customerId: string;
  name: string;
  address: string;
  contactName: string;
  contactPhone: string;
  access: string;
}

export type JobStatus = "tentative" | "confirmed" | "completed" | "cancelled" | "archived";

export interface Job {
  id: string;
  ref: string;
  customerId: string;
  siteId: string;
  title: string;
  type: string;
  status: JobStatus;
  startDate: string;
  endDate: string;
  plannedHours: number;
}

/** Daily staffing need for a job: how many of a role, and when. */
export interface Requirement {
  id: string;
  jobId: string;
  date: string;
  role: StaffRole;
  count: number;
  start: string;
  end: string;
}

export type AssignmentStatus = "confirmed" | "needs_replacement";

export interface Assignment {
  id: string;
  jobId: string;
  requirementId: string;
  employeeId: string;
  date: string;
  start: string;
  end: string;
  status: AssignmentStatus;
  /** Why it needs replacing, e.g. the leave that made the person unavailable. */
  statusReason?: string;
  createdAt: string;
  createdBy: string;
}

export type Activity = "job" | "travel" | "other" | "unassigned";
export type EntrySource = "phone" | "phone_offline" | "office" | "seed";

export interface BreakInterval {
  start: string;
  end: string | null;
}

export interface WorkSession {
  id: string;
  employeeId: string;
  jobId: string | null;
  activity: Activity;
  /** For unassigned work: what the employee said about the site and job. */
  note: string;
  startedAt: string;
  finishedAt: string | null;
  breaks: BreakInterval[];
  source: EntrySource;
  /** When the server received the start event (differs from startedAt for offline events). */
  receivedAt: string;
  lastEventAt: string;
  edited: boolean;
  voided: boolean;
  version: number;
  /** Values as first recorded, kept when the office or a correction changes them. */
  original: SessionValues | null;
}

export interface SessionValues {
  jobId: string | null;
  activity: Activity;
  startedAt: string;
  finishedAt: string | null;
  breakMinutes: number;
}

export type WorkEventType = "start" | "break" | "resume" | "finish" | "switch";

export interface WorkEvent {
  id: string;
  clientEventId: string;
  employeeId: string;
  type: WorkEventType;
  occurredAt: string;
  receivedAt: string;
  sessionId: string | null;
  offline: boolean;
  outcome: "applied" | "conflict";
  detail: string;
}

export type CorrectionStatus = "pending" | "approved" | "rejected";

export interface CorrectionRequest {
  id: string;
  employeeId: string;
  /** Null when asking the office to add a forgotten entry. */
  sessionId: string | null;
  proposed: {
    date: string;
    start: string;
    finish: string;
    breakMinutes: number;
    jobId: string | null;
    activity: Activity;
  };
  reason: string;
  status: CorrectionStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string;
  /** A forgotten finish from an earlier day is applied straight away so the employee can carry on; the office still confirms it. */
  provisional?: boolean;
}

export type LeavePortion = "full" | "am" | "pm";
export type LeaveStatus = "pending" | "approved" | "declined" | "withdrawn" | "cancelled";

export interface LeaveDay {
  date: string;
  portion: LeavePortion;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  days: LeaveDay[];
  firstDay: string;
  lastDay: string;
  totalDays: number;
  note: string;
  status: LeaveStatus;
  cancellation: { requestedAt: string; reason: string } | null;
  createdAt: string;
  createdBy: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionReason: string;
  history: { at: string; by: string; action: string; reason: string }[];
  version: number;
}

export interface Unavailability {
  id: string;
  employeeId: string;
  date: string;
  start: string;
  end: string;
  reason: string;
}

export type TimesheetStatus = "draft" | "submitted" | "changes_requested" | "approved";

export interface Timesheet {
  id: string;
  employeeId: string;
  weekStart: string;
  status: TimesheetStatus;
  revision: number;
  /** Net minutes fixed at approval. */
  approvedMinutes: number | null;
  approvedAt: string | null;
  approvedBy: string | null;
  submittedAt: string | null;
  returnReason: string;
  reopenedReason: string;
  history: { at: string; by: string; action: string; revision: number; reason: string }[];
  version: number;
}

export interface ExportRecord {
  id: string;
  kind: "employee_csv" | "customer_csv" | "customer_summary";
  mode: "final" | "draft";
  from: string;
  to: string;
  filters: Record<string, string>;
  generatedAt: string;
  generatedBy: string;
  /** employeeId:weekStart:revision for every timesheet included. */
  timesheetRevisions: string[];
  totalMinutes: number;
  supersededAt: string | null;
  supersededReason: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  entity: "session" | "leave" | "assignment" | "requirement" | "job" | "timesheet" | "correction" | "settings" | "employee";
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  reason: string;
}

export interface Notification {
  id: string;
  userId: string;
  at: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
}

export interface Settings {
  longSessionHours: number;
  noStartGraceMinutes: number;
  bankHolidays: { date: string; name: string }[];
  leaveYearStartMonth: number;
}

export interface WeStore {
  version: 2;
  seededAt: string;
  settings: Settings;
  employees: Employee[];
  customers: Customer[];
  sites: Site[];
  jobs: Job[];
  requirements: Requirement[];
  assignments: Assignment[];
  sessions: WorkSession[];
  events: WorkEvent[];
  corrections: CorrectionRequest[];
  leave: LeaveRequest[];
  unavailability: Unavailability[];
  timesheets: Timesheet[];
  exports: ExportRecord[];
  audit: AuditEntry[];
  notifications: Notification[];
  counters: Record<string, number>;
}
