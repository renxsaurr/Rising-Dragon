// Supabase caps each response (1000 rows by default), so rows are read page by page
const PAGE_SIZE = 1000

export type PageResult<T> = { data: T[] | null; error: { message: string } | null }

// keep requesting the next slice until a page comes back empty, so even a lower
// server row cap can never silently cut the totals short
export async function fetchAllRows<T>(fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>) {
  const rows: T[] = []
  while (true) {
    const { data, error } = await fetchPage(rows.length, rows.length + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) return rows
    rows.push(...data)
  }
}
