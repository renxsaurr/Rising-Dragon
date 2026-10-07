import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import PaginatedTableRows from "@/components/PaginatedTableRows";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getCurrentUser } from "@/utils/getCurrentUser";
import { formatTime, dateInTimeZone } from "@/utils/dates";
import { getCoachBranchIdsForDate } from "@/utils/coach-access";

type AttendanceRow = {
  schedule_id: number;
  date: string;
  status: "Present" | "Absent";
};

type ScheduleRow = {
  id: number;
  date: string;
  time_start: string;
  time_end: string;
  branch_id: number;
  coach_id: number;
  branch: { name: string } | null;
  coach: {
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
  } | null;
};

function fullName(person: {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
}) {
  return [person.first_name, person.middle_name, person.last_name]
    .filter(Boolean)
    .join(" ");
}

function readableDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function StudentAttendanceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string | string[] }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (!["head_coach", "assistant_coach"].includes(currentUser.role))
    redirect("/students");

  const params = await searchParams;
  const rawId = Array.isArray(params.studentId)
    ? params.studentId[0]
    : params.studentId;
  const studentId = Number(rawId);
  if (!Number.isSafeInteger(studentId) || studentId <= 0) notFound();

  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  // Attendance RLS limits assistants to their own class sessions. Do this
  // query before using the service client to load the student's name.
  const { data: visibleRows, error: attendanceError } = await supabase
    .from("attendance")
    .select("schedule_id, date, status")
    .eq("student_id", studentId)
    .order("date", { ascending: false });

  if (attendanceError) {
    return (
      <DashboardShell title="Attendance history" currentUser={currentUser}>
        <p role="alert" className="text-sm text-red-700">
          Could not load attendance history: {attendanceError.message}
        </p>
      </DashboardShell>
    );
  }

  const attendanceRows = (visibleRows ?? []) as AttendanceRow[];
  // Do not reveal a student's identity to an assistant unless at least one
  // history row belongs to a class they coached, or the student is on a branch
  // roster assigned to them today (so an empty history can be shown clearly).
  if (currentUser.role === "assistant_coach" && attendanceRows.length === 0) {
    const admin = createAdminClient();
    const { data: rosterStudent } = await admin
      .from("student")
      .select("branch_id, is_active")
      .eq("id", studentId)
      .maybeSingle();
    const assignedBranchIds = await getCoachBranchIdsForDate(
      currentUser.id,
      dateInTimeZone(),
    );
    if (!rosterStudent || !rosterStudent.is_active || !assignedBranchIds.includes(Number(rosterStudent.branch_id)))
      notFound();
  }

  const admin = createAdminClient();
  const { data: student, error: studentError } = await admin
    .from("student")
    .select("id, first_name, middle_name, last_name, belt_level, branch:branch!student_branch_id_fkey(name)")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) {
    return (
      <DashboardShell title="Attendance history" currentUser={currentUser}>
        <p role="alert" className="text-sm text-red-700">
          Could not load the student record: {studentError.message}
        </p>
      </DashboardShell>
    );
  }
  if (!student) notFound();

  const scheduleIds = [...new Set(attendanceRows.map((row) => Number(row.schedule_id)))];
  let schedules: ScheduleRow[] = [];
  if (scheduleIds.length) {
    let query = admin
      .from("class_schedule")
      .select("id, date, time_start, time_end, branch_id, coach_id, branch:branch!class_schedule_branch_id_fkey(name), coach:user!class_schedule_coach_id_fkey(first_name, middle_name, last_name)")
      .in("id", scheduleIds);
    if (currentUser.role === "assistant_coach")
      query = query.eq("coach_id", currentUser.id);
    const { data, error } = await query;
    if (error) {
      return (
        <DashboardShell title="Attendance history" currentUser={currentUser}>
          <p role="alert" className="text-sm text-red-700">
            Could not load class details: {error.message}
          </p>
        </DashboardShell>
      );
    }
    schedules = (data ?? []) as unknown as ScheduleRow[];
  }

  const schedulesById = new Map(schedules.map((schedule) => [Number(schedule.id), schedule]));
  const history = attendanceRows
    .map((row) => ({ row, schedule: schedulesById.get(Number(row.schedule_id)) }))
    .filter((entry): entry is { row: AttendanceRow; schedule: ScheduleRow } => Boolean(entry.schedule))
    .sort((a, b) => b.schedule.date.localeCompare(a.schedule.date) || b.schedule.time_start.localeCompare(a.schedule.time_start));
  const presentCount = history.filter(({ row }) => row.status === "Present").length;
  const absentCount = history.filter(({ row }) => row.status === "Absent").length;
  const studentName = fullName(student);
  const branchName = Array.isArray(student.branch)
    ? student.branch[0]?.name
    : student.branch?.name;

  return (
    <DashboardShell title="Attendance history" currentUser={currentUser}>
      <div className="mb-5">
        <Link href="/students" className="text-sm font-medium text-gray-600 hover:text-black">
          ← Back to students
        </Link>
      </div>
      <section className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Student attendance</p>
        <h2 className="mt-1 text-xl font-semibold text-gray-950">{studentName}</h2>
        <p className="mt-1 text-sm text-gray-600">
          {student.belt_level.replaceAll("_", " ")}{branchName ? ` · ${branchName}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-lg border border-gray-200 px-3 py-2 font-medium text-gray-950">{history.length} recorded class{history.length === 1 ? "" : "es"}</span>
          <span className="rounded-lg border border-gray-200 px-3 py-2 font-medium text-gray-950">{presentCount} present</span>
          <span className="rounded-lg border border-red-200 px-3 py-2 font-medium text-red-700">{absentCount} absent</span>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h3 className="font-semibold text-gray-950">Class history</h3>
          <p className="mt-1 text-sm text-gray-600">Only saved Present and Absent records appear here. Unmarked classes are not counted as absent.</p>
        </div>
        {history.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-600">No attendance has been recorded for this student yet.</p>
        ) : (
          <div className="max-h-[min(65vh,640px)] overflow-y-auto">
            <table className="system-data-table w-full min-w-[620px] border-collapse text-left">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Branch</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Class time</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Coach</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Result</th>
                </tr>
              </thead>
              <PaginatedTableRows itemLabel="attendance records" colSpan={5}>
                {history.map(({ row, schedule }) => (
                  <tr key={row.schedule_id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 text-sm text-gray-900">{readableDate(schedule.date)}</td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-950">{schedule.branch?.name ?? "—"}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{formatTime(schedule.time_start)}–{formatTime(schedule.time_end)}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{schedule.coach ? fullName(schedule.coach) : "—"}</td>
                    <td className="px-5 py-4 text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === "Present" ? "bg-gray-100 text-gray-950" : "bg-red-50 text-red-700"}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </PaginatedTableRows>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
