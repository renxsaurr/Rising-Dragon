import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import AddBranchModal from '@/components/AddBranchModal'
import BranchesView from '@/components/BranchesView'
import BranchReportFilters from '@/app/branches/_components/BranchReportFilters'
import BranchReport from '@/app/branches/_components/BranchReport'
import PrintReportButton from '@/app/branches/_components/PrintReportButton'
import { getCurrentUser } from '@/utils/getCurrentUser'
import { dateInTimeZone } from '@/utils/dates'
import { getBranchReportWithComparison, resolveReportRange } from '@/utils/branch-reports'
import { parseBranchOperatingHours } from '@/utils/branch-operating-hours'

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; range?: string; from?: string; to?: string; branches?: string; sort?: string; dir?: string }>
}) {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const currentUser = await getCurrentUser()

  if (!currentUser || currentUser.role !== 'head_coach') {
    redirect('/students')
  }

  const params = await searchParams
  const view = params.view === 'reports' ? 'reports' : 'directory'
  const today = dateInTimeZone()

  const { data: branches, error } = await supabase
    .from('branch')
    .select('id, name, address, description, photo_url, is_active, operating_hours')
    .order('name')

  if (error) {
    return (
      <DashboardShell title="Branches" currentUser={currentUser}>
        <p role="alert" className="text-red-600 text-sm">
          {error.message.includes('operating_hours')
            ? 'Branch operating hours need a database update. Apply supabase/migrations/20261010100000_branch_operating_hours.sql in Supabase, then reload this page.'
            : `Something went wrong: ${error.message}`}
        </p>
      </DashboardShell>
    )
  }

  const branchRows = branches ?? []

  // report filters come from the URL; unknown branch ids are dropped, empty = all branches
  const knownBranchIds = new Set(branchRows.map((branch) => Number(branch.id)))
  const selectedBranchIds = [...new Set((params.branches ?? '').split(',').map(Number))].filter((id) => knownBranchIds.has(id))
  const reportRange = resolveReportRange(params.range, params.from, params.to)
  const reportResult = view === 'reports' && branchRows.length
    ? await getBranchReportWithComparison({ start: reportRange.start, end: reportRange.end, branchIds: selectedBranchIds })
    : null

  // the filter part of the URL (no view), so table sort links keep the current filters
  const reportQuery = new URLSearchParams({ range: reportRange.range })
  if (reportRange.range === 'custom') {
    reportQuery.set('from', reportRange.start)
    reportQuery.set('to', reportRange.end)
  }
  if (selectedBranchIds.length) reportQuery.set('branches', selectedBranchIds.join(','))

  // branch links carry the filters + sort, so the detail page can rebuild "Back to reports"
  const detailQuery = new URLSearchParams(reportQuery)
  if (params.sort) detailQuery.set('sort', params.sort)
  if (params.dir) detailQuery.set('dir', params.dir)
  detailQuery.set('ref', 'reports')
  const withCommas = (query: URLSearchParams) => query.toString().replace(/%2C/g, ',')

  // shown on the printed report
  const branchesLabel = selectedBranchIds.length
    ? branchRows.filter((branch) => selectedBranchIds.includes(Number(branch.id))).map((branch) => branch.name).join(', ')
    : 'All branches'
  const generatedAt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date())

  const [studentResult, scheduleResult] = view === 'directory' && branchRows.length
    ? await Promise.all([
      supabase.from('student').select('branch_id').eq('is_active', true),
      supabase.from('class_schedule').select('id, branch_id')
        .eq('date', today).neq('status', 'Draft').neq('status', 'Cancelled'),
    ])
    : [{ data: [] }, { data: [] }]

  if (studentResult.error || scheduleResult.error) {
    const loadError = studentResult.error?.message ?? scheduleResult.error?.message
    return <DashboardShell title="Branches" currentUser={currentUser}><p role="alert" className="text-sm text-red-600">Could not load branch data: {loadError}</p></DashboardShell>
  }

  const classesByBranch = new Map<number, number>()
  for (const schedule of scheduleResult.data ?? []) {
    classesByBranch.set(Number(schedule.branch_id), (classesByBranch.get(Number(schedule.branch_id)) ?? 0) + 1)
  }
  const studentsByBranch = new Map<number, number>()
  for (const student of studentResult.data ?? []) {
    studentsByBranch.set(Number(student.branch_id), (studentsByBranch.get(Number(student.branch_id)) ?? 0) + 1)
  }
  const branchesWithStats = branchRows.map((branch) => ({
    ...branch,
    address: branch.address ?? '',
    operating_hours: parseBranchOperatingHours(branch.operating_hours),
    studentCount: studentsByBranch.get(Number(branch.id)) ?? 0,
    todayClasses: classesByBranch.get(Number(branch.id)) ?? 0,
  })).sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name))
  return (
    <DashboardShell title="Branches" currentUser={currentUser}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 print:hidden" aria-label="Branches views">
          <Link href="/branches" aria-current={view === 'directory' ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-medium ${view === 'directory' ? 'bg-black text-white' : 'text-gray-600 hover:bg-white'}`}>Directory</Link>
          <Link href="/branches?view=reports" aria-current={view === 'reports' ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-medium ${view === 'reports' ? 'bg-black text-white' : 'text-gray-600 hover:bg-white'}`}>Branch reports</Link>
        </div>
        {view === 'directory' ? <AddBranchModal /> : <PrintReportButton />}
      </div>

      {view === 'reports'
        ? branchRows.length === 0
          ? <section className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white px-5 py-16 text-center">
            <h2 className="text-lg font-semibold text-gray-900">No branches yet</h2>
            <p className="mt-2 text-sm text-gray-500">Add a branch in the <Link href="/branches" className="font-medium text-red-600 hover:underline">Directory</Link> to see reports.</p>
          </section>
          : <div data-report-print className="mt-3 space-y-5">
            <BranchReportFilters
              key={`${reportRange.range}-${reportRange.start}-${reportRange.end}-${selectedBranchIds.join(',')}`}
              range={reportRange.range}
              start={reportRange.start}
              end={reportRange.end}
              branches={branchRows.map((branch) => ({ id: Number(branch.id), name: branch.name }))}
              selectedIds={selectedBranchIds}
            />
            {reportResult?.current.error
              ? <p role="alert" className="text-sm text-red-600">{reportResult.current.error}</p>
              : reportResult?.current.data && <BranchReport
                report={reportResult.current.data}
                comparison={reportResult.comparison}
                sort={params.sort}
                dir={params.dir}
                baseQuery={`view=reports&${withCommas(reportQuery)}`}
                detailQuery={withCommas(detailQuery)}
                branchesLabel={branchesLabel}
                generatedAt={generatedAt}
              />}
          </div>
        : <>
          <div className="mb-5 mt-5">
            <h2 className="text-xl font-semibold text-black">Branches</h2>
            <p className="mt-1 text-sm text-gray-500">{branchRows.filter((branch) => branch.is_active).length} active · {branchRows.filter((branch) => !branch.is_active).length} archived. Closed branches stay available for historical reports.</p>
          </div>
          <BranchesView branches={branchesWithStats} />
        </>}
    </DashboardShell>
  )
}
