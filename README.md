This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Rising Dragon setup

Add these values to the local `.env.local` file. Keep the service role key on the server and do not prefix it with `NEXT_PUBLIC_`.

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The first Head Coach profile must be bootstrapped once because the Users page is restricted to Head Coaches:

1. Create the first login in Supabase Authentication and copy its user UUID.
2. Add the matching profile in the SQL editor, replacing the sample values:

```sql
insert into public."user" (name, contact, role, home_branch_id, auth_id)
values ('Head Coach', null, 'head_coach', null, 'AUTH-USER-UUID');
```

After that, Head Coaches can create Assistant Coach and additional Head Coach logins from **Users & roles**. New accounts get an initial password from the Head Coach.

Apply `supabase/migrations/20260924_attendance_student_schedule_unique.sql` to the Supabase database before using Attendance. It adds the one-attendance-per-student-per-session constraint used when saving marks.

Apply `supabase/migrations/20261004_weekly_schedule_session_unique.sql` to Supabase before relying on automatic recurring-session generation. It prevents duplicate dated sessions if a page refresh and scheduled sync happen at the same time, and records which cancellations were caused automatically so a restored availability window can restore the future session. The migration stops with an error if duplicate sessions already exist so they can be reviewed before the constraint is added.

Recurring classes create and reconcile dated sessions for the next four weeks when the Head Coach updates the master schedule or coach availability, and through a daily Vercel Cron job. Add a strong `CRON_SECRET` environment variable to the Vercel project before deploying; the scheduled job runs daily at midnight Asia/Manila (16:00 UTC). Vercel Cron runs on production deployments and uses UTC schedules.

### Payment reminder email setup

Payment reminders are sent manually by the Head Coach after reviewing the recipient and message preview. The app sends them through Gmail SMTP; it does not send payment reminders on a schedule.

1. Create or choose the academy Gmail account and enable Google 2-Step Verification.
2. Create a Google App Password for this app. Do not put the normal Gmail password in the project.
3. Copy `.env.example` to `.env.local` and fill in `GMAIL_USER` and `GMAIL_APP_PASSWORD`. Optionally set `REMINDER_FROM_NAME` and `REMINDER_REPLY_TO`.
4. Add the same server-only variables to the deployment environment (for example, Vercel Project Settings → Environment Variables). Never prefix them with `NEXT_PUBLIC_` or commit the values.
5. Apply `20261005_payment_reminder_automation.sql`, `20261007_payment_record_details.sql`, and `20261008150000_payment_method_categories.sql` from `supabase/migrations/` before using reminder history and the standardized payment methods.

The Head Coach can send at most one reminder of each type per payment: before the due date, on the due date, and after the due date. A guardian email must be saved on the student record. Sending a reminder never changes the payment status.

The provided schema extract does not show the custom enum declarations. Confirm that its role values include `head_coach` and `assistant_coach`, schedule values include `Scheduled`, `Cancelled`, and `Completed`, availability values include `Available` and `Unavailable`, and attendance values include `Present` and `Absent`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
