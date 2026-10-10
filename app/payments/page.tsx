import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import BranchCards from "./_components/BranchCards";
import MonthPicker from "./_components/MonthPicker";
import HistoryPageTabs from "./_components/HistoryPageTabs";
import PaymentRecordsTable from "./_components/PaymentRecordsTable";
import PaymentReport from "./_components/PaymentReport";
import PaymentsViewTabs from "./_components/PaymentsViewTabs";
import UnpaidStudentsTable from "./_components/UnpaidStudentsTable";
import PrintPaymentReportButton from "./_components/PrintPaymentReportButton";
import ReminderHistoryView from "./_components/ReminderHistoryView";
import {
  HISTORY_PAGES,
  isPaymentFilter,
  paymentsHref,
  type HistoryPage,
  type HistoryQuery,
} from "./_components/payments-url";
import { getCurrentUser } from "@/utils/getCurrentUser";
import { TRACKING_START_MONTH } from "@/utils/academy-settings";
import { formatBeltLabel } from "@/utils/belts";
import { createAdminClient } from "@/utils/supabase/admin";
import { dateInTimeZone } from "@/utils/dates";
import type { ReminderSchedule } from "@/utils/reminder-timing";
import { failStuckReminders } from "@/utils/payment-reminders";
import {
  formatMonth,
  isMonthKey,
  loadPaymentMonth,
} from "@/utils/payment-records";
import { loadReminderHistory } from "@/utils/reminder-history";

export const dynamic = "force-dynamic";

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

  // Invalid values fall back to the defaults: this month (Manila), all branches.
  const today = dateInTimeZone();
  const monthParam = param("month");
  const requestedMonth = isMonthKey(monthParam) ? monthParam : today.slice(0, 7);
  const branchParam = param("branch");
  const requestedBranch =
    branchParam && /^\d+$/.test(branchParam) ? branchParam : "all";
  const filterParam = param("filter");
  const filter = isPaymentFilter(filterParam)
    ? filterParam
    : "all";
  // Treat the old reports URL as History too, so existing bookmarks keep working.
  const showHistory = param("view") === "history" || param("view") === "reports";
  const month = showHistory ? requestedMonth : today.slice(0, 7);
  const historyPageParam = param("historyPage");
  const historyPage: HistoryPage = HISTORY_PAGES.includes(historyPageParam as HistoryPage)
    ? historyPageParam as HistoryPage
    : "business";
  const reminderQuery: HistoryQuery = {
    hq: param("hq"),
    hstatus: param("hstatus"),
    htype: param("htype"),
    hbranch: param("hbranch"),
    hpage: Number(param("hpage")) || undefined,
  };

  // Read with the admin client only after the Head Coach check above,
  // so Row Level Security can't hide payment or reminder rows from this page.
  const admin = createAdminClient();

  // There is no daily job any more, so clean up interrupted sends whenever the page loads.
  const stuckError = await failStuckReminders(admin);

  const [monthResult, historyResult, settingsResult] =
    await Promise.all([
    // Both tabs use the same monthly payment data; History also needs the reminder log.
    loadPaymentMonth(admin, month, today),
      showHistory && historyPage === "reminders"
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

  if (showHistory && historyPage === "reminders" && !historyResult?.data) {
    return (
      <DashboardShell title="Payments" currentUser={currentUser}>
        <p role="alert" className="text-sm text-red-600">Could not load reminder history.</p>
      </DashboardShell>
    );
  }

  const branchRows =
    selected.key === "all"
      ? monthData.rows
      : monthData.rows.filter((row) => String(row.branchId) === selected.key);
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
  const notPaid = monthData.notPaid[selected.key] ?? {
    activeCount: 0,
    notPaidCount: 0,
    students: [],
  };
  const sessionPayments = monthData.unpaidPerSession.filter((payment) =>
    selected.key === "all" || String(payment.branchId) === selected.key,
  );
  // Months before the academy started using the system are never shown as unpaid.
  const trackingStarted = !TRACKING_START_MONTH || month >= TRACKING_START_MONTH;
  const missed = monthData.missedMonths[selected.key] ?? [];

  if (showHistory) {
    return (
      <DashboardShell title="Payments" currentUser={currentUser}>
        <PaymentsViewTabs active="history" month={month} branch={selected.key} filter={filter} />
        <HistoryPageTabs active={historyPage} month={month} branch={selected.key} filter={filter} history={reminderQuery} />
        <div className="space-y-6">
          {stuckError && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              Could not check for interrupted reminders: {stuckError}
            </p>
          )}

          {historyPage === "business" && <section aria-labelledby="business-intelligence-title" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="business-intelligence-title" className="text-lg font-semibold tracking-tight text-gray-950">Business intelligence</h2>
                <p className="mt-1 text-sm text-gray-700">Compare collected, expected, unpaid, and overdue payments by branch.</p>
              </div>
              <MonthPicker month={month} branch={selected.key} filter={filter} view="history" historyPage={historyPage} />
            </div>
            <BranchCards
              branches={monthData.branches}
              notPaid={trackingStarted ? monthData.notPaid : {}}
            />
          </section>}

          {historyPage === "payments" && <section aria-labelledby="payment-history-title" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="payment-history-title" className="text-lg font-semibold tracking-tight text-gray-950">Payment history</h2>
                <p className="mt-1 text-sm text-gray-700">Payment records for {formatMonth(month)}{selected.key === "all" ? " across all branches" : ` at ${selected.name}`}.</p>
              </div>
              <MonthPicker month={month} branch={selected.key} filter={filter} view="history" historyPage={historyPage} />
            </div>
            <div className="overflow-hidden border-y border-gray-200 bg-white">
              <PaymentRecordsTable
                rows={branchRows}
                today={today}
                reminderSchedule={reminderSchedule}
                showBranch={selected.key === "all"}
                emptyText="No payment records for this month."
              />
            </div>
          </section>}

          {historyPage === "reminders" && historyResult?.data && <section aria-label="Reminder history">
            <ReminderHistoryView
              history={historyResult.data}
              base={{ month, branch: selected.key, filter, historyPage }}
              showBackLink={false}
            />
          </section>}
        </div>
      </DashboardShell>
    );
  }

  const monthLabel = formatMonth(month);
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PaymentsViewTabs active="payments" month={month} branch={selected.key} filter={filter} className="mb-0" />
          <PrintPaymentReportButton
            documentTitle={`Payment Report - ${monthLabel} - ${selected.name}`}
          />
        </div>
        {stuckError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            Could not check for interrupted reminders: {stuckError}
          </p>
        )}

        <div className="space-y-1">
          <h2 className="text-base font-semibold text-gray-950">
            Not paid yet | {monthLabel}
          </h2>
        </div>

        <section
          id="payments-tab-panel"
          aria-label="Unpaid students"
          className="w-full min-w-0 max-w-full overflow-hidden border-y border-gray-200 bg-white"
        >
          <UnpaidStudentsTable
            key={`${month}:${selected.key}`}
            monthlyStudents={notPaid.students}
            sessionPayments={sessionPayments}
            branches={monthData.branches.map(({ key, name }) => ({ key, name }))}
            selectedBranch={selected.key}
            studentChoices={studentChoices}
            month={month}
            today={today}
            monthlyFee={monthlyFee}
            perSessionFee={perSessionFee}
            reminderSchedule={reminderSchedule}
          />
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
