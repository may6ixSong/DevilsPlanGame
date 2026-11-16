import { backend, other, type Room, type Seat } from '../backend';
import { getGame } from '../games/registry';

export function seatOf(room: Room, uid: string): Seat | null {
  if (room.host.uid === uid) return 'host';
  if (room.guest?.uid === uid) return 'guest';
  return null;
}

export async function createRoom(uid: string, name: string, gameId: string, title: string) {
  const id = backend.newRoomId();
  await backend.setRoom({
    id,
    title: title.trim() || `${name}의 방`,
    gameId,
    createdAt: Date.now(),
    status: 'lobby',
    host: { uid, name, ready: false, connected: true },
    guest: null,
    session: null,
  });
  return id;
}

export type JoinResult = 'ok' | 'full' | 'not-found';

/** 트랜잭션으로 입장 → 동시에 두 명이 눌러도 한 명만 들어갈 수 있음 (자동 풀방) */
export async function joinRoom(id: string, uid: string, name: string): Promise<JoinResult> {
  let reason: JoinResult = 'ok';
  const res = await backend.transactRoom(id, (room) => {
    if (seatOf(room, uid)) { reason = 'ok'; return room; } // 이미 내 자리 (재접속)
    if (room.guest || room.status !== 'lobby') { reason = 'full'; return undefined; }
    reason = 'ok';
    return { ...room, guest: { uid, name, ready: false, connected: true } };
  });
  if (!res.room) return 'not-found';
  if (!res.committed) return reason === 'ok' ? 'full' : reason;
  return reason;
}

export async function leaveRoom(room: Room, uid: string) {
  const seat = seatOf(room, uid);
  if (seat === 'host') return backend.removeRoom(room.id);
  if (seat === 'guest') {
    await backend.transactRoom(room.id, (r) =>
      r.guest?.uid !== uid ? undefined : {
        ...r, guest: null, status: 'lobby', session: null, host: { ...r.host, ready: false },
      });
  }
}

/** Ready 토글. 두 명 모두 Ready 가 되는 순간 같은 트랜잭션 안에서 게임이 시작된다. */
export async function setReady(roomId: string, seat: Seat, ready: boolean) {
  await backend.transactRoom(roomId, (r) => {
    if (r.status !== 'lobby' || !r[seat]) return undefined;
    const next: Room = { ...r, [seat]: { ...r[seat]!, ready } };
    if (next.guest && next.host.ready && next.guest.ready) {
      const game = getGame(r.gameId);
      if (!game) return undefined;
      const firstSeat: Seat = Math.random() < 0.5 ? 'host' : 'guest';
      const state = game.setup({ firstSeat, random: Math.random });
      next.status = 'playing';
      next.session = { stateJson: JSON.stringify(state), firstSeat, startedAt: Date.now(), moveCount: 0, result: null };
    }
    return next;
  });
}

export async function makeMove(roomId: string, seat: Seat, move: unknown): Promise<string | null> {
  let error: string | null = null;
  await backend.transactRoom(roomId, (r) => {
    error = null;
    if (r.status !== 'playing' || !r.session) { error = '진행 중인 게임이 없습니다.'; return undefined; }
    const game = getGame(r.gameId);
    if (!game) { error = '알 수 없는 게임'; return undefined; }
    const out = game.applyMove(JSON.parse(r.session.stateJson), move, seat);
    if (!out.ok) { error = out.error; return undefined; }
    const result = game.getResult(out.state);
    return {
      ...r,
      status: result ? 'finished' : 'playing',
      session: { ...r.session, stateJson: JSON.stringify(out.state), moveCount: r.session.moveCount + 1, result },
    };
  });
  return error;
}

export async function resign(roomId: string, seat: Seat) {
  await backend.transactRoom(roomId, (r) =>
    r.status !== 'playing' || !r.session ? undefined : {
      ...r, status: 'finished', session: { ...r.session, result: { winner: other(seat), reason: 'resign' } },
    });
}

/** 게임 종료 후 대기실로 돌아가기 (다시 둘 다 Ready 하면 재대결) */
export async function backToLobby(roomId: string) {
  await backend.transactRoom(roomId, (r) =>
    r.status !== 'finished' ? undefined : {
      ...r, status: 'lobby', session: null,
      host: { ...r.host, ready: false },
      guest: r.guest ? { ...r.guest, ready: false } : null,
    });
}

/** 방장이 연결이 끊긴 지 오래된 방은 누구나 정리할 수 있다 (무료 용량 관리) */
const STALE_MS = 10 * 60 * 1000;
export function isStale(room: Room, now = Date.now()) {
  if (now - room.createdAt > 24 * 60 * 60 * 1000) return true;
  return !room.host.connected && now - (room.host.lastSeen ?? room.createdAt) > STALE_MS;
}
