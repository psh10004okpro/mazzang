import { useState, useEffect, useRef, Suspense } from "react";
import type { SceneName } from "../engine/types";

interface SceneTransitionProps {
  scene: SceneName;
  scenes: Record<SceneName, React.FC>;
}

const FADE_MS = 180;

function SceneLoading() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        color: "var(--text-dim)",
        fontSize: "var(--font-sm)",
      }}
    >
      로딩 중...
    </div>
  );
}

export function SceneTransition({ scene, scenes }: SceneTransitionProps) {
  const [current, setCurrent] = useState(scene);
  const [phase, setPhase] = useState<"visible" | "fading">("visible");
  const prevRef = useRef(scene);

  useEffect(() => {
    if (scene === prevRef.current) return;
    prevRef.current = scene;

    setPhase("fading");
    const t = setTimeout(() => {
      setCurrent(scene);
      setPhase("visible");
    }, FADE_MS);

    return () => clearTimeout(t);
  }, [scene]);

  const Scene = scenes[current];

  return (
    <div
      key={current}
      style={{
        width: "100%",
        flex: 1,
        minHeight: 0,
        position: "relative",
        opacity: phase === "visible" ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      <Suspense fallback={<SceneLoading />}>
        <Scene />
      </Suspense>
    </div>
  );
}
