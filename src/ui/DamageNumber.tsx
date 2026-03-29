import {
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import Decimal from "break_infinity.js";
import { formatNumber } from "../engine/numberFormat";

const POOL_SIZE = 24;
const ANIM_DURATION = 650;

interface DamageEntry {
  el: HTMLDivElement;
  timer: ReturnType<typeof setTimeout> | null;
}

export interface DamageNumberHandle {
  spawn: (
    x: number,
    y: number,
    damage: Decimal,
    type?: "normal" | "crit" | "kick",
  ) => void;
}

/** 데미지 크기 → 폰트 스케일 (로그) */
function fontScale(dmg: Decimal): number {
  const n = dmg.toNumber();
  if (n <= 10) return 1;
  // log10 기반: 100→1.1, 1000→1.2, 10000→1.3 ...
  return 1 + Math.log10(n) * 0.08;
}

export const DamageNumber = forwardRef<DamageNumberHandle>(
  function DamageNumber(_, ref) {
    const poolRef = useRef<DamageEntry[]>([]);
    const indexRef = useRef(0);

    const initPool = useCallback((container: HTMLDivElement | null) => {
      if (!container || poolRef.current.length > 0) return;

      for (let i = 0; i < POOL_SIZE; i++) {
        const el = document.createElement("div");
        Object.assign(el.style, {
          position: "absolute",
          pointerEvents: "none",
          fontWeight: "900",
          textShadow: "0 2px 8px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)",
          opacity: "0",
          willChange: "transform, opacity",
          whiteSpace: "nowrap",
          letterSpacing: "-0.5px",
          lineHeight: "1",
        });
        container.appendChild(el);
        poolRef.current.push({ el, timer: null });
      }
    }, []);

    const spawn = useCallback(
      (
        x: number,
        y: number,
        damage: Decimal,
        type: "normal" | "crit" | "kick" = "normal",
      ) => {
        const entry = poolRef.current[indexRef.current % POOL_SIZE];
        indexRef.current++;
        if (!entry) return;

        if (entry.timer) clearTimeout(entry.timer);

        const { el } = entry;
        const text = formatNumber(damage);
        const scale = fontScale(damage);

        // 랜덤 오프셋 ±30px (겹침 방지)
        const ox = (Math.random() - 0.5) * 60;
        const oy = (Math.random() - 0.5) * 20;

        let color: string;
        let baseFontSize: number;
        let anim: string;
        let dur = ANIM_DURATION;
        let extra = "";

        if (type === "crit") {
          color = "var(--color-crit)";
          baseFontSize = 32 * scale;
          anim = "damage-float-crit";
          dur = 800;
          extra = "크리티컬!";
        } else if (type === "kick") {
          color = "#ff6b6b";
          baseFontSize = 24 * scale;
          anim = "damage-float-kick";
        } else {
          color = "var(--text-primary)";
          baseFontSize = 20 * scale;
          anim = "damage-float";
        }

        el.textContent = extra ? `${text}\n${extra}` : text;
        Object.assign(el.style, {
          left: `${x + ox}px`,
          top: `${y + oy}px`,
          color,
          fontSize: `${baseFontSize}px`,
          opacity: "1",
          animation: "none",
        });

        // 리플로우 강제
        void el.offsetWidth;
        el.style.animation = `${anim} ${dur}ms ease-out forwards`;

        entry.timer = setTimeout(() => {
          el.style.opacity = "0";
          el.style.animation = "none";
        }, dur);
      },
      [],
    );

    useImperativeHandle(ref, () => ({ spawn }), [spawn]);

    return (
      <div
        ref={initPool}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 50,
          overflow: "hidden",
        }}
      />
    );
  },
);
