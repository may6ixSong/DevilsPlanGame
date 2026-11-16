import { useEffect, useState } from 'react';
import { backend, type Room } from '../backend';

export function useHashRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const m = hash.match(/^#\/room\/([\w-]+)/);
  return m ? { page: 'room' as const, roomId: m[1] } : { page: 'lobby' as const };
}

export const goLobby = () => { location.hash = '#/'; };
export const goRoom = (id: string) => { location.hash = `#/room/${id}`; };

export function useRooms() {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  useEffect(() => backend.subscribeRooms(setRooms), []);
  return rooms;
}

/** undefined = 로딩 중, null = 방 없음 */
export function useRoom(id: string) {
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  useEffect(() => {
    setRoom(undefined);
    return backend.subscribeRoom(id, setRoom);
  }, [id]);
  return room;
}

const NAME_KEY = 'dp1v1:nickname';
export function useNickname() {
  const [name, setNameState] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const setName = (n: string) => { localStorage.setItem(NAME_KEY, n); setNameState(n); };
  return [name, setName] as const;
}
