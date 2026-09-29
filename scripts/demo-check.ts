/**
 * Runs the eight-step demo scenario against the domain layer using a throwaway data folder.
 * Usage: npm run demo:check
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.FIELD_DATA_DIR = mkdtempSync(path.join(tmpdir(), "we-demo-"));

const ok = (cond: unknown, msg: string) => {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    process.exitCode = 1;
  } else console.log(`  ✓ ${msg}`);
};

async function main() {
  const { readStore, resetStore } = await import("../src/lib/we/store");
  const { recordWork, officeCorrectSession } = await import("../src/lib/we/work");
  const { createLeave, decideLeave } = await import("../src/lib/we/leave");
  const { leaveImpact, assign } = await import("../src/lib/we/planning");
  const { submitTimesheet, decideTimesheet, weekSummary, sheetFor } = await import("../src/lib/we/timesheets");
  const { employeeDay, teamToday, collectHours } = await import("../src/lib/we/views");
  const { employeeCsv, customerCsv, parseHoursFilter } = await import("../src/lib/we/exports");
  const { requirementCoverage } = await import("../src/lib/we/calc");
  const { addDays, weekStartOf, todayKey, formatDayKey, dateKeyOf } = await import("../src/lib/field/dates");

  await resetStore();
  const jordan = { id: "eng-jordan", name: "Jordan Hughes", role: "engineer" as const };
  const cerys = { id: "eng-cerys", name: "Cerys", role: "engineer" as const };
  const office = { id: "office-megan", name: "Megan Lloyd", role: "office" as const };
  const today = todayKey();
  const w0 = weekStartOf(today);
  let n = 0;
  const eid = () => `demo-${++n}`;

  console.log(`Today is ${formatDayKey(today, "full")}`);

  console.log("1. Start work and the office sees it");
  let store = await readStore();
  const day = employeeDay(store, jordan.id);
  const first = day.planned[0];
  const jobA = first?.job.id ?? "job-2041";
  const started = await recordWork(jordan, { action: "start", clientEventId: eid(), jobId: jobA });
  ok(started.outcome === "applied", `Jordan started ${jobA}: ${started.message}`);
  const dup = await recordWork(jordan, { action: "start", clientEventId: eid(), jobId: jobA });
  ok(dup.outcome === "duplicate", "second Start tap does not create a second session");
  store = await readStore();
  ok(teamToday(store).find((m) => m.employee.id === jordan.id)?.status === "working", "office Today shows Jordan as Working");

  console.log("2. Change job then finish; both sessions appear");
  const switched = await recordWork(jordan, { action: "switch", clientEventId: eid(), jobId: "job-2044" });
  ok(switched.outcome === "applied", switched.message);
  const finished = await recordWork(jordan, { action: "finish", clientEventId: eid() });
  ok(finished.outcome === "applied", finished.message);
  store = await readStore();
  const todays = store.sessions.filter((s) => s.employeeId === jordan.id && dateKeyOf(s.startedAt) === today && !s.voided);
  ok(todays.length === 2 && todays.every((s) => s.finishedAt), `two finished sessions today (${todays.map((s) => s.jobId).join(", ")})`);

  console.log("3. Request future leave; the office sees the staffing impact");
  const leaveDay = addDays(w0, 15); // Tuesday in week +2
  const req = await createLeave(jordan, { firstDay: leaveDay, lastDay: leaveDay, portions: {}, note: "Demo" });
  ok(req.status === "pending", `request ${req.id} for ${formatDayKey(leaveDay)} is pending`);
  store = await readStore();
  const impact = leaveImpact(store, store.leave.find((l) => l.id === req.id)!);
  ok(impact.affected.length > 0, `${impact.affected.length} assignment(s) affected: ${impact.affected.map((a) => `${a.job.ref} ${a.assignment.start}-${a.assignment.end}`).join(", ")}`);
  ok(impact.affected.some((a) => a.unfilledAfter > 0), "office sees a slot would become unfilled");

  console.log("4. Approve despite the warning; the slot shows as unfilled");
  await decideLeave(office, req.id, { action: "approve", reason: "", version: req.version });
  store = await readStore();
  const affectedReqIds = impact.affected.map((a) => a.requirement.id);
  const gaps = affectedReqIds.map((id) => requirementCoverage(store.requirements.find((r) => r.id === id)!, store));
  ok(gaps.every((c) => c.unfilled > 0 && c.needsReplacement.length > 0), "affected electrician slots flagged as needing replacement");

  console.log("5. Assign a replacement; the shortage clears and the replacement sees it");
  for (const id of affectedReqIds) await assign(office, { requirementId: id, employeeId: cerys.id });
  store = await readStore();
  const after = affectedReqIds.map((id) => requirementCoverage(store.requirements.find((r) => r.id === id)!, store));
  ok(after.every((c) => c.unfilled === 0), "slots are covered");
  ok(store.assignments.some((a) => a.employeeId === cerys.id && a.date === leaveDay), "Cerys has the assignment on her schedule");
  ok(store.notifications.some((x) => x.userId === cerys.id && x.title === "New assignment"), "Cerys was notified");

  console.log("6. Correct the seeded missing finish; audit records it and totals update");
  const open = store.sessions.find((s) => s.employeeId === "eng-rhys" && !s.finishedAt);
  ok(open, `Rhys has an open session from ${open && formatDayKey(dateKeyOf(open.startedAt))}`);
  if (open) {
    const date = dateKeyOf(open.startedAt);
    const before = collectHours(store, { from: date, to: date, employeeId: "eng-rhys", approval: "all" }).totalMinutes;
    await officeCorrectSession(office, open.id, { date, start: "07:45", finish: "16:10", breakMinutes: 30, reason: "Rhys phoned: forgot to tap Finish", version: open.version });
    store = await readStore();
    const afterMins = collectHours(store, { from: date, to: date, employeeId: "eng-rhys", approval: "all" }).totalMinutes;
    ok(store.audit.some((a) => a.entityId === open.id && a.reason.includes("forgot")), "audit entry with reason recorded");
    ok(afterMins > before, `Rhys's hours for that day went from ${before} to ${afterMins} minutes`);
  }

  console.log("7. Employee submits the week and the admin approves it");
  await submitTimesheet(jordan, w0);
  store = await readStore();
  const sheet = sheetFor(store, jordan.id, w0);
  ok(sheet.status === "submitted", "Jordan's week is submitted");
  await decideTimesheet(office, { employeeId: jordan.id, weekStart: w0, decision: "approve", version: sheet.version });
  store = await readStore();
  ok(sheetFor(store, jordan.id, w0).status === "approved", `approved at ${weekSummary(store, jordan.id, w0).totalMinutes} minutes`);

  console.log("8. Download the customer and employee CSVs");
  const f = parseHoursFilter({ from: w0, to: addDays(w0, 6) });
  const emp = await employeeCsv(office, f);
  const cus = await customerCsv(office, f);
  ok(emp.csv.includes("Jordan") && emp.csv.includes("Europe/London"), `employee CSV ${emp.filename} includes Jordan's approved hours`);
  ok(cus.csv.includes("WE-2041") && !cus.csv.includes("Jordan"), `customer CSV ${cus.filename} lists jobs without employee names`);

  console.log("Bonus: a correction to an approved week reopens it and supersedes the export");
  store = await readStore();
  const s = store.sessions.find((x) => x.employeeId === jordan.id && dateKeyOf(x.startedAt) === today && x.finishedAt)!;
  await officeCorrectSession(office, s.id, {
    date: today,
    start: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London", hourCycle: "h23" }).format(new Date(Date.parse(s.startedAt) - 15 * 60000)),
    finish: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London", hourCycle: "h23" }).format(new Date(s.finishedAt!)),
    breakMinutes: 0,
    reason: "Started 15 minutes earlier",
    version: s.version,
  });
  store = await readStore();
  const re = sheetFor(store, jordan.id, w0);
  ok(re.status === "submitted" && re.revision === 2, "week reopened as revision 2");
  ok(store.exports.filter((x) => x.supersededAt).length >= 1, "earlier export marked superseded");

  console.log(process.exitCode ? "\nSome checks failed." : "\nAll demo steps passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
