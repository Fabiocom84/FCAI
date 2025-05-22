// middleware.js (JavaScript)
export default function middleware(request) {
  // Your middleware logic here
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.rewrite(new URL('/api-middleware', request.url));
  }

  if (request.nextUrl.pathname === '/dashboard') {
    return NextResponse.rewrite(new URL('/auth-middleware', request.url));
  }

  return NextResponse.next();
}

// Matcher configuration (optional, but recommended for specificity)
export const config = {
  matcher: ['/api/:path*', '/dashboard'],
};