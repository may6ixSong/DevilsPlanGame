import { normalizeRoom, serializeRoom, type Backend, type Room, type Unsub } from './types';

/**
 * Firebase 설정 없이 테스트할 수 있는 로컬 백엔드.
 * 같은 브라우저의 서로 다른 탭끼리 localStorage 로 방을 공유한다.
 * (탭마다 uid 가 다르도록 sessionStorage 에 uid 저장)
 */
const KEY = 'dp1v1:local-rooms';

type RoomMap = Record<string, Record<string, unknown>>;

function readAll(): RoomMap {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function createLocalBackend(): Backend {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  const writeAll = (m: RoomMap) => { localStorage.setItem(KEY, JSON.stringify(m)); notify(); };
  window.addEventListener('storage', (e) => { if (e.key === KEY) notify(); });

  const listen = (fn: () => void): Unsub => {
    listeners.add(fn);
    fn();
    return () => listeners.delete(fn);
  };

  const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  return {
    mode: 'local',
    now: () => Date.now(),

    async init() {
      let uid = sessionStorage.getItem('dp1v1:local-uid');
      if (!uid) { uid = 'local-' + randomId(); sessionStorage.setItem('dp1v1:local-uid', uid); }
      return uid;
    },

    subscribeRooms(cb) {
      return listen(() => {
        const all = readAll();
        const rooms = Object.entries(all)
          .map(([id, raw]) => normalizeRoom(id, raw))
          .filter((r): r is Room => !!r)
          .sort((a, b) => b.createdAt - a.createdAt);
        cb(rooms);
      });
    },

    subscribeRoom(id, cb) {
      let last = '';
      return listen(() => {
        const raw = readAll()[id];
        const s = JSON.stringify(raw ?? null);
        if (s === last) return;
        last = s;
        cb(normalizeRoom(id, raw));
      });
    },

    newRoomId: randomId,

    async setRoom(room) {
      const all = readAll();
      all[room.id] = serializeRoom(room);
      writeAll(all);
    },

    async transactRoom(id, fn) {
      const all = readAll();
      const room = normalizeRoom(id, all[id]);
      if (!room) return { committed: false, room: null };
      const next = fn(room);
      if (next === undefined) return { committed: false, room };
      if (next === null) delete all[id];
      else all[id] = serializeRoom(next);
      writeAll(all);
      return { committed: true, room: next };
    },

    async removeRoom(id) {
      const all = readAll();
      delete all[id];
      writeAll(all);
    },

    watchPresence(id, seat) {
      const setConnected = (connected: boolean) => {
        const all = readAll();
        const r = all[id] as any;
        if (r?.[seat]) { r[seat].connected = connected; r[seat].lastSeen = Date.now(); writeAll(all); }
      };
      setConnected(true);
      const onHide = () => setConnected(false);
      const onShow = () => setConnected(true);
      window.addEventListener('pagehide', onHide);
      window.addEventListener('pageshow', onShow);
      return () => {
        window.removeEventListener('pagehide', onHide);
        window.removeEventListener('pageshow', onShow);
      };
    },
  };
}
