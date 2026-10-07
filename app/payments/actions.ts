"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/utils/supabase/admin";
import { dateInTimeZone } from "@/utils/dates";
import { getCurrentUser } from "@/utils/getCurrentUser";
import { isPaymentMethod } from "@/utils/payment-methods";
import {
  MAX_MONTHS,
  MAX_SESSIONS,
  findCoverageOverlap,
  isPaymentType,
  overlapMessage,
  type PaymentType,
} from "@/utils/payment-fees";
import {
  loadMonthlyCoverage,
  loadStudentPaymentSummary,
  type StudentPaymentSummary,
} from "@/utils/payment-records";
import {
  REMINDER_TYPES,
  getPaymentReminderPreview,
  getRetryReminderPreview,
  retryFailedReminder,
  sendReminderForPayment,
  type ReminderPreviewResult,
  type ReviewedReminder,
  type SendReminderResult,
} from "@/utils/payment-reminders";

export type ReminderActionResult =
  | { success: true; message: string }
  | { error: string; closed?: boolean };

async function requireHeadCoach(): Promise<
  { error: string } | { userId: number }
> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "Please sign in to manage payments." };
  if (currentUser.role !== "head_coach")
    return { error: "Only the Head Coach can manage payments." };
  return { userId: Number(currentUser.id) };
}

const isValidId = (id: unknown): id is number =>
  typeof id === "number" && Number.isSafeInteger(id) && id > 0;

// Server actions can be called with any value, so check what the popup sent back.
const isReviewed = (value: unknown): value is ReviewedReminder => {
  const reviewed = value as Partial<ReviewedReminder> | null;
  return (
    typeof reviewed?.recipient === "string" &&
    REMINDER_TYPES.some((type) => type === reviewed.reminderType)
  );
};

function toActionResult(result: SendReminderResult): ReminderActionResult {
  if ("error" in result) return result;
  return {
    success: true,
    message: `"${result.reminderType}" reminder sent to ${result.recipient}.`,
  };
}

export async function getReminderPreview(
  paymentId: number,
): Promise<ReminderPreviewResult> {
  const auth = await requireHeadCoach();
  if ("error" in auth) return auth;
  if (!isValidId(paymentId)) return { error: "Payment not found." };

  return getPaymentReminderPreview(paymentId, auth.userId);
}

export async function getRetryPreview(
  reminderId: number,
): Promise<ReminderPreviewResult> {
  const auth = await requireHeadCoach();
  if ("error" in auth) return auth;
  if (!isValidId(reminderId)) return { error: "Reminder not found." };

  const result = await getRetryReminderPreview(reminderId, auth.userId);
  // Loading the preview may close a failed reminder as Skipped, so refresh the list.
  if ("closed" in result && result.closed) revalidatePath("/payments");
  return result;
}

export async function sendPaymentReminder(
  paymentId: number,
  reviewed: ReviewedReminder,
): Promise<ReminderActionResult> {
  const auth = await requireHeadCoach();
  if ("error" in auth) return auth;
  if (!isValidId(paymentId)) return { error: "Payment not found." };
  if (!isReviewed(reviewed))
    return { error: "Review the reminder before sending it." };

  const result = await sendReminderForPayment(paymentId, auth.userId, reviewed);

  // A row may have been written even when an error came back, so always refresh.
  revalidatePath("/payments");
  return toActionResult(result);
}

export async function retryReminder(
  reminderId: number,
  reviewed: ReviewedReminder,
): Promise<ReminderActionResult> {
  const auth = await requireHeadCoach();
  if ("error" in auth) return auth;
  if (!isValidId(reminderId)) return { error: "Reminder not found." };
  if (!isReviewed(reviewed))
    return { error: "Review the reminder before sending it." };

  const result = await retryFailedReminder(reminderId, auth.userId, reviewed);

  revalidatePath("/payments");
  return toActionResult(result);
}

export type PaymentActionResult = { ok: true } | { error: string };

const ALREADY_PAID =
  "This payment is already marked as paid. Refresh the page.";

// Real calendar dates only: rejects 2026-02-30, 2026-13-01, etc.
function isRealDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// Accepts 1500, "1500", "1,500.50" or "₱1500". At most 2 decimals, more than 0, at most 1,000,000.
function parseAmount(value: unknown): { amount: number } | { error: string } {
  const text =
    typeof value === "number"
      ? String(value)
      : typeof value === "string"
        ? value.replace(/[₱,\s]/g, "")
        : "";
  if (!text) return { error: "Enter an amount." };
  if (text.startsWith("-")) return { error: "Enter an amount greater than ₱0." };
  if (!/^\d+(\.\d+)?$/.test(text))
    return { error: "Enter the amount as a number, like 1500 or 1500.50." };
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    return { error: "The amount can have at most 2 decimal places." };
  const amount = Number(text);
  if (!(amount > 0)) return { error: "Enter an amount greater than ₱0." };
  if (amount > 1_000_000)
    return { error: "The amount can be at most ₱1,000,000." };
  return { amount };
}

