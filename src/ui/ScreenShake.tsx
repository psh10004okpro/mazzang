import {
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  type ReactNode,
} from "react";

export interface ScreenShakeHandle {
  shake: (heavy?: boolean) => void;
}

interface ScreenShakeProps {
  children: ReactNode;
}

export const ScreenShake = forwardRef<ScreenShakeHandle, ScreenShakeProps>(
  function ScreenShake({ children }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);

    const shake = useCallback((heavy = false) => {
      const el = containerRef.current;
      if (!el) return;
      el.classList.remove("shake", "shake-heavy");
      void el.offsetWidth;
      el.classList.add(heavy ? "shake-heavy" : "shake");
    }, []);

    useImperativeHandle(ref, () => ({ shake }), [shake]);

    return (
      <div
        ref={containerRef}
        onAnimationEnd={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.classList.remove("shake", "shake-heavy");
        }}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {children}
      </div>
    );
  },
);
