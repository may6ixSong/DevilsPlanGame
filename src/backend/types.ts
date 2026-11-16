/** 1vs1 이므로 좌석은 딱 두 개: 방장(host) 과 도전자(guest) */
export type Seat = 'host' | 'guest';
export const SEATS: Seat[] = ['host', 'guest'];
export const other = (s: Seat): Seat => (s === 'host' ? 'guest' : 'host');

export interface PlayerSlot {
  uid: string;
  name: string;
  ready: boolean;
  connected: boolean;
  lastSeen?: number;
}

export interface GameResult {
  /** null 이면 무승부 */
  winner: Seat | null;
  reason?: 'normal' | 'resign' | 'draw';
}

export interface GameSession {
  /** 게임 상태는 JSON 문자열로 저장 (RTDB 의 배열/null 변형 문제를 피하기 위함) */
  stateJson: string;
  firstSeat: Seat;
  startedAt: number;
  moveCount: number;
  result?: GameResult | null;
}

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface Room {
  id: string;
  title: string;
  gameId: string;
  createdAt: number;
  status: RoomStatus;
  host: PlayerSlot;
  guest?: PlayerSlot | null;
  session?: GameSession | null;
  /** 방장이 방을 만들 때 고른 게임 설정 (예: 공개 시간, 카드 수) */
  options?: Record<string, number> | null;
}

export type Unsub = () => void;

/**
 * 플랫폼이 필요로 하는 최소한의 백엔드 기능.
 * 방 생성 / 구독 / 트랜잭션 / 접속 상태만 있으면 모든 게임 로직은 클라이언트에서 처리된다.
 */
export interface Backend {
  mode: 'firebase' | 'local';
  /** 로그인(익명) 후 uid 반환 */
  init(): Promise<string>;
  subscribeRooms(cb: (rooms: Room[]) => void): Unsub;
  subscribeRoom(id: string, cb: (room: Room | null) => void): Unsub;
  newRoomId(): string;
  setRoom(room: Room): Promise<void>;
  /** 원자적 읽기-수정-쓰기. fn 이 undefined 를 반환하면 중단 */
  transactRoom(id: string, fn: (room: Room) => Room | null | undefined): Promise<{ committed: boolean; room: Room | null }>;
  removeRoom(id: string): Promise<void>;
  /** 내 좌석의 접속 상태(connected)를 유지. 연결이 끊기면 자동으로 false */
  watchPresence(id: string, seat: Seat): Unsub;
  /** 서버 기준 현재 시각(ms). 두 기기의 타이머를 맞추는 데 사용 */
  now(): number;
}

/** DB 에서 읽은 값을 안전한 Room 으로 정규화 */
export function normalizeRoom(id: string, raw: unknown): Room | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Room>;
  if (!r.host || !r.host.uid || !r.gameId) return null;
  return {
    id,
    title: r.title ?? '',
    gameId: r.gameId,
    createdAt: r.createdAt ?? 0,
    status: r.status ?? 'lobby',
    host: { ...r.host, ready: !!r.host.ready, connected: r.host.connected !== false },
    guest: r.guest && r.guest.uid ? { ...r.guest, ready: !!r.guest.ready, connected: r.guest.connected !== false } : null,
    session: r.session && r.session.stateJson ? { ...r.session, result: r.session.result ?? null } : null,
    options: r.options ?? null,
  };
}

/** DB 에 쓰기 전에 id 와 undefined 제거 */
export function serializeRoom(room: Room): Record<string, unknown> {
  const { id: _id, ...rest } = room;
  return JSON.parse(JSON.stringify(rest));
}
