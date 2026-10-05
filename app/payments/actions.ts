"use server";

import { revalidatePath } from "next/cache";
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
