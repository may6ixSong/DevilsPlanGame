import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {
  getDatabase, ref, onValue, set, remove, runTransaction, onDisconnect,
  update, push, query, orderByChild, limitToLast, serverTimestamp,
} from 'firebase/database';
import { normalizeRoom, serializeRoom, type Backend, type Room, type Seat } from './types';

export function createFirebaseBackend(config: FirebaseOptions): Backend {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app);
  const roomRef = (id: string) => ref(db, `rooms/${id}`);

  return {
    mode: 'firebase',

    init() {
      return new Promise<string>((resolve, reject) => {
        const off = onAuthStateChanged(auth, (user) => {
          if (user) { off(); resolve(user.uid); }
        });
        signInAnonymously(auth).catch((e) => { off(); reject(e); });
      });
    },

    subscribeRooms(cb) {
      // 최근 50개 방만 구독 → 무료 다운로드 용량 절약
      const q = query(ref(db, 'rooms'), orderByChild('createdAt'), limitToLast(50));
      return onValue(q, (snap) => {
        const rooms: Room[] = [];
        snap.forEach((child) => {
          const r = normalizeRoom(child.key!, child.val());
          if (r) rooms.push(r);
        });
        cb(rooms.reverse());
      });
    },

    subscribeRoom(id, cb) {
      return onValue(roomRef(id), (snap) => cb(normalizeRoom(id, snap.val())));
    },

    newRoomId() {
      return push(ref(db, 'rooms')).key!;
    },

    async setRoom(room) {
      await set(roomRef(room.id), serializeRoom(room));
    },

    async transactRoom(id, fn) {
      const res = await runTransaction(roomRef(id), (raw) => {
        // 로컬 캐시가 비어 있으면 raw 가 null 로 먼저 호출된다.
        // null 을 그대로 돌려주면 SDK 가 서버 값으로 다시 호출해준다.
        if (raw === null) return null;
        const room = normalizeRoom(id, raw);
        if (!room) return undefined;
        const next = fn(room);
        if (next === undefined) return undefined;
        return next === null ? null : serializeRoom(next);
      });
      const room = normalizeRoom(id, res.snapshot.val());
      return { committed: res.committed && room !== null, room };
    },

    async removeRoom(id) {
      await remove(roomRef(id));
    },

    watchPresence(id: string, seat: Seat) {
      const slotRef = ref(db, `rooms/${id}/${seat}`);
      const off = onValue(ref(db, '.info/connected'), (snap) => {
        if (snap.val() !== true) return;
        onDisconnect(slotRef)
          .update({ connected: false, lastSeen: serverTimestamp() })
          .then(() => update(slotRef, { connected: true }))
          .catch(() => {});
      });
      return () => {
        off();
        onDisconnect(slotRef).cancel().catch(() => {});
      };
    },
  };
}
