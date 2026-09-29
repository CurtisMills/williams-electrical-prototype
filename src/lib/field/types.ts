// Field work data model. Assigned jobs are shaped so a JobLogic sync can supply them later;
// time logs and holiday requests are owned by this app.

export interface Engineer {
  id: string;
  name: string;
  initials: string;
}

export interface AssignedJob {
  id: string;
  /** Office-facing job number, e.g. the JobLogic job reference. */
  reference: string;
  name: string;
  location: string;
  jobType: string;
  engineerId: string;
  /** YYYY-MM-DD in UK time. */
  date: string;
  /** HH:mm, UK time. */
  plannedStart: string;
  plannedEnd: string;
  source: "sample" | "joblogic";
}

export interface TimeLog {
  id: string;
  jobId: string;
  /** Snapshot so an open log can be named after the job leaves today's list. */
  jobReference: string;
  jobName: string;
  engineerId: string;
  startedAt: string;
  finishedAt: string | null;
}

export type HolidayStatus = "pending" | "approved" | "declined";

export interface HolidayRequest {
  id: string;
  engineerId: string;
  /** YYYY-MM-DD, inclusive. */
  firstDay: string;
  lastDay: string;
  workingDays: number;
  note: string;
  status: HolidayStatus;
  createdAt: string;
  decidedAt: string | null;
  sample?: boolean;
}

export interface FieldStore {
  version: 1;
  timeLogs: TimeLog[];
  holidayRequests: HolidayRequest[];
}
