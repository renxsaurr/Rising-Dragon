import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import AddPaymentButton from "./_components/AddPaymentButton";
import BranchCards from "./_components/BranchCards";
import MissedMonthsList from "./_components/MissedMonthsList";
import MonthPicker from "./_components/MonthPicker";
import NotPaidSection from "./_components/NotPaidSection";
import PaymentFilter from "./_components/PaymentFilter";
import PaymentRecordsTable from "./_components/PaymentRecordsTable";
import PaymentTabs, { type TabItem } from "./_components/PaymentTabs";
import ReminderHistoryView from "./_components/ReminderHistoryView";
import {
  PAYMENT_FILTERS,
  isPaymentFilter,
  isPaymentTab,
  paymentsHref,
  type PaymentFilterKey,
  type PaymentTab,
} from "./_components/payments-url";
import { getCurrentUser } from "@/utils/getCurrentUser";
import { TRACKING_START_MONTH } from "@/utils/academy-settings";
import { formatBeltLabel } from "@/utils/belts";
import { createAdminClient } from "@/utils/supabase/admin";
import { dateInTimeZone } from "@/utils/dates";
import { failStuckReminders, formatAmount } from "@/utils/payment-reminders";
import {
  formatMonth,
  isMonthKey,
  loadPaymentMonth,
  type PaymentRecord,
} from "@/utils/payment-records";
import {
  countFailedReminders,
  loadReminderHistory,
} from "@/utils/reminder-history";

export const dynamic = "force-dynamic";

