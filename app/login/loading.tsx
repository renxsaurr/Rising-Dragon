export default function Loading() {
  return (
    <div role="status" aria-label="Loading sign-in page" aria-busy="true" className="flex min-h-screen w-full animate-pulse bg-white">
      <div className="hidden min-h-screen bg-gray-200 lg:block lg:w-1/2">
        <div className="m-6 flex h-10 w-44 items-center gap-2 rounded-full bg-white/70 p-1.5">
          <div className="h-7 w-7 rounded-full bg-gray-200" />
          <div className="h-3 w-24 rounded bg-gray-200" />
        </div>
        <div className="absolute bottom-12 left-8 space-y-3">
          <div className="h-8 w-80 rounded bg-gray-100" />
          <div className="h-4 w-96 rounded bg-gray-100" />
        </div>
      </div>
      <div className="flex w-full items-center justify-center px-8 sm:px-16 lg:w-1/2">
        <div className="w-full max-w-[22.5rem]">
          <div className="mx-auto h-10 w-64 rounded bg-gray-100" />
          <div className="mx-auto mt-3 h-4 w-56 rounded bg-gray-100" />
          <div className="mt-10 space-y-5">
            <div className="space-y-2"><div className="h-3 w-14 rounded bg-gray-100" /><div className="h-11 rounded-lg border border-gray-200 bg-gray-50" /></div>
            <div className="space-y-2"><div className="h-3 w-20 rounded bg-gray-100" /><div className="h-11 rounded-lg border border-gray-200 bg-gray-50" /></div>
            <div className="flex justify-between"><div className="h-4 w-28 rounded bg-gray-100" /><div className="h-4 w-24 rounded bg-gray-100" /></div>
            <div className="h-11 rounded-lg bg-gray-200" />
          </div>
          <span className="sr-only">Loading</span>
        </div>
      </div>
    </div>
  )
}
