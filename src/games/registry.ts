import type { GameDefinition } from './types';
import { ticTacToe } from './tictactoe';
import { connectFour } from './connect4';

/** ▶ 새 게임은 여기에 추가하면 방 만들기 목록에 자동으로 나타납니다. */
export const GAMES: GameDefinition[] = [ticTacToe, connectFour];

export const getGame = (id: string) => GAMES.find((g) => g.id === id);
