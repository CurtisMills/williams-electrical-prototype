/**
 * Checks the presentation rules behind the redesigned time and holiday screens.
 * Usage: npm run ui:check
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.FIELD_DATA_DIR = mkdtempSync(path.join(tmpdir(), "we-ui-"));

const ok = (cond: unknown, msg: string) => {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    process.exitCode = 1;
  } else console.log(`  ✓ ${msg}`);
};

async function main() {
  const { pickFocusJob, summariseAvailability, formatBalance, holidayWording } = await import("../src/lib/we/present");

  console.log("Next job on Today");
  const planned = [
    { jobId: "a", recorded: ["s1"] },
    { jobId: "b", recorded: [] },
    { jobId: "c", recorded: [] },
  ];
  ok(pickFocusJob(planned, null)?.jobId === "b", "shows the first planned job with nothing recorded yet");
  ok(pickFocusJob(planned, "c")?.jobId === "c", "shows the job being recorded when one is active");
  ok(pickFocusJob(planned, "elsewhere") === null, "shows no planned card when recording an unplanned job");
  ok(pickFocusJob([{ jobId: "a", recorded: ["s1"] }], null) === null, "shows no next job once every planned job has time recorded");
  ok(pickFocusJob([], null) === null, "handles a day with no jobs");

  console.log("Crew availability on holiday requests");
  const day = (date: string, available: number, total: number) => ({ date, label: date, available, total });
  const same = summariseAvailability([day("d1", 4, 5), day("d2", 4, 5)]);
  ok(same.status === "ok" && same.sameAcrossDays && same.weakest?.available === 4, "4 of 5 on both days is fine and reported once");
  const mixed = summariseAvailability([day("d1", 4, 5), day("d2", 2, 5), day("d3", 3, 5)]);
  ok(mixed.status === "low" && mixed.weakest?.date === "d2" && !mixed.sameAcrossDays, "leads with the strongest constraint (the lowest day)");
  ok(mixed.days.find((d) => d.date === "d2")?.low === true && mixed.days.find((d) => d.date === "d1")?.low === false, "marks each low day for inspection");
  ok(summariseAvailability([day("d1", 3, 5)]).status === "low", "40% or more off counts as low cover, matching the old review highlight");
  ok(summariseAvailability([day("d1", 0, 0)]).status === "unknown", "a crew size of zero can't be calculated");
  ok(summariseAvailability([day("d1", Number.NaN, 5)]).status === "unknown", "a missing value can't be calculated");
  ok(summariseAvailability([]).status === "unknown", "no days means no summary");
  ok(summariseAvailability([day("d1", -1, 5)]).weakest?.available === 0, "never shows a negative number available");

  console.log("Holiday balance wording");
  ok(formatBalance(12) === "12" && formatBalance(4.5) === "4.5", "shows whole and half days");
  ok(formatBalance(null) === "Not available" && formatBalance(undefined) === "Not available" && formatBalance(Number.NaN) === "Not available", "says Not available instead of guessing");
  ok(holidayWording("Approved leave (morning)") === "Approved holiday (morning)", "domain leave labels read as holiday");
  ok(holidayWording("Leave") === "Holiday" && holidayWording("College") === "College", "other absence labels are untouched");

  console.log("Availability from a real pending request");
  const { readStore, resetStore } = await import("../src/lib/we/store");
  const { leaveImpact } = await import("../src/lib/we/planning");
  await resetStore();
  const store = await readStore();
  const pending = store.leave.find((l) => l.status === "pending");
  ok(!!pending, "the demo data has a pending request to review");
  if (pending) {
    const impact = leaveImpact(store, pending);
    const days = impact.sameRoleOffByDate.map((d) => ({ date: d.date, label: d.date, available: d.total - d.off, total: d.total }));
    const s = summariseAvailability(days);
    ok(days.length === pending.days.length, "one availability row per requested day");
    ok(s.status !== "unknown", "availability can be calculated for the seeded crew");
    ok(days.every((d) => d.available < d.total), "the person asking is counted as off on each day");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
