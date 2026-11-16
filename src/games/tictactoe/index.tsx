import type { Seat } from '../../backend/types';
import type { BoardProps, GameDefinition } from '../types';

interface State { cells: (Seat | null)[]; turn: Seat; winLine: number[] | null; }
type Move = { cell: number };

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function findWin(cells: (Seat | null)[]) {
  return LINES.find(([a, b, c]) => cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) ?? null;
}

function Board({ state, mySeat, isMyTurn, disabled, onMove }: BoardProps<State, Move>) {
  return (
    <div className="ttt-board">
      {state.cells.map((c, i) => (
        <button
          key={i}
          className={`ttt-cell ${c ? `seat-${c}` : ''} ${state.winLine?.includes(i) ? 'win' : ''}`}
          disabled={disabled || !isMyTurn || !!c}
          onClick={() => onMove({ cell: i })}
          aria-label={`칸 ${i + 1}`}
        >
          {c ? (c === 'host' ? '✕' : '◯') : ''}
          {!c && isMyTurn && !disabled && <span className="ghost">{mySeat === 'host' ? '✕' : '◯'}</span>}
        </button>
      ))}
    </div>
  );
}

export const ticTacToe: GameDefinition<State, Move> = {
  id: 'tictactoe',
  name: '틱택토',
  emoji: '⭕',
  tagline: '3x3, 먼저 한 줄을 만드는 사람이 승리',
  rules: [
    '방장은 ✕, 도전자는 ◯ 를 사용합니다.',
    '선공은 무작위로 정해집니다.',
    '가로·세로·대각선으로 3개를 먼저 잇는 쪽이 승리합니다.',
  ],
  setup: ({ firstSeat }) => ({ cells: Array(9).fill(null), turn: firstSeat, winLine: null }),
  currentTurn: (s) => s.turn,
  applyMove(s, { cell }, by) {
    if (s.turn !== by) return { ok: false, error: '내 차례가 아닙니다.' };
    if (!Number.isInteger(cell) || cell < 0 || cell > 8 || s.cells[cell]) return { ok: false, error: '둘 수 없는 칸입니다.' };
    const cells = s.cells.slice();
    cells[cell] = by;
    return { ok: true, state: { cells, turn: by === 'host' ? 'guest' : 'host', winLine: findWin(cells) } };
  },
  getResult(s) {
    const line = findWin(s.cells);
    if (line) return { winner: s.cells[line[0]]!, reason: 'normal' };
    if (s.cells.every(Boolean)) return { winner: null, reason: 'draw' };
    return null;
  },
  Board,
};
