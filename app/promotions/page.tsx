import { cookies } from "next/headers";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { fetchAllRows } from "@/utils/fetch-all-rows";
import { getCurrentUser } from "@/utils/getCurrentUser";
import { BELT_LABELS, beltTextColorClass, formatBeltLabel } from "@/utils/belts";
import PromoteStudentModal from "@/components/PromoteStudentModal";
import RowActionsMenu from "@/components/RowActionsMenu";
import RowActionItem from "@/components/RowActionItem";
import PaginatedTableRows from "@/components/PaginatedTableRows";

export const dynamic = "force-dynamic";

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "head_coach") redirect("/students");

  const params = await searchParams;
  const viewParam = params.view;
  const activeView = (Array.isArray(viewParam) ? viewParam[0] : viewParam) === "history"
    ? "history"
    : "promotions";
  const readParam = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const searchQuery = readParam("q")?.trim() ?? "";
  const requestedBranch = readParam("branch");
  const branchFilter = requestedBranch && /^\d+$/.test(requestedBranch) ? requestedBranch : "all";
  const requestedBelt = readParam("belt");
  const beltFilter = requestedBelt && requestedBelt in BELT_LABELS ? requestedBelt : "all";

  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  const { data: students, error } = await supabase
    .from("student")
    .select(
      "id, first_name, middle_name, last_name, belt_level, branch_id, branch:branch!student_branch_id_fkey(name)",
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
    branch_id: number | null;
    branch: { name: string } | null;
  }[];

  const admin = createAdminClient();
  const { data: branchRows } = await admin.from("branch").select("id, name").order("name");
  const branches = (branchRows ?? []) as { id: number; name: string }[];
  type HistoryStudent = {
    first_name: string;
    middle_name: string | null;
    last_name: string;
    branch_id: number | null;
    branch: { name: string } | { name: string }[] | null;
  };
  let history: {
    id: number;
    old_belt: string;
    new_belt: string;
    date: string;
    created_at: string;
    coach_id: number;
    student:
      | HistoryStudent
      | HistoryStudent[]
      | null;
  }[] = [];
  let historyError: string | null = null;
  try {
    history = await fetchAllRows((from, to) => admin
      .from("promotion")
      .select(
        "id, old_belt, new_belt, date, created_at, coach_id, student:student!promotion_student_id_fkey(first_name, middle_name, last_name, branch_id, branch:branch!student_branch_id_fkey(name))",
      )
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to));
  } catch (error) {
    historyError = error instanceof Error ? error.message : "Could not load promotion history.";
  }

  const coachIds = [...new Set(history.map((item) => Number(item.coach_id)))];
  const coachNames = new Map<number, string>();
  for (let start = 0; start < coachIds.length; start += 200) {
    const coachChunk = coachIds.slice(start, start + 200);
    const { data: coachRows } = await admin.from("user")
      .select("id, first_name, middle_name, last_name")
      .in("id", coachChunk);
    for (const coach of coachRows ?? []) {
      coachNames.set(Number(coach.id), [coach.first_name, coach.middle_name, coach.last_name].filter(Boolean).join(" "));
    }
  }

  const total = rows.length;
  const normalizeSearch = searchQuery.toLocaleLowerCase();
  const filteredStudents = rows.filter((student) => {
    const name = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ");
    const branchName = student.branch?.name ?? "No branch";
    return (branchFilter === "all" || String(student.branch_id) === branchFilter)
      && (beltFilter === "all" || student.belt_level === beltFilter)
      && (!normalizeSearch || [name, branchName, formatBeltLabel(student.belt_level)].some((value) => value.toLocaleLowerCase().includes(normalizeSearch)));
  });
  const filteredHistory = history.filter((item) => {
    const person = Array.isArray(item.student) ? item.student[0] : item.student;
    const name = person ? [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ") : "Unknown student";
    const relation = person?.branch;
    const branchRelation = Array.isArray(relation) ? relation[0] : relation;
    const branchName = branchRelation?.name ?? "No branch";
    const coachName = coachNames.get(Number(item.coach_id)) ?? "Unknown coach";
    return (branchFilter === "all" || String(person?.branch_id) === branchFilter)
      && (beltFilter === "all" || item.old_belt === beltFilter || item.new_belt === beltFilter)
      && (!normalizeSearch || [name, branchName, coachName, formatBeltLabel(item.old_belt), formatBeltLabel(item.new_belt), item.date].some((value) => value.toLocaleLowerCase().includes(normalizeSearch)));
  });
  const filterParams = new URLSearchParams();
  if (searchQuery) filterParams.set("q", searchQuery);
  if (branchFilter !== "all") filterParams.set("branch", branchFilter);
  if (beltFilter !== "all") filterParams.set("belt", beltFilter);
  const queryString = filterParams.toString();
  const promotionsHref = `/promotions${queryString ? `?${queryString}` : ""}`;
  const historyParams = new URLSearchParams(filterParams);
  historyParams.set("view", "history");
  const historyHref = `/promotions?${historyParams}`;

  return (
    <DashboardShell title="Promotions" currentUser={currentUser}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Promotions pages">
          <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1">
            <Link
              href={promotionsHref}
              scroll={false}
              aria-current={activeView === "promotions" ? "page" : undefined}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${activeView === "promotions" ? "bg-black text-white shadow-sm" : "text-gray-700 hover:bg-white hover:text-gray-950"}`}
            >
              Promotions
            </Link>
            <Link
              href={historyHref}
              scroll={false}
              aria-current={activeView === "history" ? "page" : undefined}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${activeView === "history" ? "bg-black text-white shadow-sm" : "text-gray-700 hover:bg-white hover:text-gray-950"}`}
            >
              History
            </Link>
          </div>
        </nav>
        <p className="text-sm font-medium text-gray-700">
          {activeView === "history"
            ? `${filteredHistory.length} promotion${filteredHistory.length === 1 ? "" : "s"}`
            : `${filteredStudents.length} active student${filteredStudents.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <form action="/promotions" method="get" className="mb-5 flex flex-wrap items-center gap-2.5">
        {activeView === "history" && <input type="hidden" name="view" value="history" />}
        <label htmlFor="promotion-search" className="sr-only">Search promotions</label>
        <input
          id="promotion-search"
          type="search"
          name="q"
          defaultValue={searchQuery}
          placeholder="Search student, branch, or belt"
          className="h-11 min-w-[220px] flex-1 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-950 outline-none placeholder:text-gray-500 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
        />
        <label htmlFor="promotion-branch-filter" className="sr-only">Branch</label>
        <div className="relative">
          <select id="promotion-branch-filter" name="branch" defaultValue={branchFilter} className="h-11 min-w-[170px] appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-12 text-sm font-medium text-gray-950 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100">
            <option value="all">All branches</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-700" />
        </div>
        <label htmlFor="promotion-belt-filter" className="sr-only">Belt level</label>
        <div className="relative">
          <select id="promotion-belt-filter" name="belt" defaultValue={beltFilter} className={`h-11 min-w-[170px] appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-12 text-sm font-medium outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 ${beltFilter === "all" ? "text-gray-950" : beltTextColorClass(beltFilter)}`}>
            <option value="all">All belt levels</option>
            {Object.entries(BELT_LABELS).map(([value, label]) => <option key={value} value={value} className={beltTextColorClass(value)}>{label}</option>)}
          </select>
          <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-700" />
        </div>
        <button type="submit" className="h-11 rounded-lg bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">Search</button>
        {(searchQuery || branchFilter !== "all" || beltFilter !== "all") && (
          <Link href={activeView === "history" ? "/promotions?view=history" : "/promotions"} className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100">Clear filters</Link>
        )}
      </form>

      {activeView === "promotions" ? <section aria-labelledby="active-students-title">
        <h2 id="active-students-title" className="sr-only">Active students</h2>
        <div className="overflow-x-auto border-y border-gray-200 bg-white">
        {filteredStudents.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-700">
              {total === 0 ? "No active students" : "No students match these filters"}
            </p>
          </div>
        ) : (
            <table className="w-full min-w-[640px] border-collapse text-left text-sm text-gray-950">
              <thead className="border-b border-gray-200 bg-white">
                <tr>
                  <th scope="col" className="w-[7%] px-5 py-4 font-medium text-gray-600">
                    #
                  </th>
                  <th scope="col" className="w-[36%] px-4 py-4 font-medium text-gray-600">
                    Student
                  </th>
                  <th scope="col" className="w-[22%] px-4 py-4 font-medium text-gray-600">
                    Current belt
                  </th>
                  <th scope="col" className="w-[22%] px-4 py-4 font-medium text-gray-600">
                    Branch
                  </th>
                  <th scope="col" className="w-[13%] px-5 py-4 text-right font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <PaginatedTableRows itemLabel="students" colSpan={5}>
                {filteredStudents.map((student, index) => {
                  const fullName = [
                    student.first_name,
                    student.middle_name,
                    student.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <tr
                      key={student.id}
                      className="border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50/50"
                    >
                      <td className="px-5 py-6 text-base font-medium text-gray-800">
                        {index + 1}
                      </td>
                      <td className="px-4 py-6 text-base font-medium text-gray-950">
                        {fullName}
                      </td>
                      <td className={`px-4 py-6 text-base font-medium ${beltTextColorClass(student.belt_level)}`}>
                        {formatBeltLabel(student.belt_level)}
                      </td>
                      <td className="px-4 py-6 text-base font-medium text-gray-950">
                        {student.branch?.name || "—"}
                      </td>
                      <td className="px-5 py-5">
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
        )}
        </div>
      </section> : <section aria-labelledby="promotion-history-title">
        <h2 id="promotion-history-title" className="sr-only">Promotion history</h2>

        {historyError ? (
          <p role="alert" className="border-y border-gray-200 px-5 py-6 text-sm text-red-600">
            Could not load promotion history: {historyError}
          </p>
        ) : filteredHistory.length === 0 ? (
          <div className="border-y border-gray-200 px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-700">
              {history.length === 0 ? "No promotions yet" : "No promotions match these filters"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border-y border-gray-200 bg-white">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm text-gray-950">
              <thead className="border-b border-gray-200 bg-white">
                <tr>
                  <th scope="col" className="w-[7%] px-5 py-4 font-medium text-gray-600">
                    #
                  </th>
                  <th scope="col" className="w-[29%] px-4 py-4 font-medium text-gray-600">
                    Student
                  </th>
                  <th scope="col" className="w-[17%] px-4 py-4 font-medium text-gray-600">
                    Old belt
                  </th>
                  <th scope="col" className="w-[17%] px-4 py-4 font-medium text-gray-600">
                    New belt
                  </th>
                  <th scope="col" className="w-[17%] px-4 py-4 font-medium text-gray-600">
                    Date of promotion
                  </th>
                  <th scope="col" className="w-[13%] px-5 py-4 font-medium text-gray-600">
                    Recorded by
                  </th>
                </tr>
              </thead>
              <PaginatedTableRows itemLabel="promotion history" colSpan={6}>
                {filteredHistory.map((item, index) => {
                  const person = Array.isArray(item.student)
                    ? item.student[0]
                    : item.student;
                  const name = person
                    ? [person.first_name, person.middle_name, person.last_name]
                        .filter(Boolean)
                        .join(" ")
                    : "Unknown student";
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50/50"
                    >
                      <td className="px-5 py-6 text-base font-medium text-gray-800">
                        {index + 1}
                      </td>
                      <td className="px-4 py-6 text-base font-medium text-gray-950">
                        {name}
                      </td>
                      <td className={`px-4 py-6 text-base font-medium ${beltTextColorClass(item.old_belt)}`}>
                        {formatBeltLabel(item.old_belt)}
                      </td>
                      <td className={`px-4 py-6 text-base font-medium ${beltTextColorClass(item.new_belt)}`}>
                        {formatBeltLabel(item.new_belt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-6 text-base font-medium text-gray-950">
                        {new Date(`${item.date}T12:00:00`).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </td>
                      <td className="px-5 py-6 text-base font-medium text-gray-950">
                        {coachNames.get(Number(item.coach_id)) || "Unknown coach"}
                      </td>
                    </tr>
                  );
                })}
              </PaginatedTableRows>
            </table>
          </div>
        )}
      </section>}
    </DashboardShell>
  );
}
