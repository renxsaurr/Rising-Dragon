import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export async function updateSession(request: NextRequest) {
  if (!supabaseUrl || !supabaseKey) return NextResponse.next({ request })

  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Validate the Supabase session before serving application pages. This is an
  // optimistic front-door check only: pages, Server Actions, and Route
  // Handlers still verify the user's staff profile and role before accessing
  // data or performing mutations.
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublicPage = pathname === '/' || pathname === '/login'
  const isApiRoute = pathname === '/api' || pathname.startsWith('/api/')

  if (!user && !isPublicPage && !isApiRoute) {
    const loginUrl = new URL('/login', request.url)
    const redirectResponse = NextResponse.redirect(loginUrl)

    // Preserve any cookie refresh or cleanup performed while validating the
    // session so stale auth cookies do not keep sending the browser in circles.
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })

    return redirectResponse
  }

  return response
}
