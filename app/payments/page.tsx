import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import AddPaymentButton from "./_components/AddPaymentButton";
import AdvancePaymentButton from "./_components/AdvancePaymentButton";
import BranchCards from "./_components/BranchCards";
import MissedMonthsList from "./_components/MissedMonthsList";
import MonthPicker from "./_components/MonthPicker";
import NotPaidSection from "./_components/NotPaidSection";
import PaymentFilter from "./_components/PaymentFilter";
import PaymentRecordsTable from "./_components/PaymentRecordsTable";
import PaymentReport from "./_components/PaymentReport";
import PaymentTabs, { type TabItem } from "./_components/PaymentTabs";
import PrintPaymentReportButton from "./_components/PrintPaymentReportButton";
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
import type { ReminderSchedule } from "@/utils/reminder-timing";
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

  const [failedResult, monthResult, historyResult, settingsResult] =
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
    admin.from("payment_settings").select("monthly_fee, per_session_fee, reminder_before_due_days, reminder_after_due_days").eq("singleton", true).maybeSingle(),
  ]);

  const loadError =
    failedResult?.error ??
    monthResult?.error ??
    historyResult?.error ??
    settingsResult.error?.message;
  if (loadError) {
    const billingMigrationMissing =
      loadError.includes("student.billing_plan") ||
      loadError.includes("per_session_fee");
    return (
      <DashboardShell title="Payments" currentUser={currentUser}>
        <p role="alert" className="text-sm text-red-600">
          {billingMigrationMissing
            ? "The payments database is missing the student billing plan update. Apply supabase/migrations/20261008190000_student_billing_plans_and_session_checkins.sql in Supabase, then reload this page."
            : `Could not load payments: ${loadError}`}
        </p>
      </DashboardShell>
    );
  }

  const failedCount = failedResult?.count ?? 0;
  const monthlyFee = settingsResult.data?.monthly_fee == null ? null : Number(settingsResult.data.monthly_fee);
  const perSessionFee = Number(settingsResult.data?.per_session_fee ?? 150);
  const reminderSchedule: ReminderSchedule = {
    beforeDueDays: Number(settingsResult.data?.reminder_before_due_days ?? 3),
    afterDueDays: Number(settingsResult.data?.reminder_after_due_days ?? 3),
  };

  const monthData = monthResult?.data ?? null;
  const selected =
    monthData?.branches.find((branch) => branch.key === requestedBranch) ??
    monthData?.branches[0];
  const query = { month, branch: selected?.key ?? requestedBranch, filter };

  if (showHistory && historyResult?.data) {
    return (
      <DashboardShell title="Payments" currentUser={currentUser}>
        {stuckError && (
          <p role="alert" className="mb-4 text-[13px] text-red-700">
            Could not check for interrupted reminders: {stuckError}
          </p>
        )}
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
      billingPlan: student.billingPlan,
    }));
  const monthlyStudentChoices = studentChoices.filter((student) => student.billingPlan === "Monthly");
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
  // For the printed report. selected.name is already "All branches" for the "all" card.
  const generatedAt = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const generatedBy = [currentUser.first_name, currentUser.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <DashboardShell title="Payments" currentUser={currentUser}>
      {/* Everything on screen. On paper only the report below is shown. */}
      <div className="space-y-5 print:hidden">
        {stuckError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            Could not check for interrupted reminders: {stuckError}
          </p>
        )}

        <section aria-labelledby="payment-overview-title" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="payment-overview-title" className="text-lg font-semibold tracking-tight text-gray-950">Payment overview</h2>
              <p className="mt-1 text-sm text-gray-700">Collected and outstanding amounts by branch.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <MonthPicker month={month} branch={selected.key} filter={filter} tab={chosenTab} />
            </div>
          </div>

          <BranchCards
            branches={monthData.branches}
            notPaid={trackingStarted ? monthData.notPaid : {}}
            selectedKey={selected.key}
            month={month}
            filter={filter}
            tab={chosenTab}
          />
        </section>

        <section aria-label="Payment actions" className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-950">Payment actions</h2>
            <p className="mt-0.5 text-[13px] text-gray-700">Record payments or review and export payment activity.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <PrintPaymentReportButton
              documentTitle={`Payment Report - ${monthLabel} - ${selected.name}`}
            />
            <AddPaymentButton
              students={studentChoices}
              branchName={selected.key === "all" ? undefined : selected.name}
              monthlyFee={monthlyFee}
              perSessionFee={perSessionFee}
              month={month}
              today={today}
            />
            <AdvancePaymentButton students={monthlyStudentChoices} today={today} />
            <Link
              href={paymentsHref({ ...query, view: "history" })}
              scroll={false}
              className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Reminder history
            </Link>
          </div>
        </section>

        <div className="min-w-0">
          <PaymentTabs tabs={tabs} active={activeTab} panelId="payments-tab-panel" />
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
                  Monthly bills follow each student’s enrollment date. Reminders are available {reminderSchedule.beforeDueDays} days before, on, and {reminderSchedule.afterDueDays} days after the due date while the bill remains unpaid.
                </p>
              </div>
              {notPaid.notPaidCount > 0 ? (
                <NotPaidSection
                  students={notPaid.students}
                  showBranch={selected.key === "all"}
                  studentChoices={studentChoices}
                  branchName={selected.key === "all" ? undefined : selected.name}
                  monthlyFee={monthlyFee}
                  perSessionFee={perSessionFee}
                  reminderSchedule={reminderSchedule}
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
                reminderSchedule={reminderSchedule}
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
      </div>

      <PaymentReport
        monthLabel={monthLabel}
        branchLabel={selected.name}
        showBranch={selected.key === "all"}
        generatedAt={generatedAt}
        generatedBy={generatedBy}
        stats={selected}
        notPaid={notPaid}
        trackingStarted={trackingStarted}
        rows={branchRows}
        missed={missed}
      />
    </DashboardShell>
  );
}
