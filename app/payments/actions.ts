"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/utils/getCurrentUser";
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
  if (!currentUser) return { error: "Please sign in to send reminders." };
  if (currentUser.role !== "head_coach")
    return { error: "Only the Head Coach can send reminders." };
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

  return getPaymentReminderPreview(paymentId);
}

export async function getRetryPreview(
  reminderId: number,
): Promise<ReminderPreviewResult> {
  const auth = await requireHeadCoach();
  if ("error" in auth) return auth;
  if (!isValidId(reminderId)) return { error: "Reminder not found." };

  const result = await getRetryReminderPreview(reminderId);
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
