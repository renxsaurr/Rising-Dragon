import DashboardShell from '@/components/DashboardShell'
import { getCurrentUser } from '@/utils/getCurrentUser'

export type DashboardLoadingVariant =
  | 'dashboard'
  | 'dashboard-detail'
  | 'students'
  | 'attendance'
  | 'attendance-history'
  | 'schedule'
  | 'branches'
  | 'branch-detail'
  | 'payments'
  | 'promotions'
  | 'users'
  | 'settings'

function Block({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />
}

function FilterBar({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Block className="h-10 min-w-[240px] flex-1" />
      {Array.from({ length: count }, (_, index) => <Block key={index} className="h-10 w-36" />)}
    </div>
  )
}

function Rows({ columns, count = 5 }: { columns: number; count?: number }) {
  const gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`
  return (
    <div className="overflow-hidden border-y border-gray-200 bg-white">
      <div className="grid gap-4 border-b border-gray-200 px-4 py-4" style={{ gridTemplateColumns }}>
        {Array.from({ length: columns }, (_, index) => <Block key={index} className="h-3 w-3/4" />)}
      </div>
      {Array.from({ length: count }, (_, row) => (
        <div key={row} className="grid min-h-[72px] items-center gap-4 border-b border-gray-100 px-4 py-5 last:border-b-0" style={{ gridTemplateColumns }}>
          {Array.from({ length: columns }, (_, column) => <Block key={column} className={`h-4 ${column === 0 ? 'w-4/5' : 'w-3/5'}`} />)}
        </div>
      ))}
    </div>
  )
}

function Card({ className = 'h-36' }: { className?: string }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><Block className={className} /></div>
}

function PageBody({ variant, isHeadCoach }: { variant: DashboardLoadingVariant; isHeadCoach: boolean }) {
  switch (variant) {
    case 'dashboard':
      return (
        <div className="space-y-5">
          <div className="flex items-end justify-between"><div><Block className="h-5 w-44" /><Block className="mt-2 h-3 w-64" /></div><Block className="h-4 w-36" /></div>
          <div className={`grid gap-4 sm:grid-cols-2 ${isHeadCoach ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
            {Array.from({ length: isHeadCoach ? 4 : 3 }, (_, index) => <Card key={index} className="h-24" />)}
          </div>
          <div className="grid items-stretch gap-5 xl:grid-cols-3">
            <Card className="h-[360px]" /><Card className="h-[360px]" /><Card className="h-[360px]" />
          </div>
        </div>
      )
    case 'dashboard-detail':
      return (
        <div className="space-y-5">
          <Block className="h-4 w-36" />
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-5"><Block className="h-5 w-48" /><Block className="h-4 w-20" /></div>
            <Rows columns={5} count={6} />
          </div>
        </div>
      )
    case 'students':
      return (
        <div className="space-y-5">
          <div className="flex justify-end"><Block className="h-11 w-36" /></div>
          <FilterBar count={3} />
          <Rows columns={isHeadCoach ? 7 : 4} />
        </div>
      )
    case 'attendance':
      return (
        <div className="space-y-5">
          <div className="flex items-center justify-between"><Block className="h-5 w-48" /><Block className="h-11 w-40" /></div>
          <Block className="h-[72px] w-full max-w-[42rem] rounded-xl" />
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 p-5"><Block className="h-5 w-56" /><Block className="h-10 w-40" /></div>
            <Rows columns={5} count={4} />
          </div>
        </div>
      )
    case 'attendance-history':
      return (
        <div className="space-y-5">
          <Block className="h-4 w-36" />
          <div className="rounded-xl border border-gray-200 bg-white p-5"><Block className="h-4 w-40" /><Block className="mt-3 h-6 w-60" /><Block className="mt-5 h-10 w-full max-w-xl" /></div>
          <div className="border-b border-gray-200 pb-3"><Block className="h-5 w-32" /></div>
          <Rows columns={6} />
        </div>
      )
    case 'schedule':
      return isHeadCoach ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><Block className="h-10 w-40" /><Block className="h-10 w-36" /></div>
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.9fr)]"><Card className="h-[520px]" /><Card className="h-[520px]" /></div>
          <div className="grid gap-5 lg:grid-cols-2"><Card className="h-56" /><Card className="h-56" /></div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between"><Block className="h-6 w-48" /><Block className="h-11 w-44" /></div>
          <Card className="h-[520px]" />
          <div className="grid items-start gap-5 lg:grid-cols-2"><Card className="h-[260px]" /><Card className="h-[260px]" /></div>
        </div>
      )
    case 'branches':
      return (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4"><div className="inline-flex gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1"><Block className="h-9 w-24" /><Block className="h-9 w-32" /></div><Block className="h-11 w-36" /></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Card key={index} className="h-48" />)}</div>
        </div>
      )
    case 'branch-detail':
      return (
        <div className="space-y-5">
          <div className="flex justify-between"><Block className="h-10 w-52" /><Block className="h-11 w-36" /></div>
          <Card className="h-80" />
          <div className="grid gap-5 lg:grid-cols-2"><Card className="h-52" /><Card className="h-52" /></div>
        </div>
      )
    case 'payments':
      return (
        <div className="space-y-5">
          <div className="flex items-center justify-between"><div className="inline-flex gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1"><Block className="h-9 w-24" /><Block className="h-9 w-36" /><Block className="h-9 w-24" /></div><Block className="h-11 w-44" /></div>
          <div className="border-b border-gray-200 pb-4"><Block className="h-5 w-56" /></div>
          <FilterBar count={3} />
          <Rows columns={8} count={4} />
        </div>
      )
    case 'promotions':
      return (
        <div className="space-y-5">
          <div className="flex gap-2"><Block className="h-10 w-32" /><Block className="h-10 w-28" /></div>
          <FilterBar count={2} />
          <Rows columns={isHeadCoach ? 5 : 4} />
        </div>
      )
    case 'users':
      return <div className="space-y-5"><div className="flex justify-end"><Block className="h-11 w-36" /></div><Rows columns={7} /></div>
    case 'settings':
      return (
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <Block className="h-6 w-3/4 max-w-[36rem]" />
          {isHeadCoach && <div className="grid gap-5 lg:grid-cols-2"><Card className="h-48" /><Card className="h-56" /><Card className="h-44" /></div>}
          <Card className="h-60" /><Card className="h-64" />
        </div>
      )
  }
}

export default async function DashboardLoading({
  title,
  variant,
}: {
  title: string
  variant: DashboardLoadingVariant
}) {
  // Resolve the signed-in profile on the server so a hard reload keeps the
  // shared header, search, notification bell, and role-aware navigation visible.
  const currentUser = await getCurrentUser()

  return (
    <DashboardShell title={title} currentUser={currentUser}>
      <div role="status" aria-label="Loading page content" aria-busy="true" className="animate-pulse">
        <PageBody variant={variant} isHeadCoach={currentUser?.role === 'head_coach'} />
        <span className="sr-only">Loading</span>
      </div>
    </DashboardShell>
  )
}
