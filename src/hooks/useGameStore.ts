import { useStore } from "zustand";
import { gameStore } from "../engine/store";
import type { GameStore } from "../engine/types";

/**
 * React 컴포넌트에서 게임 스토어 사용 (셀렉터 패턴)
 *
 * @example
 * const punch = useGameStore(s => s.player.punch);
 * const { won, gems } = useGameStore(s => s.currencies);
 * const tap = useGameStore(s => s.processBattleTap);
 */
export function useGameStore<T>(selector: (state: GameStore) => T): T {
  return useStore(gameStore, selector);
}
