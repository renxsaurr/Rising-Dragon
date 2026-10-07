"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { getCurrentUser } from "@/utils/getCurrentUser";
import { dateInTimeZone } from "@/utils/dates";
import { BELT_LABELS } from "@/utils/belts";

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function promoteStudent(
  studentId: number,
  newBelt: string,
  promotionDate: string,
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "Please sign in to promote students." };
  if (currentUser.role !== "head_coach")
    return { error: "Only the Head Coach can promote students." };

  if (!Number.isSafeInteger(studentId) || studentId <= 0)
    return { error: "Student record not found." };
  if (!Object.hasOwn(BELT_LABELS, newBelt))
    return { error: "Select a valid belt." };
  if (!isValidDate(promotionDate))
    return { error: "Select the promotion date." };
  if (promotionDate > dateInTimeZone())
    return { error: "Promotion date cannot be in the future." };

  const admin = createAdminClient();

  const { data: student, error: studentError } = await admin
    .from("student")
    .select("id, belt_level, is_active")
    .eq("id", studentId)
    .maybeSingle();
  if (studentError || !student) return { error: "Student record not found." };
  if (!student.is_active)
    return { error: "Only active students can be promoted." };

  const beltOrder = Object.keys(BELT_LABELS);
  const currentIndex = beltOrder.indexOf(student.belt_level);
  if (currentIndex < 0 || beltOrder[currentIndex + 1] !== newBelt) {
    return {
      error:
        "The new belt must be the next belt after the current one. Refresh the page and try again.",
    };
  }

  const { error } = await admin.rpc("record_student_promotion", {
    p_student_id: studentId,
    p_new_belt: newBelt,
    p_promotion_date: promotionDate,
    p_coach_id: currentUser.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/promotions");
  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/branches");
  revalidatePath("/branches/[id]", "page");
  return { success: true };
}
