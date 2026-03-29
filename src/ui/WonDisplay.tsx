import { useGameStore } from "../hooks/useGameStore";
import { formatCurrency } from "../engine/numberFormat";
import { ICONS } from "../engine/assetPaths";

export function WonDisplay() {
  const won = useGameStore((s) => s.currencies.won);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "10px 16px",
        background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)",
        fontWeight: 700,
        fontSize: "var(--font-lg)",
        color: "var(--color-won)",
        textShadow: "0 2px 4px rgba(0,0,0,0.5)",
        pointerEvents: "none",
      }}
    >
      <img src={ICONS.gold} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {formatCurrency(won)}
      </span>
    </div>
  );
}
