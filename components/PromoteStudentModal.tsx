"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { BELT_COLORS, BELT_LABELS, formatBeltLabel } from "@/utils/belts";
import { useRouter } from "next/navigation";
import { promoteStudent } from "@/app/promotions/actions";

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatShort(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year}`;
}

export default function PromoteStudentModal({
  studentId,
  studentName,
  currentBelt,
  trigger,
}: {
  studentId: number;
  studentName: string;
  currentBelt: string;
  trigger?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [promotionDate, setPromotionDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const today = todayISO();
  const beltOrder = Object.keys(BELT_LABELS);
  const currentIndex = beltOrder.indexOf(currentBelt);
  const nextBelt =
    currentIndex >= 0 ? (beltOrder[currentIndex + 1] ?? null) : null;
  const pill =
    "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";

  const openModal = () => {
    setPromotionDate(todayISO());
    setError("");
    setIsConfirming(false);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setIsConfirming(false);
    setError("");
  };

  const handleReview = (event: React.FormEvent) => {
    event.preventDefault();
    if (!nextBelt) {
      setError("This student is already at the highest belt.");
      return;
    }
    if (!promotionDate) {
      setError("Select the promotion date.");
      return;
    }
    if (promotionDate > today) {
      setError(`Promotion date must be ${formatShort(today)} or earlier.`);
      return;
    }
    setError("");
    setIsConfirming(true);
  };

  const handleConfirm = async () => {
    if (!nextBelt) return;
    setSaving(true);
    setError("");
    try {
      const result = await promoteStudent(studentId, nextBelt, promotionDate);
      if (result.error) {
        setError(result.error);
        return;
      }
      closeModal();
      router.refresh();
    } catch {
      setError("Could not save the promotion. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const dateError = error.includes("date") ? error : "";
  const formattedDate = promotionDate
    ? new Date(`${promotionDate}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <>
      {trigger ? <div onClick={openModal}>{trigger}</div> : <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition-colors hover:bg-gray-50"
      >
        Promote
      </button>}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              className="absolute right-5 top-5 text-xl leading-none text-gray-400 hover:text-black"
            >
              ×
            </button>

            {!isConfirming ? (
              <>
                <h2 className="text-lg font-semibold text-gray-950">
                  Promote student
                </h2>
                <p className="mb-5 mt-1 text-sm text-gray-500">{studentName}</p>

                <form onSubmit={handleReview} noValidate className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-700">
                      Current belt
                    </p>
                    <span
                      className={`${pill} mt-1.5 ${BELT_COLORS[currentBelt] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {formatBeltLabel(currentBelt)}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-700">
                      Next belt
                    </p>
                    {nextBelt ? (
                      <span
                        className={`${pill} mt-1.5 ${BELT_COLORS[nextBelt] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {formatBeltLabel(nextBelt)}
                      </span>
                    ) : (
                      <p className="mt-1.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                        This student is already at the highest belt.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700">
                      Promotion date
                      <input
                        type="date"
                        value={promotionDate}
                        max={today}
                        onChange={(event) => {
                          setPromotionDate(event.target.value);
                          setError("");
                        }}
                        aria-invalid={dateError ? true : undefined}
                        className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-[13px] text-gray-900 outline-none focus:ring-2 ${dateError ? "border-red-400 focus:border-red-500 focus:ring-red-500/10" : "border-gray-200 focus:border-red-500 focus:ring-red-500/10"}`}
                      />
                    </label>
                    {dateError && (
                      <p role="alert" className="mt-1.5 text-xs text-red-600">
                        {dateError}
                      </p>
                    )}
                  </div>

                  {error && !dateError && (
                    <p
                      role="alert"
                      className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                    >
                      {error}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!nextBelt}
                      className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Review promotion
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-950">
                  Confirm promotion?
                </h2>
                <p className="mb-5 mt-1 text-sm text-gray-600">
                  Please check the details before saving.
                </p>

                <dl className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-xs font-medium text-gray-500">
                      Student
                    </dt>
                    <dd className="text-sm font-medium text-gray-950">
                      {studentName}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-xs font-medium text-gray-500">
                      Old belt
                    </dt>
                    <dd>
                      <span
                        className={`${pill} ${BELT_COLORS[currentBelt] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {formatBeltLabel(currentBelt)}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-xs font-medium text-gray-500">
                      New belt
                    </dt>
                    <dd>
                      <span
                        className={`${pill} ${BELT_COLORS[nextBelt ?? ""] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {formatBeltLabel(nextBelt ?? "")}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-xs font-medium text-gray-500">
                      Promotion date
                    </dt>
                    <dd className="text-sm font-medium text-gray-950">
                      {formattedDate}
                    </dd>
                  </div>
                </dl>

                {error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}
                <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsConfirming(false)}
                    disabled={saving}
                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={saving}
                    className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Confirm promotion"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
