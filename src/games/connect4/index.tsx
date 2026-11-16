import type { Seat } from '../../backend/types';
import type { BoardProps, GameDefinition } from '../types';

const ROWS = 6, COLS = 7;
interface State { grid: (Seat | null)[]; turn: Seat; last: number | null; winCells: number[] | null; }
type Move = { col: number };

const idx = (r: number, c: number) => r * COLS + c;

function findWin(grid: (Seat | null)[]): number[] | null {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const s = grid[idx(r, c)];
    if (!s) continue;
    for (const [dr, dc] of dirs) {
      const cells = [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k]);
      if (cells.every(([rr, cc]) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && grid[idx(rr, cc)] === s)) {
        return cells.map(([rr, cc]) => idx(rr, cc));
      }
    }
  }
  return null;
}

function Board({ state, isMyTurn, disabled, onMove }: BoardProps<State, Move>) {
  const canDrop = (c: number) => !state.grid[idx(0, c)];
  return (
    <div className="c4-board" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const c = i % COLS;
        const s = state.grid[i];
        return (
          <button
            key={i}
            className={`c4-cell ${state.winCells?.includes(i) ? 'win' : ''} ${state.last === i ? 'last' : ''}`}
            disabled={disabled || !isMyTurn || !canDrop(c)}
            onClick={() => onMove({ col: c })}
            aria-label={`${c + 1}열`}
          >
            <span className={`c4-disc ${s ? `seat-${s}` : ''}`} />
          </button>
        );
      })}
    </div>
  );
}

export const connectFour: GameDefinition<State, Move> = {
  id: 'connect4',
  name: '사목',
  emoji: '🔴',
  tagline: '7x6 판에 말을 떨어뜨려 4개를 먼저 이어라',
  rules: [
    '원하는 열을 누르면 말이 가장 아래 빈칸으로 떨어집니다.',
    '선공은 무작위로 정해집니다.',
    '가로·세로·대각선으로 4개를 먼저 잇는 쪽이 승리합니다.',
  ],
  setup: ({ firstSeat }) => ({ grid: Array(ROWS * COLS).fill(null), turn: firstSeat, last: null, winCells: null }),
  currentTurn: (s) => s.turn,
  applyMove(s, { col }, by) {
    if (s.turn !== by) return { ok: false, error: '내 차례가 아닙니다.' };
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return { ok: false, error: '잘못된 열입니다.' };
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) if (!s.grid[idx(r, col)]) { row = r; break; }
    if (row < 0) return { ok: false, error: '가득 찬 열입니다.' };
    const grid = s.grid.slice();
    grid[idx(row, col)] = by;
    return { ok: true, state: { grid, turn: by === 'host' ? 'guest' : 'host', last: idx(row, col), winCells: findWin(grid) } };
  },
  getResult(s) {
    const w = findWin(s.grid);
    if (w) return { winner: s.grid[w[0]]!, reason: 'normal' };
    if (s.grid.every(Boolean)) return { winner: null, reason: 'draw' };
    return null;
  },
  Board,
};
