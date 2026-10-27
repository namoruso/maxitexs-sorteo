export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T;
  offline?: boolean;
};

export async function api<T = Record<string, unknown>>(
  path: string,
  opts?: { method?: string; body?: unknown },
): Promise<ApiResult<T>> {
  try {
    const init: RequestInit = {
      method: opts?.method ?? 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    };
    if (opts?.body !== undefined) {
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    const r = await fetch(path, init);
    const data = (await r.json().catch(() => ({}))) as T;
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: {} as T, offline: true };
  }
}
