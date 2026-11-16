import { useEffect, useReducer, useRef, useState } from 'react';
import { other, type Seat } from '../../backend/types';
import type { BoardProps, GameDefinition, GameOptions } from '../types';
import type { Card } from './cards';
import { CardRow, CardView } from './CardView';
import { generateDeal } from './dealer';
import { Guide } from './Guide';
import { bestPossible, compareHands, evaluate } from './hand';

const READY_MS = 3000;
const SHOWDOWN_MS = 8000;

type Phase = 'ready' | 'reveal' | 'select' | 'showdown';

interface Opt { size: number; revealSec: number; selectSec: number; winRounds: number; }

interface State {
  opt: Opt;
  round: number;
  phase: Phase;
  phaseStart: number;
  deadline: number;
  grid: Card[];
  community: Card[];
  picks: Record<Seat, number[]>;
  submitted: Record<Seat, boolean>;
  /** 시간 안에 2장을 고르지 못한 사람 */
  timedOut: Record<Seat, boolean>;
  outcome: {
    winner: Seat | null;
    /** timeout: 시간 초과로 결정 / same: 두 사람이 같은 2장을 고름 */
    reason: 'hand' | 'timeout' | 'same';
    hands: Record<Seat, { name: string; cards: Card[] } | null>;
  } | null;
  scores: Record<Seat, number>;
  matchWinner: Seat | null;
}

type Move =
  | { type: 'tick'; key: string }
  | { type: 'draft'; picks: number[] }
  | { type: 'submit'; picks: number[] };

const keyOf = (s: State) => `${s.round}:${s.phase}`;
const both = <T,>(v: T): Record<Seat, T> => ({ host: v, guest: v });

function toOpt(o: GameOptions): Opt {
  return { size: o.size ?? 4, revealSec: o.revealSec ?? 20, selectSec: o.selectSec ?? 10, winRounds: o.winRounds ?? 3 };
}

function newRound(s: Pick<State, 'opt' | 'scores'>, round: number, now: number, random: () => number): State {
  const deal = generateDeal(s.opt.size, random);
  return {
    opt: s.opt, scores: s.scores, round, matchWinner: null,
    phase: 'ready', phaseStart: now, deadline: now + READY_MS,
    grid: deal.grid, community: deal.community,
    picks: both([]), submitted: both(false), timedOut: both(false), outcome: null,
  };
}

function validPicks(s: State, picks: unknown, max: number): picks is number[] {
  return Array.isArray(picks) && picks.length <= max && new Set(picks).size === picks.length
    && picks.every((i) => Number.isInteger(i) && i >= 0 && i < s.grid.length);
}

/** 양쪽 선택 공개 & 비교 */
function showdown(s: State, now: number): State {
  // 시간 안에 2장을 고르지 못한 사람은 패배 (둘 다 못 고르면 무승부)
  const timedOut = { host: s.picks.host.length < 2, guest: s.picks.guest.length < 2 };
  const handOf = (seat: Seat) => {
    if (timedOut[seat]) return null;
    const cards = [...s.picks[seat].map((i) => s.grid[i]), ...s.community];
    return { cards, value: evaluate(cards) };
  };
  const h = { host: handOf('host'), guest: handOf('guest') };

  let winner: Seat | null = null;
  let reason: 'hand' | 'timeout' | 'same' = 'hand';
  if (timedOut.host || timedOut.guest) {
    reason = 'timeout';
    winner = timedOut.host && timedOut.guest ? null : timedOut.host ? 'guest' : 'host';
  } else if ([...s.picks.host].sort().join() === [...s.picks.guest].sort().join()) {
    reason = 'same'; // 같은 2장을 골랐으면 무승부
  } else {
    const c = compareHands(h.host!.value, h.guest!.value);
    winner = c > 0 ? 'host' : c < 0 ? 'guest' : null;
  }

  const scores = { ...s.scores };
  if (winner) scores[winner]++;
  const matchWinner = winner && scores[winner] >= s.opt.winRounds ? winner : null;
  const view = (seat: Seat) => (h[seat] ? { name: h[seat]!.value.name, cards: h[seat]!.cards } : null);
  return {
    ...s, timedOut, scores, matchWinner,
    submitted: both(true),
    phase: 'showdown', phaseStart: now, deadline: now + SHOWDOWN_MS,
    outcome: { winner, reason, hands: { host: view('host'), guest: view('guest') } },
  };
}

