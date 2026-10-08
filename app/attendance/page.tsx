import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import AttendanceRoster from "@/components/AttendanceRoster";
import AttendanceDatePicker from "@/components/AttendanceDatePicker";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getCurrentUser } from "@/utils/getCurrentUser";
import { dateInTimeZone, formatTime, timeInTimeZone } from "@/utils/dates";

type ScheduleRow = {
  id: number;
  date: string;
  time_start: string;
  time_end: string;
  branch_id: number;
  coach_id: number;
  status: string;
  branch: { name: string } | null;
  coach: {
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    role: string;
  } | null;
};

function fullName(
  person: {
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
  } | null,
) {
  return [person?.first_name, person?.middle_name, person?.last_name]
    .filter(Boolean)
    .join(" ");
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; scheduleId?: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { date: requestedDate, scheduleId: requestedScheduleId } =
    await searchParams;
  const today = dateInTimeZone();
  const currentTime = timeInTimeZone();
  const date =
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : today;
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  const admin = createAdminClient();
  const isAssistant = currentUser.role === "assistant_coach";

  // Only load sessions for the selected date; the date picker replaces the week strip.
  let scheduleQuery = supabase
    .from("class_schedule")
    .select(
      "id, date, time_start, time_end, branch_id, coach_id, status, branch:branch!class_schedule_branch_id_fkey(name), coach:user!class_schedule_coach_id_fkey(first_name, middle_name, last_name, role)",
    )
    .eq("date", date)
    .neq("status", "Cancelled")
    .neq("status", "Draft")
    .order("time_start");
  if (isAssistant) scheduleQuery = scheduleQuery.eq("coach_id", currentUser.id);
  const { data: weekData, error: scheduleError } = await scheduleQuery;

  if (scheduleError) {
    return (
      <DashboardShell title="Attendance" currentUser={currentUser}>
        <p role="alert" className="text-sm text-red-600">
          Could not load class sessions: {scheduleError.message}
        </p>
      </DashboardShell>
    );
  }

  const schedules = (weekData ?? []) as unknown as ScheduleRow[];
  const selectedSchedule =
    schedules.find((schedule) => String(schedule.id) === requestedScheduleId) ??
    schedules[0] ??
    null;

  // progress per session: marked records vs students enrolled at that branch
  const branchIds = [
    ...new Set(schedules.map((schedule) => Number(schedule.branch_id))),
  ];
  const [branchStudentsResult, dayAttendanceResult] = schedules.length
    ? await Promise.all([
        admin
          .from("student")
          .select("id, branch_id, enrollment_date, billing_plan")
          .eq("is_active", true)
          .lte("enrollment_date", date)
          .in("branch_id", branchIds),
        supabase
          .from("attendance")
          .select("schedule_id, student_id, status")
          .in(
            "schedule_id",
            schedules.map((schedule) => schedule.id),
          ),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  const progressError =
    branchStudentsResult.error?.message ?? dayAttendanceResult.error?.message ?? "";
  const activeStudentIdsPerBranch = new Map<number, Set<number>>();
  for (const row of branchStudentsResult.data ?? [])
    if (row.billing_plan !== "Per session") activeStudentIdsPerBranch.set(Number(row.branch_id), new Set([
      ...(activeStudentIdsPerBranch.get(Number(row.branch_id)) ?? []),
      Number(row.id),
    ]));
  const markedStudentIdsPerSchedule = new Map<number, Set<number>>();
  for (const row of (dayAttendanceResult.data ?? []) as { schedule_id: number; student_id: number; status: string }[])
    markedStudentIdsPerSchedule.set(Number(row.schedule_id), new Set([
      ...(markedStudentIdsPerSchedule.get(Number(row.schedule_id)) ?? []),
      Number(row.student_id),
    ]));

  const presentPerSchedule = new Map<number, number>();
  const absentPerSchedule = new Map<number, number>();
  for (const row of (dayAttendanceResult.data ?? []) as {
    schedule_id: number;
    status: string;
  }[]) {
    const target =
      row.status === "Present" ? presentPerSchedule : absentPerSchedule;
    target.set(
      Number(row.schedule_id),
      (target.get(Number(row.schedule_id)) ?? 0) + 1,
    );
  }

  let students: {
    id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    belt_level: string;
    enrollment_date: string;
    billing_plan: "Monthly" | "Per session";
  }[] = [];
  let availableWalkIns: { id: number; name: string; belt: string }[] = [];
  let attendance: { student_id: number; status: "Present" | "Absent" }[] = [];
  let rosterError = "";

  if (selectedSchedule) {
    const [studentsResult, attendanceResult] = await Promise.all([
      admin
        .from("student")
        .select("id, first_name, middle_name, last_name, belt_level, enrollment_date, billing_plan")
        .eq("is_active", true)
        .eq("branch_id", selectedSchedule.branch_id)
        .lte("enrollment_date", selectedSchedule.date)
        .order("last_name")
        .order("first_name"),
      admin
        .from("attendance")
        .select("student_id, status")
        .eq("schedule_id", selectedSchedule.id),
    ]);
    if (studentsResult.error) rosterError = studentsResult.error.message;
    if (attendanceResult.error)
      rosterError = rosterError || attendanceResult.error.message;
    else attendance = (attendanceResult.data ?? []) as typeof attendance;
    if (!rosterError) {
      const activeStudents = (studentsResult.data ?? []) as typeof students;
      const markedIds = new Set(attendance.map((row) => Number(row.student_id)));
      const monthlyStudents = activeStudents.filter((student) => student.billing_plan !== "Per session");
      const activeWalkIns = activeStudents.filter((student) => student.billing_plan === "Per session");
      availableWalkIns = activeWalkIns
        .filter((student) => !markedIds.has(Number(student.id)))
        .map((student) => ({
          id: Number(student.id),
          name: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" "),
          belt: student.belt_level,
        }));
      const activeIds = new Set(activeStudents.map((student) => Number(student.id)));
      const historicalIds = [...markedIds].filter((id) => !activeIds.has(id));
      const historicalResult = historicalIds.length
        ? await admin.from("student")
            .select("id, first_name, middle_name, last_name, belt_level, enrollment_date, billing_plan")
            .in("id", historicalIds)
        : { data: [], error: null };
      if (historicalResult.error) rosterError = historicalResult.error.message;
      else {
        const checkedInWalkIns = activeWalkIns.filter((student) => markedIds.has(Number(student.id)));
        students = [...monthlyStudents, ...checkedInWalkIns, ...((historicalResult.data ?? []) as typeof students)]
          .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
      }
    }
  }

  const canMarkAttendance = Boolean(selectedSchedule && (
    selectedSchedule.date < today ||
    (selectedSchedule.date === today && selectedSchedule.time_start <= currentTime)
  ));
  const selectedDay = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <DashboardShell title="Attendance" currentUser={currentUser}>
      <section className="mb-5 flex flex-wrap items-center justify-between gap-3 bg-white py-1">
        <div>
          <h2 className="text-base font-semibold text-gray-950">{selectedDay}</h2>
        </div>
        <AttendanceDatePicker date={date} />
      </section>

      <div className="mb-3">
          <h3 className="text-sm font-semibold text-black">Classes on this date</h3>
      </div>

      {schedules.length === 0 ? (
        <div className="mb-5 rounded-xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
          <p className="text-sm font-medium text-gray-800">
            No classes on this day
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {isAssistant
              ? "Only your assigned classes appear here. Pick another day above."
              : "Pick another day above, or add a session in the calendar."}
          </p>
        </div>
      ) : (
        <>
        {progressError && (
          <p role="alert" className="mb-3 rounded-lg bg-gray-50 px-4 py-3 text-sm text-black">
            Class attendance totals could not be loaded. You can still open a class roster.
          </p>
        )}
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {schedules.map((schedule) => {
            const active = selectedSchedule?.id === schedule.id;
            const activeStudentIds = activeStudentIdsPerBranch.get(Number(schedule.branch_id)) ?? new Set<number>();
            const markedStudentIds = markedStudentIdsPerSchedule.get(Number(schedule.id)) ?? new Set<number>();
            const historicalMarkedCount = [...markedStudentIds].filter((studentId) => !activeStudentIds.has(studentId)).length;
            const total = activeStudentIds.size + historicalMarkedCount;
            const marked = markedStudentIds.size;
            const presentCount =
              presentPerSchedule.get(Number(schedule.id)) ?? 0;
            const absentCount = absentPerSchedule.get(Number(schedule.id)) ?? 0;
            const done = total > 0 && marked >= total;
            const upcoming = schedule.date > today ||
              (schedule.date === today && schedule.time_start > currentTime);
            const assignedName = fullName(schedule.coach) || "Coach";
            return (
              <Link
                key={schedule.id}
                href={`/attendance?date=${date}&scheduleId=${schedule.id}`}
                aria-current={active ? "true" : undefined}
                className={`min-w-0 rounded-xl border bg-white p-4 transition-all ${active ? "border-black shadow-sm ring-1 ring-black" : "border-gray-200 hover:border-gray-300"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-black">
                      {schedule.branch?.name ?? "Branch"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-black">
                      {formatTime(schedule.time_start)}–{formatTime(schedule.time_end)}
                    </p>
                    <p className="mt-1 break-words text-xs text-black">
                      Coach: <span className="font-medium text-black">{assignedName}</span>
                    </p>
                  </div>
                  {upcoming ? (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-black">
                      Upcoming
                    </span>
                  ) : done ? (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-black">
                      ✓ Done
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-black">
                      {marked ? "In progress" : "To do"}
                    </span>
                  )}
                </div>
                {!progressError && (
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                    <div className="min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-2">
                      <p className="text-lg font-bold leading-none text-black">{presentCount}</p>
                      <p className="mt-1 text-[11px] font-semibold text-black">Present</p>
                    </div>
                    <div className="min-w-0 rounded-lg border border-red-200 bg-white px-2.5 py-2">
                      <p className="text-lg font-bold leading-none text-red-600">{absentCount}</p>
                      <p className="mt-1 text-[11px] font-semibold text-black">Absent</p>
                    </div>
                    <div className="min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-2">
                      <p className="text-lg font-bold leading-none text-black">{marked}<span className="text-sm font-medium text-gray-500">/{total}</span></p>
                      <p className="mt-1 text-[11px] font-semibold text-black">Marked <span className="font-normal text-gray-600">· {Math.max(total - marked, 0)} left</span></p>
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
        </>
      )}

      {/* 3 — mark the roster */}
      {rosterError && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          Could not load the roster: {rosterError}
        </p>
      )}
      {selectedSchedule && !rosterError && (
        <AttendanceRoster
          key={selectedSchedule.id}
          scheduleId={Number(selectedSchedule.id)}
          classLabel={`${selectedSchedule.branch?.name ?? "Branch"} · ${formatTime(selectedSchedule.time_start)}–${formatTime(selectedSchedule.time_end)}`}
          students={students}
          initialAttendance={attendance}
          canMarkAttendance={canMarkAttendance}
          availableWalkIns={availableWalkIns}
        />
      )}
    </DashboardShell>
  );
}
