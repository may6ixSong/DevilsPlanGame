import type { ComponentType } from 'react';
import type { GameResult, Seat } from '../backend/types';

export type MoveOutcome<S> = { ok: true; state: S } | { ok: false; error: string };

export interface BoardProps<S, M> {
  state: S;
  mySeat: Seat;
  /** 내 차례인지 (턴제 게임일 때) */
  isMyTurn: boolean;
  /** 게임 종료 등으로 입력 불가 */
  disabled: boolean;
  names: Record<Seat, string>;
  onMove: (move: M) => void;
}

/**
 * 새 게임을 추가하려면 이 인터페이스를 구현해서 registry.ts 에 등록하면 끝.
 * - 상태(S)는 JSON 직렬화 가능해야 함
 * - applyMove 는 순수 함수(같은 입력 → 같은 출력)여야 함. 양쪽 기기에서 검증에 사용됨
 */
export interface GameDefinition<S = any, M = any> {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  rules: string[];
  setup(ctx: { firstSeat: Seat; random: () => number }): S;
  /** 지금 누구 차례인지. 동시 진행 게임이면 null 반환 */
  currentTurn(state: S): Seat | null;
  applyMove(state: S, move: M, by: Seat): MoveOutcome<S>;
  /** 게임이 끝났으면 결과, 진행 중이면 null */
  getResult(state: S): GameResult | null;
  Board: ComponentType<BoardProps<S, M>>;
}
