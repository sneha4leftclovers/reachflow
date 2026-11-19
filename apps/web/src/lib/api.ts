const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Array<{ field?: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  token?: string | null;
  workspaceId?: string | null;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { token, workspaceId, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (workspaceId) {
    headers['x-workspace-id'] = workspaceId;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const res = await fetch(url, {
    headers,
    credentials: 'include',
    ...rest,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const errorData = json?.error || {
      code: 'UNKNOWN_ERROR',
      message: res.statusText || 'Request failed',
    };
    throw new ApiError(res.status, errorData.code, errorData.message, errorData.details);
  }

  return json?.data as T;
}
