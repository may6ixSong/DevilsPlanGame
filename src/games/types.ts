import type { ComponentType } from 'react';
import type { GameResult, Seat } from '../backend/types';

export type MoveOutcome<S> = { ok: true; state: S } | { ok: false; error: string };

export type GameOptions = Record<string, number>;

/** 방 만들 때 방장이 고르는 게임 설정 */
export type GameOptionSpec =
  | { key: string; label: string; kind: 'choice'; default: number; choices: { value: number; label: string }[] }
  | { key: string; label: string; kind: 'range'; default: number; min: number; max: number; step?: number; unit?: string };

export interface MoveContext {
  /** 서버 기준 현재 시각(ms) */
  now: number;
  random: () => number;
}

export interface BoardProps<S, M> {
  state: S;
  mySeat: Seat;
  /** 내 차례인지 (턴제 게임일 때) */
  isMyTurn: boolean;
  /** 게임 종료 등으로 입력 불가 */
  disabled: boolean;
  names: Record<Seat, string>;
  options: GameOptions;
  /** 서버 기준 현재 시각(ms) */
  now: () => number;
  /** silent: 실패해도 알림을 띄우지 않음 (타이머 진행 같은 자동 동작용) */
  onMove: (move: M, opts?: { silent?: boolean }) => void;
}

/**
 * 새 게임을 추가하려면 이 인터페이스를 구현해서 registry.ts 에 등록하면 끝.
 * - 상태(S)는 JSON 직렬화 가능해야 함
 * - applyMove 는 수를 검증하고 다음 상태를 만든다. 트랜잭션 안에서 실행됨
 */
export interface GameDefinition<S = any, M = any> {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  /** 대기실에 보이는 짧은 규칙 요약 (설정값에 따라 달라질 수 있음) */
  rules: string[] | ((options: GameOptions) => string[]);
  /** 방 만들기에서 고를 수 있는 설정 */
  options?: GameOptionSpec[];
  /** 로비 목록에 보일 설정 요약 */
  describeOptions?(options: GameOptions): string;
  /** 그림으로 보는 상세 룰 가이드 (없으면 rules 목록만 보여줌) */
  Guide?: ComponentType<{ options: GameOptions }>;
  setup(ctx: { firstSeat: Seat; random: () => number; options: GameOptions; now: number }): S;
  /** 지금 누구 차례인지. 동시 진행 게임이면 null 반환 */
  currentTurn(state: S): Seat | null;
  applyMove(state: S, move: M, by: Seat, ctx: MoveContext): MoveOutcome<S>;
  /** 게임이 끝났으면 결과, 진행 중이면 null */
  getResult(state: S): GameResult | null;
  /** 선수 카드에 보일 점수 (라운드제 게임 등) */
  scoreOf?(state: S, seat: Seat): string | number;
  /** 게임이 끝난 뒤 결과창을 띄우기까지 기다리는 시간(ms). 마지막 장면을 보여줄 때 사용 */
  resultDelayMs?: number;
  Board: ComponentType<BoardProps<S, M>>;
}

/** 저장된 설정값을 기본값/범위에 맞춰 정리 */
export function resolveOptions(game: GameDefinition, raw?: GameOptions | null): GameOptions {
  const out: GameOptions = {};
  for (const spec of game.options ?? []) {
    let v = Number(raw?.[spec.key]);
    if (!Number.isFinite(v)) v = spec.default;
    if (spec.kind === 'range') v = Math.min(spec.max, Math.max(spec.min, Math.round(v)));
    else if (!spec.choices.some((c) => c.value === v)) v = spec.default;
    out[spec.key] = v;
  }
  return out;
}

export function rulesOf(game: GameDefinition, options: GameOptions): string[] {
  return typeof game.rules === 'function' ? game.rules(options) : game.rules;
}
