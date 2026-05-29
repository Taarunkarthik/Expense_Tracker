export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, options: RequestInit = {}, token?: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>(path, undefined, token),
  post: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, token),
  put: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }, token),
  patch: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, token),
  delete: <T>(path: string, token?: string) =>
    request<T>(path, { method: "DELETE" }, token),
};