// "Unpaid" means every Unpaid payment (overdue and due soon included), like the card counts.
const matchesFilter = (row: PaymentRecord, filter: PaymentFilterKey) => {
  if (filter === "all") return true;
  if (filter === "unpaid") return row.status === "Unpaid";
  if (filter === "paid") return row.status === "Paid";
  return row.kind === filter;
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "head_coach") redirect("/students");

  const params = await searchParams;
  const param = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  // Invalid values fall back to the defaults: this month (Manila), all branches, all payments.
  const today = dateInTimeZone();
  const monthParam = param("month");
  const month = isMonthKey(monthParam) ? monthParam : today.slice(0, 7);
  const branchParam = param("branch");
  const requestedBranch =
    branchParam && /^\d+$/.test(branchParam) ? branchParam : "all";
  const filterParam = param("filter");
  const filter: PaymentFilterKey = isPaymentFilter(filterParam)
    ? filterParam
    : "all";
  const showHistory = param("view") === "history";

  // Read with the admin client only after the Head Coach check above,
  // so Row Level Security can't hide payment or reminder rows from this page.
  const admin = createAdminClient();

  // There is no daily job any more, so clean up interrupted sends whenever the page loads.
  const stuckError = await failStuckReminders(admin);

  const [failedResult, monthResult, historyResult] =
    await Promise.all([
    // The main view only needs the number of failed reminders, for the red banner.
    showHistory ? null : countFailedReminders(admin),
    // The history view doesn't show the month, so it isn't loaded there.
    // It also brings the active students (Add payment, "Not paid yet").
    showHistory ? null : loadPaymentMonth(admin, month, today),
    // One page of reminder history (20 rows), only on the history view.
    showHistory
      ? loadReminderHistory(admin, {
          hq: param("hq"),
          hstatus: param("hstatus"),
          htype: param("htype"),
          hbranch: param("hbranch"),
          hpage: param("hpage"),
        })
      : null,
  ]);

  const loadError =
    failedResult?.error ??
    monthResult?.error ??
    historyResult?.error;
  if (loadError) {
    return (
      <DashboardShell title="Payments" currentUser={currentUser}>
        <p role="alert" className="text-sm text-red-600">
          Could not load payments: {loadError}
        </p>
      </DashboardShell>
    );
  }

  const failedCount = failedResult?.count ?? 0;

  const monthData = monthResult?.data ?? null;
  const selected =
    monthData?.branches.find((branch) => branch.key === requestedBranch) ??
    monthData?.branches[0];
  const query = { month, branch: selected?.key ?? requestedBranch, filter };

  const intro = (
    <>
      <p className="mb-4 text-[13px] text-gray-500">
        The Head Coach reviews and sends each reminder by Gmail: 3 days before
        the due date, on the due date, and 3 days after. Sending an email never
        marks a payment as paid.
      </p>

      {stuckError && (
        <p role="alert" className="mb-4 text-[13px] text-red-600">
          Could not check for interrupted reminders: {stuckError}
        </p>
      )}

    </>
  );

  if (showHistory && historyResult?.data) {
    return (
      <DashboardShell title="Payments" currentUser={currentUser}>
        {intro}
        <ReminderHistoryView
          history={historyResult.data}
          base={{ month, branch: requestedBranch, filter }}
        />
      </DashboardShell>
    );
  }

  // Can't happen after the load error check above, but keeps TypeScript sure the data is there.
  if (!monthData || !selected) {
    return (
      <DashboardShell title="Payments" currentUser={currentUser}>
        <p role="alert" className="text-sm text-red-600">
          Could not load payments.
        </p>
      </DashboardShell>
    );
  }

  const branchRows =
    selected.key === "all"
      ? monthData.rows
      : monthData.rows.filter((row) => String(row.branchId) === selected.key);
  const counts = Object.fromEntries(
    PAYMENT_FILTERS.map(({ key }) => [
      key,
      branchRows.filter((row) => matchesFilter(row, key)).length,
    ]),
  ) as Record<PaymentFilterKey, number>;
  const visibleRows = branchRows.filter((row) => matchesFilter(row, filter));
  const branchNames = new Map(
    monthData.branches.map((branch) => [branch.key, branch.name]),
  );
  // When a branch card is selected, only that branch's students.
  const studentChoices = monthData.activeStudents
    .filter(
      (student) =>
        selected.key === "all" || String(student.branchId) === selected.key,
    )
    .map((student) => ({
      id: student.id,
      name: student.name,
      belt: formatBeltLabel(student.beltLevel),
      branch: branchNames.get(String(student.branchId)) ?? "No branch",
    }));
  const notPaid = monthData.notPaid[selected.key] ?? {
    activeCount: 0,
    notPaidCount: 0,
    students: [],
  };
  // Months before the academy started using the system are never shown as unpaid.
  const trackingStarted = !TRACKING_START_MONTH || month >= TRACKING_START_MONTH;
  const missed = monthData.missedMonths[selected.key] ?? [];
  const olderOverdue = monthData.olderOverdue[selected.key] ?? {
    count: 0,
    total: 0,
    oldestMonth: null,
  };

  // Tabs: Not paid yet only once tracking has started. A missing or unknown ?tab means:
  // Not paid yet when someone hasn't paid, otherwise Payment records.
  const availableTabs: PaymentTab[] = trackingStarted
    ? ["notpaid", "missed", "records"]
    : ["missed", "records"];
  const tabParam = param("tab");
  const chosenTab =
    isPaymentTab(tabParam) && availableTabs.includes(tabParam) ? tabParam : undefined;
  const activeTab: PaymentTab =
    chosenTab ?? (trackingStarted && notPaid.notPaidCount > 0 ? "notpaid" : "records");
  const monthLabel = formatMonth(month);
  const branchSuffix = selected.key === "all" ? "" : ` · ${selected.name}`;
  const tabLabels: Record<PaymentTab, { label: string; count: number; alert: boolean }> = {
    notpaid: { label: "Not paid yet", count: notPaid.notPaidCount, alert: true },
    missed: { label: "Missed months", count: missed.length, alert: true },
    records: { label: "Payment records", count: branchRows.length, alert: false },
  };
  const tabs: TabItem[] = availableTabs.map((key) => ({
    key,
    id: `payments-tab-${key}`,
    ...tabLabels[key],
    href: paymentsHref({ month, branch: selected.key, filter, tab: key }),
  }));
  const hasOlderOverdue = olderOverdue.count > 0 && olderOverdue.oldestMonth;

  return (
    <DashboardShell title="Payments" currentUser={currentUser}>
      {intro}

      <div className="mb-5">
        <MonthPicker month={month} branch={selected.key} filter={filter} tab={chosenTab} />
      </div>

      <BranchCards
        branches={monthData.branches}
        notPaid={trackingStarted ? monthData.notPaid : {}}
        selectedKey={selected.key}
        month={month}
        filter={filter}
        tab={chosenTab}
      />

      {/* Tab bar, with the actions on the right. On small screens the actions wrap below. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <PaymentTabs tabs={tabs} active={activeTab} panelId="payments-tab-panel" />
        <div className="flex flex-wrap items-center gap-3">
          <AddPaymentButton
            students={studentChoices}
            branchName={selected.key === "all" ? undefined : selected.name}
            month={month}
            today={today}
          />
          <Link
            href={paymentsHref({ ...query, view: "history" })}
            scroll={false}
            className="text-xs font-semibold text-gray-700 underline decoration-gray-300 underline-offset-4 hover:text-black"
          >
            Reminder history
          </Link>
        </div>
      </div>

      {/* One compact alert area, only when there is something to say. */}
      {(failedCount > 0 || hasOlderOverdue) && (
        <div className="mb-3 space-y-1 rounded-lg bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
          {failedCount > 0 && (
            <p>
              {failedCount} reminder{failedCount === 1 ? "" : "s"} failed ·{" "}
              <Link
                href={paymentsHref({ ...query, view: "history", history: { hstatus: "Failed" } })}
                scroll={false}
                className="font-semibold underline underline-offset-2 hover:text-red-800"
              >
                Review
              </Link>
            </p>
          )}
          {hasOlderOverdue && olderOverdue.oldestMonth && (
            <p>
              {olderOverdue.count} unpaid payment
              {olderOverdue.count === 1 ? " from earlier months is" : "s from earlier months are"} overdue ·{" "}
              {formatAmount(olderOverdue.total)} ·{" "}
              <Link
                href={paymentsHref({
                  month: olderOverdue.oldestMonth,
                  branch: selected.key,
                  filter: "overdue",
                  tab: "records",
                })}
                scroll={false}
                className="font-semibold underline underline-offset-2 hover:text-red-800"
              >
                View {formatMonth(olderOverdue.oldestMonth)}
              </Link>
            </p>
          )}
        </div>
      )}

      <section
        id="payments-tab-panel"
        role="tabpanel"
        aria-labelledby={`payments-tab-${activeTab}`}
        className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white"
      >
        {activeTab === "notpaid" && (
          <>
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-950">
                Not paid yet — {monthLabel}
                <span className="font-normal text-gray-500">{branchSuffix}</span>
              </h2>
              <p className="mt-0.5 text-[13px] text-gray-500">
                Active students with no payment for {monthLabel}.
              </p>
            </div>
            {notPaid.notPaidCount > 0 ? (
              <NotPaidSection
                students={notPaid.students}
                showBranch={selected.key === "all"}
                studentChoices={studentChoices}
                branchName={selected.key === "all" ? undefined : selected.name}
                month={month}
                today={today}
              />
            ) : notPaid.activeCount > 0 ? (
              <p className="px-5 py-6 text-[13px] font-medium text-emerald-700">
                Everyone has paid for {monthLabel}.
              </p>
            ) : (
              <p className="px-5 py-6 text-[13px] text-gray-500">No active students in this branch yet.</p>
            )}
          </>
        )}

        {activeTab === "missed" && (
          <>
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-950">
                Missed months
                <span className="font-normal text-gray-500">{branchSuffix}</span>
              </h2>
              <p className="mt-0.5 text-[13px] text-gray-500">
                Past months with no payment. The current month is under Not paid yet.
              </p>
            </div>
            {missed.length > 0 ? (
              <MissedMonthsList
                students={missed}
                showBranch={selected.key === "all"}
                branch={selected.key}
              />
            ) : (
              <p className="px-5 py-6 text-[13px] font-medium text-emerald-700">
                No missed months since{" "}
                {formatMonth(monthData.missedSince ?? TRACKING_START_MONTH ?? month)}.
              </p>
            )}
          </>
        )}

        {activeTab === "records" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-950">
                Payment records — {monthLabel}
                <span className="font-normal text-gray-500"> · {selected.name}</span>
              </h2>
              <PaymentFilter
                month={month}
                branch={selected.key}
                filter={filter}
                counts={counts}
                tab="records"
              />
            </div>
            {!trackingStarted && TRACKING_START_MONTH && (
              <p className="border-b border-gray-100 bg-gray-50 px-5 py-2.5 text-[13px] text-gray-500">
                Payment tracking started in {formatMonth(TRACKING_START_MONTH)}.
              </p>
            )}
            <PaymentRecordsTable
              rows={visibleRows}
              today={today}
              showBranch={selected.key === "all"}
              emptyText={
                branchRows.length
                  ? "No payments match this filter."
                  : "No payments for this month yet."
              }
            />
          </>
        )}
      </section>
    </DashboardShell>
  );
}