/* ───────────────────────── 화면 ───────────────────────── */

const PHASE_LABEL: Record<Phase, string> = {
  ready: '준비',
  reveal: '카드를 기억하세요',
  select: '카드 2장을 고르세요',
  showdown: '공개',
};

function useTicker(ms = 200) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => { const t = setInterval(force, ms); return () => clearInterval(t); }, [ms]);
}

function Board({ state: s, mySeat, disabled, now, onMove }: BoardProps<State, Move>) {
  useTicker();
  const nowMs = now();
  const remainMs = Math.max(0, s.deadline - nowMs);
  const total = Math.max(1, s.deadline - s.phaseStart);
  const key = keyOf(s);
  const opp = other(mySeat);

  // 시간이 다 되면 다음 단계로 (양쪽 기기 모두 요청하지만 트랜잭션이라 한 번만 반영됨)
  const sent = useRef({ key: '', at: 0 });
  useEffect(() => {
    if (disabled || remainMs > 0) return;
    if (sent.current.key === key && Date.now() - sent.current.at < 1500) return;
    sent.current = { key, at: Date.now() };
    onMove({ type: 'tick', key }, { silent: true });
  });

  // 내 선택은 화면에 바로 반영하고, 서버에는 조용히 저장 (시간 초과 시 자동 제출용)
  const [sel, setSel] = useState<number[]>([]);
  useEffect(() => { setSel(s.phase === 'select' ? s.picks[mySeat] : []); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const submitted = s.submitted[mySeat];
  const mine = s.phase === 'select' && submitted ? s.picks[mySeat] : sel;

  const tap = (i: number) => {
    if (s.phase !== 'select' || submitted || disabled) return;
    const next = sel.includes(i) ? sel.filter((x) => x !== i) : sel.length < 2 ? [...sel, i] : [sel[1], i];
    setSel(next);
    onMove({ type: 'draft', picks: next }, { silent: true });
  };

  const faceUp = s.phase === 'reveal' || s.phase === 'showdown';
  const showCommunity = s.phase === 'select' || s.phase === 'showdown';
  const secs = Math.ceil(remainMs / 1000);
  const urgent = (s.phase === 'reveal' || s.phase === 'select') && secs <= 3;
  const out = s.outcome;
  const nuts = s.phase === 'showdown' ? bestPossible(s.grid, s.community) : null;

  return (
    <div className={`mp size-${s.opt.size} phase-${s.phase}`}>
      <div className="mp-phase">
        <span className="mp-round">ROUND {s.round}</span>
        <span className="mp-label">{PHASE_LABEL[s.phase]}</span>
        <span className={`mp-secs ${urgent ? 'urgent' : ''}`}>{s.phase === 'showdown' && s.matchWinner ? '' : secs}</span>
        <span className="mp-bar"><i style={{ width: `${(remainMs / total) * 100}%` }} /></span>
      </div>

      <div className="mp-community">
        <span className="mp-community-label">공유 카드</span>
        <span className="mp-community-cards">
          {[0, 1, 2].map((i) => <CardView key={i} card={showCommunity ? s.community[i] : null} faceUp={showCommunity} className="community" />)}
        </span>
      </div>

      <div className="mp-grid" style={{ gridTemplateColumns: `repeat(${s.opt.size}, 1fr)` }}>
        {s.grid.map((c, i) => {
          const marks: Seat[] = s.phase === 'showdown' ? (['host', 'guest'] as Seat[]).filter((st) => s.picks[st].includes(i)) : [];
          const order = s.phase === 'select' && mine.includes(i) ? mine.indexOf(i) + 1 : undefined;
          return (
            <CardView
              key={i}
              card={faceUp ? c : null}
              faceUp={faceUp}
              selected={order !== undefined}
              order={order}
              marks={marks}
              mySeat={mySeat}
              dim={s.phase === 'showdown' && marks.length === 0}
              onClick={s.phase === 'select' ? () => tap(i) : undefined}
              disabled={submitted || disabled}
            />
          );
        })}
        {s.phase === 'ready' && <div className="mp-countdown"><span>ROUND {s.round}</span><b>{secs}</b></div>}
      </div>

      {s.phase === 'select' && (
        <div className="mp-actions">
          <div className="mp-status">
            <span>내 선택 <b>{mine.length}/2</b></span>
            <span className={s.submitted[opp] ? 'done' : ''}>상대 {s.submitted[opp] ? '제출 완료' : '고르는 중…'}</span>
          </div>
          {submitted
            ? <div className="mp-wait">제출 완료 · 상대를 기다리는 중</div>
            : <button className="btn primary block" disabled={sel.length !== 2 || disabled} onClick={() => onMove({ type: 'submit', picks: sel })}>제출</button>}
          <p className="mp-note">2장을 골라 두면 시간이 끝날 때 자동 제출됩니다. 2장을 다 고르지 못하면 이번 라운드는 패배!</p>
        </div>
      )}

      {s.phase === 'reveal' && <p className="mp-note center">{s.opt.size * s.opt.size}장의 위치를 기억하세요. 곧 뒤집힙니다.</p>}

      {s.phase === 'showdown' && out && (
        <div className="mp-showdown">
          <div className={`mp-verdict ${out.winner === null ? 'draw' : out.winner === mySeat ? 'win' : 'lose'}`}>
            {out.winner === null ? 'ROUND DRAW' : out.winner === mySeat ? 'ROUND WIN' : 'ROUND LOSE'}
          </div>
          {out.reason === 'same' && <p className="mp-reason">두 사람이 같은 카드 2장을 골라 무승부</p>}
          {out.reason === 'timeout' && (
            <p className="mp-reason">
              {s.timedOut.host && s.timedOut.guest ? '둘 다 시간 안에 고르지 못해 무승부'
                : `${s.timedOut[mySeat] ? '내가' : '상대가'} 시간 안에 2장을 고르지 못해 패배`}
            </p>
          )}
          {([mySeat, opp] as Seat[]).map((seat) => {
            const hand = out.hands[seat];
            return (
              <div key={seat} className={`mp-hand seat-${seat} ${out.winner === seat ? 'winner' : ''} ${hand ? '' : 'timeout'}`}>
                <div className="mp-hand-head">
                  <span className="who">{seat === mySeat ? '나' : '상대'}</span>
                  <span className="hand-name">{hand ? hand.name : '시간 초과'}</span>
                </div>
                {hand ? <CardRow cards={hand.cards} size="sm" /> : <p className="mp-note">2장을 다 고르지 못했습니다 ({s.picks[seat].length}/2)</p>}
              </div>
            );
          })}
          {nuts && <p className="mp-note center">이번 판 최고 조합: <b>{nuts.hand.name}</b></p>}
          <p className="mp-note center">{s.matchWinner ? '최종 결과를 곧 공개합니다' : `${secs}초 후 다음 라운드`}</p>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── 게임 정의 ───────────────────────── */

export const memoryPoker: GameDefinition<State, Move> = {
  id: 'memory-poker',
  name: '기억 포커',
  emoji: '🃏',
  tagline: '공개된 카드를 기억해 최고의 포커 족보를 완성하라',
  options: [
    { key: 'size', label: '공개 카드 수', kind: 'choice', default: 4, choices: [
      { value: 3, label: '3x3 (9장)' }, { value: 4, label: '4x4 (16장)' }, { value: 5, label: '5x5 (25장)' },
    ] },
    { key: 'revealSec', label: '카드 공개 시간', kind: 'range', default: 20, min: 15, max: 30, unit: '초' },
    { key: 'selectSec', label: '카드 선택 시간', kind: 'range', default: 10, min: 5, max: 20, unit: '초' },
    { key: 'winRounds', label: '승리 조건 (먼저 이기는 라운드 수)', kind: 'choice', default: 3, choices: [
      { value: 1, label: '1승' }, { value: 2, label: '2승' }, { value: 3, label: '3승' }, { value: 5, label: '5승' },
    ] },
  ],
  describeOptions: (o) => `${o.size}x${o.size} · ${o.revealSec}초/${o.selectSec}초 · ${o.winRounds}승`,
  rules: (o) => {
    const { size, revealSec, selectSec, winRounds } = toOpt(o);
    return [
      `${size}x${size} = ${size * size}장의 카드가 ${revealSec}초 동안 공개됩니다.`,
      `카드가 뒤집히면 공유 카드 3장이 나타납니다.`,
      `${selectSec}초 안에 뒤집힌 카드 중 2장을 골라 공유 카드 3장과 함께 5장 족보를 만드세요.`,
      `족보가 높은 쪽이 라운드 승리. 무늬는 비교하지 않습니다.`,
      `시간 안에 2장을 고르지 못하면 패배 (둘 다 못 고르면 무승부). 두 사람이 같은 2장을 고르면 무승부.`,
      `먼저 ${winRounds}라운드를 이기면 최종 승리!`,
    ];
  },
  Guide,
  setup: ({ options, now, random }) =>
    newRound({ opt: toOpt(options), scores: both(0) }, 1, now, random),
  currentTurn: () => null,
  applyMove(s, move, by, { now, random }) {
    if (s.matchWinner) return { ok: false, error: '게임이 끝났습니다.' };
    switch (move.type) {
      case 'tick': {
        if (move.key !== keyOf(s)) return { ok: false, error: 'stale' };
        if (now < s.deadline - 300) return { ok: false, error: 'early' };
        if (s.phase === 'ready') return { ok: true, state: { ...s, phase: 'reveal', phaseStart: now, deadline: now + s.opt.revealSec * 1000 } };
        if (s.phase === 'reveal') return { ok: true, state: { ...s, phase: 'select', phaseStart: now, deadline: now + s.opt.selectSec * 1000 } };
        if (s.phase === 'select') return { ok: true, state: showdown(s, now) };
        return { ok: true, state: newRound(s, s.round + 1, now, random) };
      }
      case 'draft': {
        if (s.phase !== 'select' || s.submitted[by]) return { ok: false, error: '지금은 고를 수 없습니다.' };
        if (!validPicks(s, move.picks, 2)) return { ok: false, error: '잘못된 선택' };
        return { ok: true, state: { ...s, picks: { ...s.picks, [by]: move.picks } } };
      }
      case 'submit': {
        if (s.phase !== 'select') return { ok: false, error: '선택 시간이 끝났습니다.' };
        if (s.submitted[by]) return { ok: false, error: '이미 제출했습니다.' };
        if (!validPicks(s, move.picks, 2) || move.picks.length !== 2) return { ok: false, error: '카드 2장을 골라주세요.' };
        const next = { ...s, picks: { ...s.picks, [by]: move.picks }, submitted: { ...s.submitted, [by]: true } };
        return { ok: true, state: next.submitted[other(by)] ? showdown(next, now) : next };
      }
    }
    return { ok: false, error: '알 수 없는 동작' };
  },
  getResult: (s) => (s.matchWinner ? { winner: s.matchWinner, reason: 'normal' } : null),
  resultDelayMs: 5000,
  scoreOf: (s, seat) => `${s.scores[seat]} / ${s.opt.winRounds}승`,
  Board,
};
