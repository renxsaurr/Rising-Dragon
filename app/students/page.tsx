import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import DashboardShell from "@/components/DashboardShell";
import StudentModal from "@/components/StudentModal";
import StudentStatusButton from "@/components/StudentStatusButton";
import StudentFilters from "@/components/StudentFilters";
import { getCurrentUser } from "@/utils/getCurrentUser";
import { getCoachBranchIdsForDate } from "@/utils/coach-access";
import { dateInTimeZone } from "@/utils/dates";
import { redirect } from "next/navigation";
import { BELT_COLORS, BELT_LABELS, formatBeltLabel } from "@/utils/belts";
import RowActionsMenu from "@/components/RowActionsMenu";
import RowActionItem, { ROW_ACTION_CLASS } from "@/components/RowActionItem";
import PaginatedTableRows from "@/components/PaginatedTableRows";
import PaginatedListItems from "@/components/PaginatedListItems";

type StudentRow = {
  id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  belt_level: string;
  branch_id: number;
  is_active: boolean;
  guardian_name: string;
  guardian_contact: string | null;
  guardian_email: string;
  enrollment_date: string;
  branch: { name: string } | null;
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    branch?: string | string[];
    belt?: string | string[];
  }>;
}) {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (!["head_coach", "assistant_coach"].includes(currentUser.role))
    redirect("/scheduling");
  const isHeadCoach = currentUser.role === "head_coach";

  const params = await searchParams;
  const requestedStatus = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const statusFilter =
    isHeadCoach && ["active", "archived", "all"].includes(requestedStatus ?? "")
      ? (requestedStatus as "active" | "archived" | "all")
      : "active";

  let assignedBranchIds: number[] | null = null;
  if (currentUser?.role === "assistant_coach") {
    try {
      assignedBranchIds = await getCoachBranchIdsForDate(
        currentUser.id,
        dateInTimeZone(),
      );
    } catch (accessError) {
      const message =
        accessError instanceof Error
          ? accessError.message
          : "Unable to verify your branch assignments.";
      return (
        <DashboardShell title="Students" currentUser={currentUser}>
          <p role="alert" className="text-sm text-red-600">
            {message}
          </p>
        </DashboardShell>
      );
    }
  }

  let branchQuery = supabase.from("branch").select("id, name, is_active").order("name");
  if (assignedBranchIds?.length)
    branchQuery = branchQuery.in("id", assignedBranchIds);
  else if (assignedBranchIds) branchQuery = branchQuery.eq("id", -1);
  const { data: branchRows } = await branchQuery;
  const filterBranches = branchRows ?? [];
  const activeBranches = filterBranches.filter((branch) => branch.is_active);
  const branchOptionsForStudent = (student: StudentRow) =>
    activeBranches.some((branch) => branch.id === student.branch_id)
      ? activeBranches
      : [
          ...activeBranches,
          {
            id: student.branch_id,
            name: student.branch?.name ?? "Archived branch",
          },
        ];

  const requestedBranchIds = Array.isArray(params.branch)
    ? params.branch
    : params.branch
      ? [params.branch]
      : [];
  const availableBranchIds = new Set(
    filterBranches.map((branch) => String(branch.id)),
  );
  const selectedBranchIds = [
    ...new Set(
      requestedBranchIds.filter(
        (id) => /^\d+$/.test(id) && availableBranchIds.has(id),
      ),
    ),
  ];
  const requestedBelts = Array.isArray(params.belt)
    ? params.belt
    : params.belt
      ? [params.belt]
      : [];
  const selectedBelts = [
    ...new Set(
      requestedBelts.filter((belt) => Object.hasOwn(BELT_LABELS, belt)),
    ),
  ];
  // Guardian contact fields are private and granted only to the server role.
  // Head Coach pages load them through the server-only admin client after the
  // role check above; assistants use the restricted roster grant and RLS.
  const studentClient = isHeadCoach ? createAdminClient() : supabase;
  let studentQuery = studentClient
    .from("student")
    .select(
      isHeadCoach
        ? "*, branch:branch!student_branch_id_fkey(name)"
        : "id, first_name, middle_name, last_name, belt_level, branch_id, is_active, branch:branch!student_branch_id_fkey(name)",
    )
    .order("last_name")
    .order("first_name");
  if (statusFilter === "active")
    studentQuery = studentQuery.eq("is_active", true);
  if (statusFilter === "archived")
    studentQuery = studentQuery.eq("is_active", false);
  if (assignedBranchIds?.length)
    studentQuery = studentQuery.in("branch_id", assignedBranchIds);
  else if (assignedBranchIds) studentQuery = studentQuery.eq("branch_id", -1);
  if (selectedBranchIds.length > 0)
    studentQuery = studentQuery.in("branch_id", selectedBranchIds.map(Number));
  if (selectedBelts.length > 0)
    studentQuery = studentQuery.in("belt_level", selectedBelts);
  const { data: studentData, error } = await studentQuery;
  const students = (studentData ?? []) as unknown as StudentRow[];
  if (error) {
    return (
      <DashboardShell title="Students" currentUser={currentUser}>
        <p className="text-red-600 text-sm">
          Something went wrong: {error.message}
        </p>
      </DashboardShell>
    );
  }

  const total = students.length;
  const assistantHasNoSchedule =
    currentUser.role === "assistant_coach" &&
    (assignedBranchIds?.length ?? 0) === 0;
  const summary = assistantHasNoSchedule
    ? "Your roster appears here when you are scheduled at a branch."
    : isHeadCoach
      ? `${total} student record${total === 1 ? " matches" : "s match"} the selected filters.`
      : `${total} student${total === 1 ? "" : "s"} at your assigned branches today.`;

  return (
    <DashboardShell title="Students" currentUser={currentUser}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-gray-950">
            {isHeadCoach
              ? statusFilter === "archived"
                ? "Archived students"
                : statusFilter === "all"
                  ? "All students"
                  : "Active students"
              : "Assigned branch roster"}
          </h2>
          <p className="text-[13px] text-gray-500 mt-0.5">{summary}</p>
        </div>
        {isHeadCoach && statusFilter !== "archived" && (
          <StudentModal branches={activeBranches} />
        )}
      </div>

      <StudentFilters
        branches={filterBranches.map((branch) => ({
          value: String(branch.id),
          label: branch.name,
        }))}
        belts={Object.entries(BELT_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
        canFilterStatus={currentUser.role === "head_coach"}
        selectedBranchIds={selectedBranchIds}
        selectedBelts={selectedBelts}
        selectedStatus={statusFilter}
      />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {total === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-700">
              {assistantHasNoSchedule
                ? "No branch assigned today"
                : total === 0 && statusFilter === "archived"
                  ? "No archived students"
                  : "No students match these filters"}
            </p>
            <p className="mt-1 text-[13px] text-gray-500">
              {assistantHasNoSchedule
                ? "Your roster appears here when you are scheduled at a branch."
                : total === 0 && statusFilter === "archived"
                  ? "Archived student records will appear here."
                  : "Try changing or clearing the filters."}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden xl:block">
              <table className="system-data-table w-full table-fixed border-collapse text-left">
                <colgroup>
                  {isHeadCoach ? (
                    <>
                      <col className="w-[16%]" />
                      <col className="w-[18%]" />
                      <col className="w-[9%]" />
                      <col className="w-[11%]" />
                      <col className="w-[16%]" />
                      <col className="w-[11%]" />
                      <col className="w-[19%]" />
                    </>
                  ) : (
                    <>
                      <col className="w-[38%]" />
                      <col className="w-[22%]" />
                      <col className="w-[25%]" />
                      <col className="w-[15%]" />
                    </>
                  )}
                </colgroup>
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Student
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Belt level
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Branch
                    </th>
                    {isHeadCoach && (
                      <>
                        <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Guardian
                        </th>
                        <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Guardian contact
                        </th>
                        <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Enrolled
                        </th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Actions
                        </th>
                      </>
                    )}
                    {!isHeadCoach && (
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-600">Actions</th>
                    )}
                  </tr>
                </thead>
                <PaginatedTableRows itemLabel="students" pageSize={6} colSpan={isHeadCoach ? 7 : 4}>
                  {students?.map((student) => {
                    const fullName = [
                      student.first_name,
                      student.middle_name,
                      student.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ");
                    const beltStyle =
                      BELT_COLORS[student.belt_level] ??
                      "bg-gray-100 text-gray-700";

                    return (
                      <tr
                        id={`student-${student.id}-desktop`}
                        key={student.id}
                        className="transition-colors hover:bg-gray-50/70"
                      >
                        <td className="break-words px-5 py-4 text-sm font-medium text-gray-950">
                          <span className="block">{fullName}</span>
                        </td>
                        <td className="px-3 py-4 text-sm font-medium text-gray-950">
                          <span
                            className={`inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${beltStyle}`}
                          >
                            {formatBeltLabel(student.belt_level)}
                          </span>
                        </td>
                        <td className="whitespace-normal break-words px-3 py-4 text-sm font-medium text-gray-950">
                          {student.branch?.name || "—"}
                        </td>
                        {isHeadCoach && (
                          <>
                            <td className="whitespace-normal break-words px-3 py-4 text-sm font-medium text-gray-950">
                              {student.guardian_name || "—"}
                            </td>
                            <td className="whitespace-normal px-3 py-4 text-sm font-medium text-gray-950">
                              <span className="block break-words">
                                {student.guardian_contact || "—"}
                              </span>
                              <span className="block break-all text-xs font-medium text-gray-950">
                                {student.guardian_email}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-950">
                              {new Date(
                                student.enrollment_date,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <RowActionsMenu>
                                  <Link className={ROW_ACTION_CLASS} href={`/attendance/history?studentId=${student.id}`}>Attendance history</Link>
                                  <Link className={ROW_ACTION_CLASS} href={`/students/${student.id}/progress`}>Student progress</Link>
                                  {student.is_active && <StudentModal branches={branchOptionsForStudent(student)} student={student} trigger={<RowActionItem>Edit student</RowActionItem>} />}
                                  <StudentStatusButton
                                    studentId={student.id}
                                    studentName={fullName}
                                    isActive={student.is_active}
                                    className={`${ROW_ACTION_CLASS} ${student.is_active ? "text-red-700 hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50"}`}
                                  />
                                </RowActionsMenu>
                              </div>
                            </td>
                          </>
                        )}
                        {!isHeadCoach && <td className="px-4 py-3 text-right"><RowActionsMenu><Link className={ROW_ACTION_CLASS} href={`/attendance/history?studentId=${student.id}`}>Attendance history</Link><Link className={ROW_ACTION_CLASS} href={`/students/${student.id}/progress`}>Student progress</Link></RowActionsMenu></td>}
                      </tr>
                    );
                  })}
                </PaginatedTableRows>
              </table>
            </div>

            <div className="divide-y divide-gray-100 overflow-hidden rounded-b-xl xl:hidden">
              <PaginatedListItems itemLabel="students" pageSize={6}>
              {students?.map((student) => {
                const fullName = [
                  student.first_name,
                  student.middle_name,
                  student.last_name,
                ]
                  .filter(Boolean)
                  .join(" ");
                const beltStyle =
                  BELT_COLORS[student.belt_level] ??
                  "bg-gray-100 text-gray-700";

                return (
                  <div
                    id={`student-${student.id}-mobile`}
                    key={student.id}
                    className="p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-gray-950">
                          {fullName}
                        </p>
                      </div>
                      {isHeadCoach && (
                        <div className="flex shrink-0 items-center gap-2">
                          <RowActionsMenu>
                            <Link className={ROW_ACTION_CLASS} href={`/attendance/history?studentId=${student.id}`}>Attendance history</Link>
                            <Link className={ROW_ACTION_CLASS} href={`/students/${student.id}/progress`}>Student progress</Link>
                            {student.is_active && <StudentModal branches={branchOptionsForStudent(student)} student={student} trigger={<RowActionItem>Edit student</RowActionItem>} />}
                            <StudentStatusButton studentId={student.id} studentName={fullName} isActive={student.is_active} className={`${ROW_ACTION_CLASS} ${student.is_active ? "text-red-700 hover:bg-red-50" : "text-emerald-700 hover:bg-emerald-50"}`} />
                          </RowActionsMenu>
                        </div>
                      )}
                      {!isHeadCoach && <RowActionsMenu><Link className={ROW_ACTION_CLASS} href={`/attendance/history?studentId=${student.id}`}>Attendance history</Link><Link className={ROW_ACTION_CLASS} href={`/students/${student.id}/progress`}>Student progress</Link></RowActionsMenu>}
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      <div className="col-span-2 min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                          Belt Level
                        </dt>
                        <dd className="mt-1">
                          <span
                            className={`inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${beltStyle}`}
                          >
                            {formatBeltLabel(student.belt_level)}
                          </span>
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                          Branch
                        </dt>
                        <dd className="mt-1 break-words text-sm font-medium text-gray-950">
                          {student.branch?.name || "—"}
                        </dd>
                      </div>
                      {isHeadCoach && (
                        <>
                          <div className="min-w-0">
                            <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                              Guardian Name
                            </dt>
                            <dd className="mt-1 break-words text-sm font-medium text-gray-950">
                              {student.guardian_name || "—"}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                              Guardian Contact
                            </dt>
                            <dd className="mt-1 break-all text-sm font-medium text-gray-950">
                              {student.guardian_contact || "—"}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                              Guardian Email
                            </dt>
                            <dd className="mt-1 break-all text-sm font-medium text-gray-950">
                              {student.guardian_email}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                              Enrolled
                            </dt>
                            <dd className="mt-1 text-sm font-medium text-gray-950">
                              {new Date(
                                student.enrollment_date,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </dd>
                          </div>
                        </>
                      )}
                    </dl>
                  </div>
                );
              })}
              </PaginatedListItems>
            </div>
          </>
        )}

        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3.5">
          <p className="text-[13px] text-gray-500">
            <span className="font-medium text-gray-700">{total}</span> result
            {total === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
