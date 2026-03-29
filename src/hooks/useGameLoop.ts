import { useEffect, useRef, useCallback, useState } from "react";
import Decimal from "break_infinity.js";
import { gameStore } from "../engine/store";
import {
  startGameLoop,
  stopGameLoop,
  calcOfflineEarnings,
} from "../engine/gameLoop";

/**
 * 게임 루프 React 훅
 * - 마운트 시 루프 시작 + 세이브 로드
 * - 언마운트 시 루프 정지 + 저장
 * - Page Visibility API로 백그라운드 감지
 * - 오프라인 수익 팝업 상태 반환
 */
export function useGameLoop() {
  const hiddenAtRef = useRef<number>(0);
  const [offlineEarnings, setOfflineEarnings] = useState<Decimal | null>(null);

  const dismissOffline = useCallback(() => setOfflineEarnings(null), []);

  useEffect(() => {
    // 세이브 로드 + 오프라인 수익 체크
    const loaded = gameStore.getState().loadGame();
    if (loaded) {
      const { meta } = gameStore.getState();
      const elapsed = Date.now() - meta.lastSaveTime;
      if (elapsed > 60_000) {
        const earnings = calcOfflineEarnings(elapsed);
        if (earnings.gt(0)) {
          const { currencies } = gameStore.getState();
          gameStore.setState({
            currencies: { ...currencies, won: currencies.won.add(earnings) },
          });
          setOfflineEarnings(earnings);
        }
      }
    }

    startGameLoop();

    function onVisibilityChange() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        gameStore.getState().saveGame();
        stopGameLoop();
      } else {
        if (hiddenAtRef.current > 0) {
          const elapsed = Date.now() - hiddenAtRef.current;
          const earnings = calcOfflineEarnings(elapsed);
          if (earnings.gt(0)) {
            const { currencies } = gameStore.getState();
            gameStore.setState({
              currencies: { ...currencies, won: currencies.won.add(earnings) },
            });
            setOfflineEarnings(earnings);
          }
          hiddenAtRef.current = 0;
        }
        startGameLoop();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopGameLoop();
      gameStore.getState().saveGame();
    };
  }, []);

  return { offlineEarnings, dismissOffline };
}
