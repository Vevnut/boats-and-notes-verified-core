import { useEffect } from "react";

/**
 * Sets document.title for the lifetime of the calling page component.
 * Usage: usePageTitle("Dashboard") → "Dashboard — Boats and Notes"
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} | Boats and Notes` : "Boats and Notes";
    return () => {
      document.title = previous;
    };
  }, [title]);
}
