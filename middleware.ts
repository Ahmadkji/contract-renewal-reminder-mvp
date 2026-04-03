import { proxy } from './proxy'

export const middleware = proxy

export const config = {
  matcher: [
    // Skip Next.js assets and data/fetch endpoints to avoid breaking client navigation.
    '/((?!_next/static|_next/image|_next/data|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
