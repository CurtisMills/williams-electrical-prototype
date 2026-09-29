import { addDays, countWorkingDays, todayKey } from "./dates";
import type { AssignedJob, Engineer, HolidayRequest } from "./types";

// SAMPLE DATA: example people and jobs for the prototype. None of this is real.

export const SAMPLE_ENGINEERS: Engineer[] = [
  { id: "eng-jordan", name: "Jordan Price", initials: "JP" },
  { id: "eng-alex", name: "Alex Evans", initials: "AE" },
  { id: "eng-pat", name: "Pat Green", initials: "PG" },
  { id: "eng-sam", name: "Sam Morgan", initials: "SM" },
  { id: "eng-rhys", name: "Rhys Davies", initials: "RD" },
  { id: "eng-cerys", name: "Cerys Thomas", initials: "CT" },
  { id: "eng-owen", name: "Owen Hughes", initials: "OH" },
  { id: "eng-lowri", name: "Lowri Jenkins", initials: "LJ" },
];

type JobTemplate = Omit<AssignedJob, "id" | "date" | "engineerId" | "source">;

const job = (
  reference: string,
  name: string,
  location: string,
  jobType: string,
  plannedStart: string,
  plannedEnd: string,
): JobTemplate => ({ reference, name, location, jobType, plannedStart, plannedEnd });

// Alex and Pat have no jobs: they're on leave today in the seeded holiday data.
const DAY_PLANS: Record<string, JobTemplate[]> = {
  "eng-jordan": [
    job("WE-1048", "Commercial fit-out", "Unit 4, Cross Hands Business Park, SA14", "Installation", "08:00", "12:00"),
    job("WE-1052", "Electrical inspection (EICR)", "22 Station Road, Llanelli, SA15", "Inspection", "13:00", "15:30"),
    job("WE-1057", "EV charger survey", "Maes y Coed, Carmarthen, SA31", "Survey", "16:00", "17:00"),
  ],
  "eng-sam": [
    job("WE-1049", "Consumer unit upgrade", "8 Heol y Parc, Ammanford, SA18", "Installation", "08:30", "14:00"),
    job("WE-1060", "Fault finding: tripping RCD", "3 Bryn Road, Swansea, SA2", "Repair", "14:30", "16:30"),
  ],
  "eng-rhys": [
    job("WE-1050", "Emergency lighting test", "Parc Trostre Retail, Llanelli, SA14", "Maintenance", "07:30", "10:30"),
    job("WE-1053", "Landlord EICR", "Flat 2, 41 Queen Street, Carmarthen, SA31", "Inspection", "11:00", "13:00"),
    job("WE-1061", "Outdoor socket install", "Ty Gwyn, Kidwelly, SA17", "Installation", "14:00", "15:30"),
  ],
  "eng-cerys": [
    job("WE-1051", "Kitchen rewire (day 2)", "17 Llys Newydd, Burry Port, SA16", "Rewire", "08:00", "16:30"),
  ],
  "eng-owen": [
    job("WE-1054", "PAT testing", "Coleg Sir Gâr, Pibwrlwyd, SA31", "Testing", "08:00", "12:00"),
    job("WE-1058", "EV charger install", "Pen y Bryn, Tumble, SA14", "Installation", "13:00", "17:00"),
  ],
  "eng-lowri": [
    job("WE-1055", "Solar PV inspection", "Fferm Glanrhyd, Llandeilo, SA19", "Inspection", "09:00", "11:30"),
    job("WE-1059", "Lighting upgrade", "The Old Chapel, Llandybie, SA18", "Installation", "12:30", "16:30"),
  ],
};

/**
 * Stand-in for the JobLogic feed. A future integration only needs to return
 * `AssignedJob[]` for an engineer and date; the screens and rules stay the same.
 */
export async function getAssignedJobs(engineerId: string, date: string): Promise<AssignedJob[]> {
  return (DAY_PLANS[engineerId] ?? []).map((t, i) => ({
    ...t,
    id: `sample-${engineerId}-${date}-${i + 1}`,
    date,
    engineerId,
    source: "sample",
  }));
}

export function seedHolidayRequests(now: Date = new Date()): HolidayRequest[] {
  const today = todayKey(now);
  const createdAt = now.toISOString();
  const make = (
    id: string,
    engineerId: string,
    first: string,
    last: string,
    status: HolidayRequest["status"],
    note = "",
  ): HolidayRequest => ({
    id,
    engineerId,
    firstDay: first,
    lastDay: last,
    workingDays: countWorkingDays(first, last),
    note,
    status,
    createdAt,
    decidedAt: status === "pending" ? null : createdAt,
    sample: true,
  });

  return [
    make("sample-1", "eng-alex", today, addDays(today, 1), "approved"),
    make("sample-2", "eng-pat", today, today, "approved"),
    make("sample-3", "eng-sam", addDays(today, 3), addDays(today, 7), "pending", "Family wedding"),
    make("sample-4", "eng-cerys", addDays(today, 6), addDays(today, 6), "pending"),
    make("sample-5", "eng-jordan", addDays(today, 24), addDays(today, 24), "approved"),
  ];
}
