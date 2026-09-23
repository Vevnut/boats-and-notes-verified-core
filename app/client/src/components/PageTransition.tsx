import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

/**
 * Wraps page content with a subtle fade + lift transition on route change.
 * The effect is quick and non-intrusive — just enough to signal navigation.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [visible, setVisible] = useState(true);
  const prevLocation = useRef(location);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (location === prevLocation.current) return;
    prevLocation.current = location;

    // Flash out, then back in
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(true), 120);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [location]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
        transition: visible
          ? "opacity 0.22s ease, transform 0.22s ease"
          : "opacity 0.1s ease, transform 0.1s ease",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
