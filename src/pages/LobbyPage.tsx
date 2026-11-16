import { useEffect, useState } from 'react';
import { backend, type Room } from '../backend';
import { Brand } from '../components/Brand';
import { useToast } from '../components/Toast';
import { GAMES, getGame } from '../games/registry';
import { goRoom, useRooms } from '../platform/hooks';
import { createRoom, isStale, joinRoom, seatOf } from '../platform/roomActions';
import { resolveOptions, type GameOptions } from '../games/types';

export function LobbyPage({ uid, name, onEditName }: { uid: string; name: string; onEditName: () => void }) {
  const rooms = useRooms();
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  // 방장이 떠난 지 오래된 방은 정리 (무료 DB 용량 관리)
  useEffect(() => {
    rooms?.filter((r) => isStale(r) && r.host.uid !== uid).forEach((r) => backend.removeRoom(r.id).catch(() => {}));
  }, [rooms, uid]);

  const visible = rooms?.filter((r) => !isStale(r) && (r.host.connected || seatOf(r, uid)));

  const enter = async (room: Room) => {
    const res = await joinRoom(room.id, uid, name);
    if (res === 'ok') goRoom(room.id);
    else toast(res === 'full' ? '이미 가득 찬 방입니다.' : '방이 사라졌습니다.');
  };

  return (
    <div className="page">
      <header className="lobby-header">
        <Brand />
        <button className="chip" onClick={onEditName}>{name}</button>
      </header>

      <button className="btn primary block big" onClick={() => setCreating(true)}>게임방 개설</button>

      <h2 className="section-title"><span>GAME ROOMS</span><span className="muted">{visible?.length ?? ''}</span></h2>
      {!visible ? (
        <div className="center-msg"><div className="spinner" /></div>
      ) : visible.length === 0 ? (
        <div className="empty">열린 방이 없습니다.<br />직접 방을 만들어 상대를 기다려보세요.</div>
      ) : (
        <ul className="room-list">
          {visible.map((r) => {
            const g = getGame(r.gameId);
            const mine = !!seatOf(r, uid);
            const full = !!r.guest || r.status !== 'lobby';
            const badge = r.status !== 'lobby' ? 'IN GAME' : full ? 'FULL' : 'OPEN';
            return (
              <li key={r.id}>
                <button className="room-item" disabled={full && !mine} onClick={() => enter(r)}>
                  <span className="room-emoji">{g?.emoji ?? '🎲'}</span>
                  <span className="room-main">
                    <span className="room-title">{r.title}</span>
                    <span className="room-meta">{g?.name ?? r.gameId}{g?.describeOptions ? ` (${g.describeOptions(resolveOptions(g, r.options))})` : ''} · {r.host.name}</span>
                  </span>
                  <span className={`badge ${full ? 'full' : 'open'}`}>{mine ? 'MY ROOM' : badge}</span>
                  <span className="room-count">{r.guest ? 2 : 1}/2</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <CreateRoomSheet
          defaultTitle={`${name}의 방`}
          onClose={() => setCreating(false)}
          onCreate={async (gameId, title, options) => {
            const id = await createRoom(uid, name, gameId, title, options);
            goRoom(id);
          }}
        />
      )}
    </div>
  );
}

function CreateRoomSheet({ defaultTitle, onClose, onCreate }: {
  defaultTitle: string; onClose: () => void; onCreate: (gameId: string, title: string, options: GameOptions) => Promise<void>;
}) {
  const [gameId, setGameId] = useState(GAMES[0].id);
  const game = GAMES.find((g) => g.id === gameId)!;
  const [options, setOptions] = useState<GameOptions>(() => resolveOptions(game));
  const pick = (id: string) => { setGameId(id); setOptions(resolveOptions(GAMES.find((g) => g.id === id)!)); };
  const setOpt = (k: string, v: number) => setOptions((o) => ({ ...o, [k]: v }));
  const [title, setTitle] = useState(defaultTitle);
  const [busy, setBusy] = useState(false);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="방 만들기">
        <div className="sheet-handle" />
        <h2 className="sheet-title">게임방 개설</h2>
        <label className="field-label">게임 선택</label>
        <div className="game-grid">
          {GAMES.map((g) => (
            <button key={g.id} className={`game-card ${g.id === gameId ? 'selected' : ''}`} onClick={() => pick(g.id)}>
              <span className="game-emoji">{g.emoji}</span>
              <span className="game-name">{g.name}</span>
              <span className="game-tag">{g.tagline}</span>
            </button>
          ))}
        </div>
        {game.options?.map((spec) => (
          <div key={spec.key} className="opt">
            <label className="field-label">
              {spec.label}
              {spec.kind === 'range' && <b className="opt-value">{options[spec.key]}{spec.unit}</b>}
            </label>
            {spec.kind === 'choice' ? (
              <div className="seg">
                {spec.choices.map((c) => (
                  <button key={c.value} className={options[spec.key] === c.value ? 'on' : ''} onClick={() => setOpt(spec.key, c.value)}>{c.label}</button>
                ))}
              </div>
            ) : (
              <div className="range-row">
                <span>{spec.min}{spec.unit}</span>
                <input type="range" min={spec.min} max={spec.max} step={spec.step ?? 1} value={options[spec.key]}
                  aria-label={spec.label} onChange={(e) => setOpt(spec.key, Number(e.target.value))} />
                <span>{spec.max}{spec.unit}</span>
              </div>
            )}
          </div>
        ))}
        <label className="field-label" htmlFor="room-title">방 제목</label>
        <input id="room-title" className="input" value={title} maxLength={24} onChange={(e) => setTitle(e.target.value)} />
        <div className="row">
          <button className="btn ghost" onClick={onClose}>취소</button>
          <button className="btn primary grow" disabled={busy} onClick={async () => { setBusy(true); try { await onCreate(gameId, title, options); } finally { setBusy(false); } }}>
            개설
          </button>
        </div>
      </div>
    </div>
  );
}
