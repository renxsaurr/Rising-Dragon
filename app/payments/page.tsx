import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import RetryReminderButton from "@/components/RetryReminderButton";
import { getCurrentUser } from "@/utils/getCurrentUser";
import { createAdminClient } from "@/utils/supabase/admin";
import { addDays, dateInTimeZone } from "@/utils/dates";
import {
  REMINDER_WINDOWS,
  formatAmount,
  type ReminderType,
} from "@/utils/payment-reminders";

export const dynamic = "force-dynamic";

type StudentName = {
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

type PaymentStudent = StudentName & {
  guardian_email: string | null;
  is_active: boolean;
};

type PaymentRow = {
  id: number;
  amount: number | string;
  due_date: string;
  student: PaymentStudent | PaymentStudent[] | null;
};

type PaymentReminderSummary = {
  payment_id: number;
  reminder_type: ReminderType;
  status: string;
  sent_at: string | null;
};

type HistoryRow = {
  id: number;
  reminder_type: ReminderType;
  status: string;
  scheduled_for: string;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
  recipient_email: string;
  attempt_count: number;
  error_message: string | null;
  payment:
    | { student: StudentName | StudentName[] | null }
    | { student: StudentName | StudentName[] | null }[]
    | null;
};

type ListRow = {
  id: number;
  studentName: string;
  isActive: boolean;
  hasEmail: boolean;
  amount: string;
  amountValue: number;
  dueDate: string;
  daysOverdue: number;
  reminders: PaymentReminderSummary[];
};

const TH =
  "px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500";

const STATUS_STYLES: Record<string, string> = {
  Sent: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Failed: "bg-red-50 text-red-700 ring-red-600/20",
  Skipped: "bg-gray-100 text-gray-600 ring-gray-500/20",
  Scheduled: "bg-blue-50 text-blue-700 ring-blue-600/20",
};

const TABS = [
  { key: "overdue", label: "Overdue" },
  { key: "due-soon", label: "Due soon" },
  { key: "history", label: "Reminder history" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const isTabKey = (value: unknown): value is TabKey =>
  TABS.some((tab) => tab.key === value);

// A light tint of the sidebar's active red (bg-red-600).
const ROW_HOVER = "transition-colors duration-200 hover:bg-red-600/5";

const one = <T,>(value: T | T[] | null | undefined) =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const fullName = (student: StudentName | null) =>
  student
    ? [student.first_name, student.middle_name, student.last_name]
        .filter(Boolean)
        .join(" ")
    : "Unknown student";

const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatShortDate = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  });

const formatTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const typeOrder = (type: ReminderType) =>
  REMINDER_WINDOWS.findIndex((window) => window.type === type);

/** The next reminder the daily job will send, using the same windows as the job. */
function nextReminder(
  dueDate: string,
  reminders: PaymentReminderSummary[],
  today: string,
) {
  const daysAfterDue = daysBetween(dueDate, today);
  const createdTypes = new Set(reminders.map((reminder) => reminder.reminder_type));
  const window = REMINDER_WINDOWS.find(
    (window) => !createdTypes.has(window.type) && daysAfterDue <= window.lastDay,
  );
  if (!window) return null;
  const date = addDays(dueDate, window.dueOffset);
  return { type: window.type, date: date < today ? today : date };
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status] ?? STATUS_STYLES.Skipped}`}
    >
      {status}
    </span>
  );
}

function ReminderStatus({ row, today }: { row: ListRow; today: string }) {
  const latest = [...row.reminders].sort(
    (a, b) => typeOrder(b.reminder_type) - typeOrder(a.reminder_type),
  )[0];
  const next =
    row.hasEmail && row.isActive
      ? nextReminder(row.dueDate, row.reminders, today)
      : null;

  return (
    <div className="flex flex-col items-start gap-1">
      {latest && (
        <span className="inline-flex flex-wrap items-center gap-1.5 text-[13px] text-gray-700">
          {latest.reminder_type}
          <StatusBadge status={latest.status} />
          {latest.sent_at && (
            <span className="text-gray-500">{formatShortDate(latest.sent_at)}</span>
          )}
        </span>
      )}
      {!row.hasEmail ? (
        <span className="inline-flex whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
          No guardian email
        </span>
      ) : next ? (
        <span className="text-xs text-gray-500">
          Next: {next.type} on {formatDate(next.date)}
        </span>
      ) : !latest ? (
        <span className="text-xs text-gray-500">No reminders</span>
      ) : null}
    </div>
  );
}

function PaymentTable({
  rows,
  today,
  showDaysOverdue,
  emptyTitle,
  emptyText,
}: {
  rows: ListRow[];
  today: string;
  showDaysOverdue: boolean;
  emptyTitle: string;
  emptyText: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {rows.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-sm font-medium text-gray-700">{emptyTitle}</p>
          <p className="mt-1 text-[13px] text-gray-500">{emptyText}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead className="border-b border-gray-200 bg-gray-50/70">
              <tr>
                <th className={`${TH} pl-5`}>Student</th>
                <th className={TH}>Amount</th>
                <th className={TH}>Due date</th>
                {showDaysOverdue && <th className={TH}>Days overdue</th>}
                <th className={`${TH} pr-5`}>Reminder status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className={ROW_HOVER}>
                  <td className="px-5 py-4 text-sm font-medium text-gray-950">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {row.studentName}
                      {!row.isActive && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                          Inactive
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-950">
                    {row.amount}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                    {formatDate(row.dueDate)}
                  </td>
                  {showDaysOverdue && (
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-red-600">
                      {row.daysOverdue} day{row.daysOverdue === 1 ? "" : "s"}
                    </td>
                  )}
                  <td className="px-3 py-4 pr-5">
                    <ReminderStatus row={row} today={today} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentTabs({
  activeTab,
  counts,
}: {
  activeTab: TabKey;
  counts: Record<TabKey, number>;
}) {
  return (
    <nav
      aria-label="Payment lists"
      className="mb-3 flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1"
    >
      {TABS.map((tab) => {
        const active = tab.key === activeTab;
        const count = counts[tab.key];
        const isAlert = tab.key === "overdue" && count > 0;
        const badgeStyle = active
          ? isAlert
            ? "bg-white text-red-600"
            : "bg-white/20 text-white"
          : isAlert
            ? "bg-red-600 text-white"
            : "bg-gray-100 text-gray-600";
        return (
          <Link
            key={tab.key}
            href={`/payments?tab=${tab.key}`}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors ${
              active
                ? "bg-red-600 text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeStyle}`}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function HistoryTable({
  history,
  error,
}: {
  history: HistoryRow[];
  error: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {error ? (
        <p role="alert" className="px-5 py-6 text-sm text-red-600">
          Could not load reminder history: {error}
        </p>
      ) : history.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-sm font-medium text-gray-700">No reminders yet</p>
          <p className="mt-1 text-[13px] text-gray-500">
            Reminder emails will appear here after the daily job runs.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead className="border-b border-gray-200 bg-gray-50/70">
              <tr>
                <th className={`${TH} pl-5`}>Sent / finished</th>
                <th className={TH}>Scheduled for</th>
                <th className={TH}>Student</th>
                <th className={TH}>Type</th>
                <th className={TH}>Sent to</th>
                <th className={TH}>Status</th>
                <th className={TH}>Attempts</th>
                <th className={`${TH} pr-5 text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((reminder) => (
                <tr key={reminder.id} className={`align-top ${ROW_HOVER}`}>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-700">
                    {formatTimestamp(
                      reminder.sent_at ??
                        reminder.completed_at ??
                        reminder.created_at,
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                    {formatDate(reminder.scheduled_for)}
                  </td>
                  <td className="px-3 py-4 text-sm font-medium text-gray-950">
                    {fullName(one(one(reminder.payment)?.student))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                    {reminder.reminder_type}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-700">
                    {reminder.recipient_email}
                  </td>
                  <td className="px-3 py-4">
                    <StatusBadge status={reminder.status} />
                    {reminder.error_message && (
                      <p
                        className={`mt-1 max-w-xs text-xs ${reminder.status === "Failed" ? "text-red-600" : "text-gray-500"}`}
                      >
                        {reminder.error_message}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-700">
                    {reminder.attempt_count}
                  </td>
                  <td className="px-4 py-3 pr-5">
                    <div className="flex justify-end">
                      <RetryReminderButton
                        reminderId={Number(reminder.id)}
                        status={reminder.status}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "head_coach") redirect("/students");

  const { tab } = await searchParams;
  const activeTab: TabKey = isTabKey(tab) ? tab : "overdue";

  // Read with the admin client only after the Head Coach check above,
  // so Row Level Security can't hide reminder rows from this page.
  const admin = createAdminClient();
  const today = dateInTimeZone();
  const dueSoonEnd = addDays(today, 7);

  const historySelect =
    "id, reminder_type, status, scheduled_for, sent_at, completed_at, created_at, recipient_email, attempt_count, error_message, payment:payment(student:student(first_name, middle_name, last_name))";

  const [paymentResult, historyResult, failedResult] = await Promise.all([
    admin
      .from("payment")
      .select(
        "id, amount, due_date, student:student(first_name, middle_name, last_name, guardian_email, is_active)",
      )
      .eq("status", "Unpaid")
      .lte("due_date", dueSoonEnd)
      .order("due_date")
      .order("id"),
    admin
      .from("payment_reminder")
      .select(historySelect)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50),
    // Every Failed reminder, even older than the latest 50, so it can always be retried.
    admin
      .from("payment_reminder")
      .select(historySelect)
      .eq("status", "Failed"),
  ]);

  const payments = (paymentResult.data ?? []) as unknown as PaymentRow[];
  const paymentIds = payments.map((payment) => Number(payment.id));
  const reminderResult = paymentIds.length
    ? await admin
        .from("payment_reminder")
        .select("payment_id, reminder_type, status, sent_at")
        .in("payment_id", paymentIds)
    : { data: [], error: null };

  const loadError =
    paymentResult.error?.message ??
    reminderResult.error?.message ??
    failedResult.error?.message;
  if (loadError) {
    return (
      <DashboardShell title="Payments" currentUser={currentUser}>
        <p role="alert" className="text-sm text-red-600">
          Could not load payments: {loadError}
        </p>
      </DashboardShell>
    );
  }

  const remindersByPayment = new Map<number, PaymentReminderSummary[]>();
  for (const reminder of (reminderResult.data ?? []) as PaymentReminderSummary[]) {
    const paymentId = Number(reminder.payment_id);
    remindersByPayment.set(paymentId, [
      ...(remindersByPayment.get(paymentId) ?? []),
      reminder,
    ]);
  }

  const rows: ListRow[] = payments.map((payment) => {
    const student = one(payment.student);
    return {
      id: Number(payment.id),
      studentName: fullName(student),
      isActive: student?.is_active ?? false,
      hasEmail: Boolean(student?.guardian_email?.trim()),
      amount: formatAmount(payment.amount),
      amountValue: Number(payment.amount),
      dueDate: payment.due_date,
      daysOverdue: daysBetween(payment.due_date, today),
      reminders: remindersByPayment.get(Number(payment.id)) ?? [],
    };
  });
  const overdue = rows.filter((row) => row.dueDate < today);
  const dueSoon = rows.filter((row) => row.dueDate >= today);
  const failedRows = (failedResult.data ?? []) as unknown as HistoryRow[];
  const failedCount = failedRows.length;
  const sumAmounts = (list: ListRow[]) =>
    formatAmount(list.reduce((total, row) => total + row.amountValue, 0));

  // Latest 50 plus every Failed row, without duplicates, newest first.
  const historyById = new Map<number, HistoryRow>();
  for (const reminder of [
    ...((historyResult.data ?? []) as unknown as HistoryRow[]),
    ...failedRows,
  ]) {
    historyById.set(Number(reminder.id), reminder);
  }
  const history = [...historyById.values()].sort(
    (a, b) =>
      Date.parse(b.created_at) - Date.parse(a.created_at) ||
      Number(b.id) - Number(a.id),
  );

  const tabDescriptions: Record<TabKey, string> = {
    overdue: `${overdue.length} unpaid payment${overdue.length === 1 ? "" : "s"} past the due date.`,
    "due-soon": `Unpaid payments due from today to ${formatDate(dueSoonEnd)}.`,
    history:
      "The latest 50 reminder emails, plus every failed one. Failed ones can be sent again with Retry.",
  };

  return (
    <DashboardShell title="Payments" currentUser={currentUser}>
      <p className="mb-4 text-[13px] text-gray-500">
        Reminder emails go out automatically around 8 AM: 3 days before, on the
        due date, and 3 days after if still unpaid. Paid payments are never
        emailed.
      </p>

      {failedCount > 0 && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
          {failedCount} reminder{failedCount === 1 ? "" : "s"} failed.{" "}
          <Link
            href="/payments?tab=history"
            scroll={false}
            className="font-semibold underline underline-offset-2 hover:text-red-800"
          >
            Review
          </Link>
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-gray-200 bg-white px-5 py-3.5 text-[13px] text-gray-500">
        <p>
          <span
            className={`font-semibold ${overdue.length ? "text-red-600" : "text-gray-900"}`}
          >
            {overdue.length} overdue
          </span>
          {" · "}
          <span className="font-medium text-gray-900">{sumAmounts(overdue)}</span>
        </p>
        <p>
          <span className="font-semibold text-gray-900">
            {dueSoon.length} due soon
          </span>
          {" · "}
          <span className="font-medium text-gray-900">{sumAmounts(dueSoon)}</span>
        </p>
      </div>

      <PaymentTabs
        activeTab={activeTab}
        counts={{
          overdue: overdue.length,
          "due-soon": dueSoon.length,
          history: history.length,
        }}
      />
      <p className="mb-4 text-[13px] text-gray-500">
        {tabDescriptions[activeTab]}
      </p>

      {activeTab === "overdue" && (
        <PaymentTable
          rows={overdue}
          today={today}
          showDaysOverdue
          emptyTitle="No overdue payments"
          emptyText="Unpaid payments past their due date will appear here."
        />
      )}
      {activeTab === "due-soon" && (
        <PaymentTable
          rows={dueSoon}
          today={today}
          showDaysOverdue={false}
          emptyTitle="Nothing due in the next 7 days"
          emptyText="Unpaid payments due this week will appear here."
        />
      )}
      {activeTab === "history" && (
        <HistoryTable
          history={history}
          error={historyResult.error?.message ?? null}
        />
      )}
    </DashboardShell>
  );
}
