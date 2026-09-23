import { useEffect, useState } from "react";

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  // phase: "in" → logo animates in, "hold" → brief pause, "out" → fade/slide out
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    // logo finishes drawing ~900ms in, hold for a beat, then exit
    const holdTimer = setTimeout(() => setPhase("hold"), 900);
    const outTimer  = setTimeout(() => setPhase("out"),  1600);
    const doneTimer = setTimeout(() => onDone(),         2200);
    return () => { clearTimeout(holdTimer); clearTimeout(outTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "hsl(200 85% 20%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        transition: phase === "out" ? "opacity 0.55s ease, transform 0.55s ease" : "none",
        opacity: phase === "out" ? 0 : 1,
        transform: phase === "out" ? "scale(1.04)" : "scale(1)",
        pointerEvents: phase === "out" ? "none" : "auto",
      }}
    >
      {/* Animated anchor+pencil SVG */}
      <svg
        viewBox="0 0 96 96"
        width="100"
        height="100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Boats and Notes logo"
        style={{ filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.4))" }}
      >
        {/* Circle border */}
        <circle cx="48" cy="48" r="44" stroke="#c9a84c" strokeWidth="2.5" opacity="0.5"
          style={{
            strokeDasharray: 276,
            strokeDashoffset: phase === "in" ? 276 : 0,
            transition: "stroke-dashoffset 0.7s ease",
          }}
        />

        {/* Anchor shaft */}
        <line x1="48" y1="18" x2="48" y2="72"
          stroke="#e8c96b" strokeWidth="3.5" strokeLinecap="round"
          style={{
            strokeDasharray: 54,
            strokeDashoffset: phase === "in" ? 54 : 0,
            transition: "stroke-dashoffset 0.45s ease 0.1s",
          }}
        />

        {/* Anchor top ring */}
        <circle cx="48" cy="18" r="5" stroke="#e8c96b" strokeWidth="3"
          style={{
            strokeDasharray: 32,
            strokeDashoffset: phase === "in" ? 32 : 0,
            transition: "stroke-dashoffset 0.3s ease 0.2s",
          }}
        />

        {/* Anchor crossbar */}
        <line x1="30" y1="30" x2="66" y2="30"
          stroke="#e8c96b" strokeWidth="3" strokeLinecap="round"
          style={{
            strokeDasharray: 36,
            strokeDashoffset: phase === "in" ? 36 : 0,
            transition: "stroke-dashoffset 0.35s ease 0.35s",
          }}
        />

        {/* Anchor left curve */}
        <path d="M48 72 Q28 72 28 55"
          stroke="#e8c96b" strokeWidth="3" strokeLinecap="round"
          style={{
            strokeDasharray: 30,
            strokeDashoffset: phase === "in" ? 30 : 0,
            transition: "stroke-dashoffset 0.35s ease 0.45s",
          }}
        />

        {/* Anchor right curve */}
        <path d="M48 72 Q68 72 68 55"
          stroke="#e8c96b" strokeWidth="3" strokeLinecap="round"
          style={{
            strokeDasharray: 30,
            strokeDashoffset: phase === "in" ? 30 : 0,
            transition: "stroke-dashoffset 0.35s ease 0.45s",
          }}
        />

        {/* Pencil body (diagonal crossbar through anchor) */}
        <line x1="26" y1="56" x2="70" y2="34"
          stroke="#c9a84c" strokeWidth="4" strokeLinecap="round" opacity="0.9"
          style={{
            strokeDasharray: 50,
            strokeDashoffset: phase === "in" ? 50 : 0,
            transition: "stroke-dashoffset 0.4s ease 0.55s",
          }}
        />

        {/* Pencil tip */}
        <polygon points="70,34 76,28 78,36"
          fill="#c9a84c" opacity="0.9"
          style={{
            opacity: phase === "in" ? 0 : 0.9,
            transition: "opacity 0.2s ease 0.9s",
          }}
        />

        {/* Pencil eraser end */}
        <line x1="26" y1="56" x2="21" y2="62"
          stroke="#e8c96b" strokeWidth="3" strokeLinecap="round" opacity="0.7"
          style={{
            strokeDasharray: 10,
            strokeDashoffset: phase === "in" ? 10 : 0,
            transition: "stroke-dashoffset 0.2s ease 0.92s",
          }}
        />
      </svg>

      {/* Brand name */}
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontFamily: "'General Sans', 'Inter', sans-serif",
            fontSize: "22px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "#e8c96b",
            opacity: phase === "in" ? 0 : 1,
            transform: phase === "in" ? "translateY(10px)" : "translateY(0)",
            transition: "opacity 0.4s ease 0.7s, transform 0.4s ease 0.7s",
          }}
        >
          Boats and Notes
        </p>
        <p
          style={{
            fontFamily: "'General Sans', 'Inter', sans-serif",
            fontSize: "12px",
            fontWeight: 400,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(200,210,220,0.55)",
            marginTop: "4px",
            opacity: phase === "in" ? 0 : 1,
            transition: "opacity 0.4s ease 0.9s",
          }}
        >
          Bradley's Boat Care
        </p>
      </div>

      {/* Bottom shimmer line */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: "3px",
          background: "linear-gradient(90deg, transparent, #e8c96b, transparent)",
          transition: "width 1.5s ease 0.1s",
          width: phase === "in" ? "0%" : "100%",
        }}
      />
    </div>
  );
}
