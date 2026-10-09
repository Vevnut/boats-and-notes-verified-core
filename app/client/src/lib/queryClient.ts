import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { token } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE || "";
export const apiUrl = (path: string) => `${API_BASE}${path}`;
export type BaselineField = "description" | "techNotes" | "customerNotes";
export type SaveOptions = { version?: string; operationId?: string; fieldBase?: { field: BaselineField; value: string } };
const versions = new Map<string, string>();
const retries = new Map<string, { operation: string; version?: string }>();
export const saveState = { pending: 0, confirmed: "", failures: new Map<string, string>() };
export const saveListeners = new Set<() => void>();
const notify = () => saveListeners.forEach(fn => fn());
export const dismissSaveFailure = (url: string) => { saveState.failures.delete(url); notify(); };
function remember(value: any) {
  if (Array.isArray(value)) value.forEach(remember);
  else if (value && typeof value === "object" && value._resource && value._version)
    versions.set(value._resource, value._version);
}
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function apiRequest(method: string, url: string, data?: any, options: SaveOptions = {}): Promise<Response> {
  if (data?.__save) {
    options = data.__save;
    const { __save, ...body } = data;
    data = body;
  }
  if (options.fieldBase && method === "PATCH") {
    data = { ...data, __fieldBase: options.fieldBase };
  }
  const write = !["GET", "HEAD"].includes(method);
  const tracked = write && !url.startsWith("/api/recovery/") && url !== "/api/preferences" && url !== "/api/html-to-pdf";
  const signature = JSON.stringify([method, url, data, options.operationId]);
  const retry = retries.get(signature);
  const version = retry?.version ?? options.version ?? versions.get(url.replace(/\/caption$/, "").replace(/^\/api\/work-orders\/(\d+)\/signature$/, "/api/service/$1").replace(/^\/api\/schedule\//, "/api/scheduled-events/"));
  const operation = options.operationId ?? retry?.operation ?? crypto.randomUUID();
  if (tracked) { retries.set(signature, { operation, version }); saveState.pending++; notify(); }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), url.includes("pdf") || url === "/api/backup" ? 55000 : 25000);
  try {
    const res = await fetch(apiUrl(url), {
      method, signal: controller.signal,
      headers: {
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(tracked ? { "X-Operation-Id": operation } : {}),
        // Keep record concurrency separate from HTTP cache preconditions.
        // Vercel evaluates If-Match on successful function responses itself.
        ...(tracked && version ? { "X-Record-Version": version } : {}),
      },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) {
      const body = await res.clone().json().catch(() => ({}));
      // A rejected conflict is definite, not an uncertain network save.
      if (tracked && res.status === 409) retries.delete(signature);
      throw new ApiError(body.error || `The server could not complete this request (${res.status}).`, res.status);
    }
    if (res.headers.get("content-type")?.includes("json")) remember(await res.clone().json());
    if (tracked) {
      retries.delete(signature);
      saveState.failures.delete(url);
      saveState.confirmed = new Date().toLocaleTimeString();
    }
    return res;
  } catch (error) {
    const failure = error instanceof ApiError ? error : new ApiError(
      "Save not confirmed. Keep this page open and try Save again when connected. Retrying the same save will not create a second copy.", 0);
    if (tracked) saveState.failures.set(url, failure.message);
    throw failure;
  } finally {
    clearTimeout(timer);
    if (tracked) { saveState.pending--; notify(); }
  }
}
export const getQueryFn: <T>(options: { on401: "returnNull" | "throw" }) => QueryFunction<T> =
  ({ on401 }) => async ({ queryKey }) => {
    try { return await (await apiRequest("GET", queryKey.join("/"))).json(); }
    catch (error) { if (on401 === "returnNull" && error instanceof ApiError && error.status === 401) return null; throw error; }
  };
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { queryFn: getQueryFn({ on401: "throw" }), networkMode: "always", refetchOnWindowFocus: true, staleTime: 10000, retry: false },
    mutations: { networkMode: "always", retry: false },
  },
});
