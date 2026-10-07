import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/utils/getCurrentUser";
import { BELT_COLORS, formatBeltLabel } from "@/utils/belts";
import PromoteStudentModal from "@/components/PromoteStudentModal";
import RowActionsMenu from "@/components/RowActionsMenu";
import RowActionItem from "@/components/RowActionItem";
import PaginatedTableRows from "@/components/PaginatedTableRows";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "head_coach") redirect("/students");

  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  const { data: students, error } = await supabase
    .from("student")
    .select(
      "id, first_name, middle_name, last_name, belt_level, branch:branch!student_branch_id_fkey(name)",
    )
    .eq("is_active", true)
    .order("last_name")
    .order("first_name");

  if (error) {
    return (
      <DashboardShell title="Promotions" currentUser={currentUser}>
        <p role="alert" className="text-sm text-red-600">
          Could not load students: {error.message}
        </p>
      </DashboardShell>
    );
  }

  const rows = (students ?? []) as unknown as {
    id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    belt_level: string;
    branch: { name: string } | null;
  }[];

  const { data: historyData, error: historyError } = await supabase
    .from("promotion")
    .select(
      "id, old_belt, new_belt, date, created_at, student:student!promotion_student_id_fkey(first_name, middle_name, last_name)",
    )
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  const history = (historyData ?? []) as unknown as {
    id: number;
    old_belt: string;
    new_belt: string;
    date: string;
    student:
      | { first_name: string; middle_name: string | null; last_name: string }
      | { first_name: string; middle_name: string | null; last_name: string }[]
      | null;
  }[];

  const total = rows.length;

  return (
    <DashboardShell title="Promotions" currentUser={currentUser}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-gray-950">
          Active students
        </h2>
        <p className="mt-0.5 text-[13px] text-gray-500">
          {total} active student{total === 1 ? "" : "s"} and their current belt.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {total === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-700">
              No active students
            </p>
            <p className="mt-1 text-[13px] text-gray-500">
              Active students will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="system-data-table w-full min-w-[480px] border-collapse text-left">
              <thead className="border-b border-gray-200 bg-gray-50/70">
                <tr>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Student
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Current belt
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <PaginatedTableRows itemLabel="students" colSpan={4}>
                {rows.map((student) => {
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
                      key={student.id}
                      className="transition-colors hover:bg-gray-50/70"
                    >
                      <td className="px-5 py-4 text-sm font-medium text-gray-950">
                        {fullName}
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${beltStyle}`}
                        >
                          {formatBeltLabel(student.belt_level)}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-sm font-medium text-gray-950">
                        {student.branch?.name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <RowActionsMenu>
                            <PromoteStudentModal studentId={student.id} studentName={fullName} currentBelt={student.belt_level} trigger={<RowActionItem>Record promotion</RowActionItem>} />
                          </RowActionsMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </PaginatedTableRows>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3.5">
          <p className="text-[13px] text-gray-500">
            <span className="font-medium text-gray-700">{total}</span> result
            {total === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mb-4 mt-8">
        <h2 className="text-xl font-semibold tracking-tight text-gray-950">
          Promotion history
        </h2>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Old belt, new belt, and date of promotion.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {historyError ? (
          <p role="alert" className="px-5 py-6 text-sm text-red-600">
            Could not load promotion history: {historyError.message}
          </p>
        ) : history.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-700">
              No promotions yet
            </p>
            <p className="mt-1 text-[13px] text-gray-500">
              Promotions you record will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="system-data-table w-full min-w-[560px] border-collapse text-left">
              <thead className="border-b border-gray-200 bg-gray-50/70">
                <tr>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Student
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Old belt
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    New belt
                  </th>
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Date of promotion
                  </th>
                </tr>
              </thead>
              <PaginatedTableRows itemLabel="promotion history" colSpan={4}>
                {history.map((item) => {
                  const person = Array.isArray(item.student)
                    ? item.student[0]
                    : item.student;
                  const name = person
                    ? [person.first_name, person.middle_name, person.last_name]
                        .filter(Boolean)
                        .join(" ")
                    : "Unknown student";
                  const pill =
                    "inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-gray-50/70"
                    >
                      <td className="px-5 py-4 text-sm font-medium text-gray-950">
                        {name}
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`${pill} ${BELT_COLORS[item.old_belt] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {formatBeltLabel(item.old_belt)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`${pill} ${BELT_COLORS[item.new_belt] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {formatBeltLabel(item.new_belt)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-950">
                        {new Date(`${item.date}T12:00:00`).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </td>
                    </tr>
                  );
                })}
              </PaginatedTableRows>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3.5">
          <p className="text-[13px] text-gray-500">
            <span className="font-medium text-gray-700">{history.length}</span>{" "}
            record{history.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
