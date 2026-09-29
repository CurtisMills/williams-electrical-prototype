import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { dateKeyOf, formatClock, formatDayKey, ukHour } from "@/lib/field/dates";
import { breakMinutes, netMinutes } from "@/lib/we/calc";
import { readStore } from "@/lib/we/store";
import { lookup, employeeDay, selectableJobs } from "@/lib/we/views";
import { activityLabel } from "@/lib/we/work";
import type { WeStore, WorkSession } from "@/lib/we/types";
import { TodayScreen, type TodayData } from "./TodayScreen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Today" };

function labelFor(store: WeStore, s: Pick<WorkSession, "jobId" | "activity" | "note">) {
  const job = lookup(store).job(s.jobId);
  if (job) return { title: `${job.ref} · ${job.title}`, site: lookup(store).site(job.siteId)?.name ?? "" };
  return { title: activityLabel[s.activity], site: s.note };
}

export default async function EngineerTodayPage() {
  const { user } = await requireRole("engineer");
  const store = await readStore();
  const day = employeeDay(store, user.id);
  const hour = ukHour();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const open = day.open;
  const openBreak = open?.breaks.find((b) => !b.end) ?? null;
  const data: TodayData = {
    firstName: user.name.split(" ")[0],
    greeting,
    dateLabel: formatDayKey(day.today, "full"),
    today: day.today,
    open: open
      ? {
          id: open.id,
          jobId: open.jobId,
          activity: open.activity,
          ...labelFor(store, open),
          startedAt: open.startedAt,
          breakStartedAt: openBreak?.start ?? null,
          completedBreakMinutes: open.breaks.filter((b) => b.end).reduce((n, b) => n + (Date.parse(b.end!) - Date.parse(b.start)) / 60000, 0),
          isOld: day.openIsOld,
          startDate: dateKeyOf(open.startedAt),
          startDateLabel: formatDayKey(dateKeyOf(open.startedAt), "long"),
          startTime: formatClock(open.startedAt),
          note: open.note,
        }
      : null,
    planned: day.planned.map((p) => ({
      key: p.assignment.id,
      jobId: p.job.id,
      ref: p.job.ref,
      title: p.job.title,
      customer: p.customerName,
      site: p.site.name,
      address: p.site.address,
      access: p.site.access,
      start: p.assignment.start,
      end: p.assignment.end,
      recorded: p.sessions.map((s) => `${formatClock(s.startedAt)}–${s.finishedAt ? formatClock(s.finishedAt) : "now"}`),
    })),
    absencesToday: day.absencesToday.map((a) => a.label),
    sessions: day.todaysSessions.map((s) => ({
      id: s.id,
      ...labelFor(store, s),
      start: formatClock(s.startedAt),
      finish: s.finishedAt ? formatClock(s.finishedAt) : null,
      breakMinutes: breakMinutes(s),
      netMinutes: netMinutes(s),
    })),
    upcoming: day.upcoming.map((d) => ({
      date: d.date,
      label: formatDayKey(d.date, "weekday"),
      short: formatDayKey(d.date, "dm"),
      working: d.working,
      holiday: d.holiday,
      absences: d.absences.map((a) => a.label),
      items: d.items.map((p) => ({
        key: p.assignment.id,
        ref: p.job.ref,
        title: p.job.title,
        customer: p.customerName,
        site: p.site.name,
        address: p.site.address,
        access: p.site.access,
        start: p.assignment.start,
        end: p.assignment.end,
      })),
    })),
    jobs: selectableJobs(store),
    pendingCorrections: day.pendingCorrections.length,
  };

  return <TodayScreen data={data} />;
}
