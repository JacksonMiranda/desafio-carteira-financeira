import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/register'];

// Protege as rotas: sem o cookie de sessão, redireciona para o login.
// Usuário já autenticado que acessa login/registro é levado ao dashboard.
export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isPublic) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Ignora assets internos do Next e arquivos estáticos.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
