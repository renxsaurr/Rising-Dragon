import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import AttendanceRoster from "@/components/AttendanceRoster";
import AttendanceDatePicker from "@/components/AttendanceDatePicker";
import AttendanceBranchSelector, { type AttendanceBranchOption } from "@/components/AttendanceBranchSelector";
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
  searchParams: Promise<{ date?: string; branchId?: string; scheduleId?: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { date: requestedDate, branchId: requestedBranchId, scheduleId: requestedScheduleId } =
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
  const requestedSchedule = schedules.find((schedule) => String(schedule.id) === requestedScheduleId) ?? null;
  const scheduledBranchIds = [...new Set(schedules.map((schedule) => Number(schedule.branch_id)))];
  const branchResult = isAssistant
    ? { data: [], error: null }
    : await supabase.from("branch").select("id, name").eq("is_active", true).order("name");
  if (branchResult.error) {
    return (
      <DashboardShell title="Attendance" currentUser={currentUser}>
        <p role="alert" className="text-sm text-red-600">
          Could not load branches: {branchResult.error.message}
        </p>
      </DashboardShell>
    );
  }
  const scheduledBranches = new Map<number, string>();
  for (const schedule of schedules)
    scheduledBranches.set(Number(schedule.branch_id), schedule.branch?.name ?? "Branch");
  const branchRows = isAssistant
    ? scheduledBranchIds.map((id) => ({ id, name: scheduledBranches.get(id) ?? "Branch" }))
    : (branchResult.data ?? []).map((branch) => ({ id: Number(branch.id), name: branch.name }));
  const branchOptions: AttendanceBranchOption[] = branchRows.map((branch) => ({
    id: branch.id,
    name: branch.name,
    sessions: schedules
      .filter((schedule) => Number(schedule.branch_id) === branch.id)
      .map((schedule) => ({
        id: Number(schedule.id),
        timeStart: schedule.time_start,
        timeEnd: schedule.time_end,
        coachName: fullName(schedule.coach) || "Coach",
      })),
  }));
  const parsedBranchId = Number(requestedBranchId);
  const selectedBranchId = branchOptions.some((branch) => branch.id === parsedBranchId)
    ? parsedBranchId
    : requestedSchedule?.branch_id ?? branchOptions.find((branch) => branch.sessions.length > 0)?.id ?? branchOptions[0]?.id ?? null;
  const selectedBranchSchedules = schedules.filter((schedule) => Number(schedule.branch_id) === selectedBranchId);
  const selectedSchedule = selectedBranchSchedules.find((schedule) => String(schedule.id) === requestedScheduleId)
    ?? selectedBranchSchedules[0]
    ?? null;

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
  let attendance: { student_id: number; status: "Present" | "Late" | "Absent" | "Excused" }[] = [];
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

      {branchOptions.length > 0 && selectedBranchId !== null && (
          <AttendanceBranchSelector
            date={date}
            branches={branchOptions}
            selectedBranchId={selectedBranchId}
            selectedScheduleId={selectedSchedule ? Number(selectedSchedule.id) : null}
          />
      )}

      {!selectedSchedule && (
        <div className="mb-5 rounded-xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
          <p className="text-sm font-medium text-gray-800">
            {branchOptions.length === 0 ? "No classes on this day" : `No class at ${branchOptions.find((branch) => branch.id === selectedBranchId)?.name ?? "this branch"} on this day`}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {isAssistant
              ? "Only your assigned classes appear here. Pick another day above."
              : "Choose a branch with a class or pick another date."}
          </p>
        </div>
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
