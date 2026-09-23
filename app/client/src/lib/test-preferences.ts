import { apiRequest } from "./queryClient";
let values: Record<string, string> = {};
export const testPreferences = {
  getItem: (key: string) => values[key] ?? null,
  setItem: (key: string, value: string) => {
    values[key] = value;
    void apiRequest("PUT", "/api/preferences", { key, value }).catch(() => {});
  },
};
export async function loadTestPreferences() {
  try { values = await (await apiRequest("GET", "/api/preferences")).json(); }
  catch { values = {}; }
}
