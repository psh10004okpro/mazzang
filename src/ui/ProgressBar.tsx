import Decimal from "break_infinity.js";

interface ProgressBarProps {
  value: Decimal | number;
  max: Decimal | number;
  color?: string;
  height?: number;
  label?: string;
}

export function ProgressBar({
  value,
  max,
  color = "var(--color-hp)",
  height = 20,
  label,
}: ProgressBarProps) {
  const v = value instanceof Decimal ? value.toNumber() : Number(value);
  const m = max instanceof Decimal ? max.toNumber() : Number(max);
  const ratio = m > 0 ? Math.min(1, v / m) : 0;
  const pct = ratio * 100;

  return (
    <div
      style={{
        width: "100%",
        height,
        background: "rgba(255,255,255,0.1)",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: "var(--radius-sm)",
          transition: "width 0.15s ease-out",
          boxShadow: `0 0 8px ${color}40`,
        }}
      />
      {label && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "var(--font-sm)",
            fontWeight: 700,
            textShadow: "0 1px 3px rgba(0,0,0,0.8)",
            pointerEvents: "none",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
