import { useEffect, useRef, useState } from "react";
import Decimal from "break_infinity.js";
import { formatNumber } from "../engine/numberFormat";

interface StatDisplayProps {
  /** 이모지 문자열 또는 이미지 URL (http/assets로 시작하면 이미지) */
  icon: string;
  label: string;
  value: Decimal | number;
  color?: string;
}

function isImageUrl(s: string) {
  return s.startsWith("/") || s.startsWith("http") || s.startsWith("assets");
}

export function StatDisplay({
  icon,
  label,
  value,
  color = "var(--text-primary)",
}: StatDisplayProps) {
  const [highlight, setHighlight] = useState(false);
  const prevRef = useRef<string>("");

  const display = formatNumber(value);

  useEffect(() => {
    if (prevRef.current !== "" && prevRef.current !== display) {
      setHighlight(true);
      const t = setTimeout(() => setHighlight(false), 400);
      return () => clearTimeout(t);
    }
    prevRef.current = display;
  }, [display]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: "var(--font-sm)",
      }}
    >
      {isImageUrl(icon) ? (
        <img src={icon} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} draggable={false} />
      ) : (
        <span style={{ fontSize: "1.1rem" }}>{icon}</span>
      )}
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span
        style={{
          color,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          animation: highlight ? "stat-highlight 0.4s ease-out" : "none",
        }}
      >
        {display}
      </span>
    </div>
  );
}
