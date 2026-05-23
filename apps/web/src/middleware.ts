import { NextRequest, NextResponse } from 'next/server';

const AUTH_ROUTES = ['/login', '/signup'];
const PROTECTED_ROOT = '/dashboard';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

export function middleware(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl;
  const hasSession = request.cookies.has(REFRESH_TOKEN_COOKIE);
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isProtectedRoute = pathname.startsWith(PROTECTED_ROOT);

  if (isAuthRoute && searchParams.get('session') === 'expired') {
    const response = NextResponse.next();
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    return response;
  }

  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL(PROTECTED_ROOT, request.url));
  }

  if (isProtectedRoute && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    // searchParams.set() already URL-encodes the value — do NOT wrap with encodeURIComponent
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