const inYearRange = (date: string) => {
  const year = Number(date.slice(0, 4));
  return year >= 2020 && year <= 2100;
};

// Trimmed; empty → null. Counted like Postgres char_length, so an emoji is one character.
function parseNotes(value: unknown): { notes: string | null } | { error: string } {
  if (value == null) return { notes: null };
  if (typeof value !== "string") return { error: "Notes are invalid." };
  const notes = value.trim();
  if (!notes) return { notes: null };
  if ([...notes].length > 500)
    return { error: "Notes can be at most 500 characters." };
  return { notes };
}

export type NewPaymentInput = {
  studentId: number;
  paymentType: PaymentType;
  /** Months (Monthly) or sessions (Per session). */
  quantity: number;
  /** Monthly only: 'YYYY-MM-01'. */
  coverageStart?: string | null;
  amount: string | number;
  paidNow: boolean;
  paidDate?: string | null;
  method?: string | null;
  /** Only used when paidNow is false. */
  dueDate?: string | null;
  notes?: string | null;
  /** true = the Head Coach saw the overlap warning and still wants to add it. */
  confirmOverlap?: boolean;
};

/** createPayment can also stop with a warning that the Head Coach must confirm. */
export type CreatePaymentResult =
  | { ok: true; paymentId: number }
  | { error: string }
  | { warning: string; needsConfirm: true };

