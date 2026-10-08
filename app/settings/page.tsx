import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { createAdminClient } from '@/utils/supabase/admin'
import { DEFAULT_REMINDER_SCHEDULE } from '@/utils/reminder-timing'
import MonthlyFeeSettingsButton from '@/app/payments/_components/MonthlyFeeSettingsButton'
import PasswordChangeForm from './_components/PasswordChangeForm'
import ProfileSettingsForm from './_components/ProfileSettingsForm'
import ReminderScheduleSettings from './_components/ReminderScheduleSettings'

export const dynamic = 'force-dynamic'

const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)

export default async function SettingsPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  let settings: {
    monthlyFee: number | null
    beforeDueDays: number
    afterDueDays: number
  } | null = null
  let settingsError = ''

  if (currentUser.role === 'head_coach') {
    const admin = createAdminClient()
    const { data, error } = await admin.from('payment_settings')
      .select('monthly_fee, reminder_before_due_days, reminder_after_due_days')
      .eq('singleton', true)
      .maybeSingle()
    if (error) settingsError = error.message
    else {
      settings = {
        monthlyFee: data?.monthly_fee == null ? null : Number(data.monthly_fee),
        beforeDueDays: Number(data?.reminder_before_due_days ?? DEFAULT_REMINDER_SCHEDULE.beforeDueDays),
        afterDueDays: Number(data?.reminder_after_due_days ?? DEFAULT_REMINDER_SCHEDULE.afterDueDays),
      }
    }
  }

  return (
    <DashboardShell title="Settings" currentUser={currentUser}>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header>
          <h2 className="text-xl font-semibold tracking-tight text-gray-950">Settings</h2>
          <p className="mt-1 text-sm text-gray-700">
            {currentUser.role === 'head_coach'
              ? 'Manage your account and academy-wide payment preferences.'
              : 'Manage your own account details and password.'}
          </p>
        </header>

        {currentUser.role === 'head_coach' && (
          <>
            {settingsError ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Could not load academy settings: {settingsError}. Apply the shared payment settings migration first.
              </p>
            ) : settings && (
              <div className="grid gap-5 lg:grid-cols-2">
                <section id="payment-billing" aria-labelledby="monthly-fee-title" className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 id="monthly-fee-title" className="text-base font-semibold text-gray-950">Monthly fee</h3>
                      <p className="mt-1 text-[13px] text-gray-700">One academy rate is used for every student.</p>
                    </div>
                    <MonthlyFeeSettingsButton monthlyFee={settings.monthlyFee} />
                  </div>
                  <div className="rounded-lg bg-gray-50 px-4 py-3">
                    <p className="text-xs font-medium text-gray-700">Current rate</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-950">
                      {settings.monthlyFee === null ? 'Not set' : money(settings.monthlyFee)}
                    </p>
                  </div>
                </section>

                <section id="reminder-schedule" aria-labelledby="reminder-schedule-title" className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="mb-4">
                    <h3 id="reminder-schedule-title" className="text-base font-semibold text-gray-950">Payment reminder schedule</h3>
                    <p className="mt-1 text-[13px] text-gray-700">Set when the before-due and after-due reminders become available.</p>
                  </div>
                  <ReminderScheduleSettings beforeDueDays={settings.beforeDueDays} afterDueDays={settings.afterDueDays} />
                </section>
              </div>
            )}
          </>
        )}

        <section aria-labelledby="personal-account-title" className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4">
            <h3 id="personal-account-title" className="text-base font-semibold text-gray-950">Personal account details</h3>
            <p className="mt-1 text-[13px] text-gray-700">Manage your own name and phone number.</p>
          </div>
          <ProfileSettingsForm
            firstName={currentUser.first_name ?? ''}
            middleName={currentUser.middle_name ?? ''}
            lastName={currentUser.last_name ?? ''}
            contact={currentUser.contact ?? ''}
          />
        </section>

        <section aria-labelledby="account-security-title" className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4">
            <h3 id="account-security-title" className="text-base font-semibold text-gray-950">Account security</h3>
            <p className="mt-1 text-[13px] text-gray-700">Change the password for your own account.</p>
          </div>
          <PasswordChangeForm />
        </section>
      </div>
    </DashboardShell>
  )
}
