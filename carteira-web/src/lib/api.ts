import { getToken } from './session';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiErrorBody = { message?: string | string[] };

// Extrai a mensagem em PT-BR que a API retorna; o campo message pode ser string
// (exceções de negócio) ou string[] (erros de validação do class-validator).
function extractMessage(body: ApiErrorBody, fallback: string): string {
  const { message } = body;
  if (Array.isArray(message)) return message[0] ?? fallback;
  return message ?? fallback;
}

// Wrapper de fetch para uso server-side (Server Actions / Server Components).
// Anexa o JWT da sessão e normaliza o tratamento de erro.
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = init;

  const finalHeaders = new Headers(headers);
  finalHeaders.set('Content-Type', 'application/json');

  if (auth) {
    const token = await getToken();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    cache: 'no-store',
  });

  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      extractMessage(body as ApiErrorBody, 'Erro ao processar a requisição.'),
      response.status,
    );
  }

  return body as T;
}
