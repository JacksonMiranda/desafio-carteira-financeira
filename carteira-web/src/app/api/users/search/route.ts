import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { apiFetch } from '@/lib/api';
import type { Contact } from '@/lib/types';

// Proxy server-side da busca de destinatários: encaminha à API anexando o JWT
// do cookie, sem expor o token ao cliente.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';

  try {
    const contacts = await apiFetch<Contact[]>(
      `/users/search?q=${encodeURIComponent(q)}`,
    );
    return NextResponse.json(contacts);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