export async function createPayment(
  input: NewPaymentInput,
): Promise<CreatePaymentResult> {
  const auth = await requireHeadCoach();
  if ("error" in auth) return auth;
  if (!input || typeof input !== "object")
    return { error: "Payment details are invalid." };

  const {
    studentId,
    paymentType,
    quantity,
    coverageStart,
    paidNow,
    paidDate,
    method,
    dueDate,
  } = input;

  if (!isValidId(studentId)) return { error: "Choose a student." };
  if (!isPaymentType(paymentType))
    return { error: "Choose Monthly or Per session." };
  const isMonthly = paymentType === "Monthly";

  const maxQuantity = isMonthly ? MAX_MONTHS : MAX_SESSIONS;
  if (
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > maxQuantity
  ) {
    return {
      error: isMonthly
        ? `Enter a whole number of months from 1 to ${MAX_MONTHS}.`
        : `Enter a whole number of sessions from 1 to ${MAX_SESSIONS}.`,
    };
  }

  let coverage: string | null = null;
  if (isMonthly) {
    if (!isRealDate(coverageStart) || !coverageStart.endsWith("-01"))
      return { error: "Choose the first month this payment covers." };
    if (!inYearRange(coverageStart))
      return { error: "The start month must be between 2020 and 2100." };
    coverage = coverageStart;
  } else if (coverageStart != null && coverageStart !== "") {
    return { error: "Per session payments don't have a start month." };
  }

  const parsed = parseAmount(input.amount);
  if ("error" in parsed) return parsed;
  const parsedNotes = parseNotes(input.notes);
  if ("error" in parsedNotes) return parsedNotes;
  if (typeof paidNow !== "boolean")
    return { error: "Choose whether this payment is paid now." };

  let record: {
    status: "Paid" | "Unpaid";
    due_date: string;
    paid_date: string | null;
    method: string | null;
  };
  if (paidNow) {
    if (!isRealDate(paidDate)) return { error: "Enter a real paid date." };
    if (paidDate < "2020-01-01")
      return { error: "The paid date must be in 2020 or later." };
    if (paidDate > dateInTimeZone())
      return { error: "The paid date can't be after today." };
    if (!isPaymentMethod(method))
      return { error: "Choose how the payment was made." };
    // Monthly: due on the first covered month. Per session: due on the day it was paid.
    record = {
      status: "Paid",
      due_date: coverage ?? paidDate,
      paid_date: paidDate,
      method,
    };
  } else {
    if (!isRealDate(dueDate)) return { error: "Enter a real due date." };
    if (!inYearRange(dueDate))
      return { error: "The due date must be between 2020 and 2100." };
    record = { status: "Unpaid", due_date: dueDate, paid_date: null, method: null };
  }

  // Admin client only after the Head Coach check above.
  const admin = createAdminClient();

  const { data: student, error: studentError } = await admin
    .from("student")
    .select("id, is_active, first_name, middle_name, last_name")
    .eq("id", studentId)
    .maybeSingle();
  if (studentError) return { error: studentError.message };
  if (!student) return { error: "Student not found." };
  if (!student.is_active) return { error: "This student is inactive." };

  // Only two Unpaid payments on the same due date are duplicates.
  // Paid records are never blocked: a partial payment is its own record.
  if (record.status === "Unpaid") {
    const { data: existing, error: existingError } = await admin
      .from("payment")
      .select("id")
      .eq("student_id", studentId)
      .eq("due_date", record.due_date)
      .eq("status", "Unpaid")
      .limit(1);
    if (existingError) return { error: existingError.message };
    if (existing?.length)
      return {
        error: `This student already has an unpaid payment due on ${formatDate(record.due_date)}.`,
      };
  }

  // Overlap with existing Monthly coverage is a warning, not a block: once the Head Coach
  // confirms it, the coverage isn't loaded again.
  if (input.confirmOverlap !== true) {
    const existing = await loadMonthlyCoverage(admin, studentId);
    if (existing.error !== null) return { error: existing.error };
    // Per session: record.due_date is the paid date (Paid now) or the due date (not paid yet).
    const overlap = findCoverageOverlap(
      existing.data,
      isMonthly && coverage
        ? { kind: "Monthly", coverageStart: coverage, quantity }
        : { kind: "Per session", date: record.due_date },
    );
    if (overlap) {
      const studentName = [student.first_name, student.middle_name, student.last_name]
        .filter(Boolean)
        .join(" ");
      return {
        warning: overlapMessage(overlap, paymentType, studentName),
        needsConfirm: true,
      };
    }
  }

  // No id: the database creates it. The four detail columns go in together,
  // because the database only accepts all of them or none of them.
  const { data: created, error } = await admin
    .from("payment")
    .insert({
      student_id: studentId,
      amount: parsed.amount,
      ...record,
      payment_type: paymentType,
      quantity,
      coverage_start: coverage,
      notes: parsedNotes.notes,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/payments");
  return { ok: true, paymentId: Number(created.id) };
}

export async function getStudentPaymentSummary(
  studentId: number,
): Promise<{ summary: StudentPaymentSummary } | { error: string }> {
  const auth = await requireHeadCoach();
  if ("error" in auth) return auth;
  if (!isValidId(studentId)) return { error: "Student not found." };

  const result = await loadStudentPaymentSummary(createAdminClient(), studentId);
  if (result.error !== null) return { error: result.error };
  return { summary: result.data };
}

/** Marks an Unpaid payment as Paid. Never touches payment_reminder and never sends email. */
export async function markPaymentPaid(input: {
  paymentId: number;
  paidDate: string;
  method: string;
}): Promise<PaymentActionResult> {
  const auth = await requireHeadCoach();
  if ("error" in auth) return auth;
  if (!input || typeof input !== "object")
    return { error: "Payment details are invalid." };

  const { paymentId, paidDate, method } = input;
  if (!isValidId(paymentId)) return { error: "Payment not found." };
  if (!isRealDate(paidDate)) return { error: "Enter a real paid date." };
  if (paidDate < "2020-01-01")
    return { error: "The paid date must be in 2020 or later." };
  if (paidDate > dateInTimeZone())
    return { error: "The paid date can't be after today." };
  if (!isPaymentMethod(method))
    return { error: "Choose how the payment was made." };

  const admin = createAdminClient();

  // .eq("status", "Unpaid") in the same update, so two clicks can't both succeed.
  const { data, error } = await admin
    .from("payment")
    .update({ status: "Paid", paid_date: paidDate, method })
    .eq("id", paymentId)
    .eq("status", "Unpaid")
    .select("id");
  if (error) return { error: error.message };

  if (!data?.length) {
    // Nothing changed: the payment is already Paid, or it no longer exists.
    const { data: payment } = await admin
      .from("payment")
      .select("id")
      .eq("id", paymentId)
      .maybeSingle();
    return { error: payment ? ALREADY_PAID : "Payment not found." };
  }

  revalidatePath("/payments");
  return { ok: true };
=======
import { getCurrentUser } from "@/utils/getCurrentUser";
import { retryPaymentReminder } from "@/utils/payment-reminders";

const RETRY_MESSAGES = {
  Sent: "Reminder sent.",
  Failed: "Sending failed again. Check the error and try later.",
  Skipped: "Not sent: the payment is already paid or the student is inactive.",
  Scheduled: "The reminder is still sending. Refresh the page in a minute.",
} as const;

export async function retryReminder(reminderId: number) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "Please sign in to retry reminders." };
  if (currentUser.role !== "head_coach")
    return { error: "Only the Head Coach can retry reminders." };

  if (!Number.isSafeInteger(reminderId) || reminderId <= 0)
    return { error: "Reminder not found." };

  const result = await retryPaymentReminder(reminderId, Number(currentUser.id));

  // The row may have changed even when an error came back, so always refresh.
  revalidatePath("/payments");

  if ("error" in result) return { error: result.error };
  return {
    success: true,
    status: result.status,
    message: RETRY_MESSAGES[result.status],
  };

}
