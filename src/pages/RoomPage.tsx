import { useEffect, useMemo, useRef, useState } from 'react';
import { backend, other, SEATS, type Room, type Seat } from '../backend';
import { useToast } from '../components/Toast';
import { getGame } from '../games/registry';
import { goLobby, useRoom } from '../platform/hooks';
import { backToLobby, joinRoom, leaveRoom, makeMove, resign, seatOf, setReady } from '../platform/roomActions';

export function RoomPage({ roomId, uid, name }: { roomId: string; uid: string; name: string }) {
  const room = useRoom(roomId);
  const toast = useToast();
  const [joinError, setJoinError] = useState<string | null>(null);
  const triedJoin = useRef(false);
  const seat = room ? seatOf(room, uid) : null;
  const wasSeated = useRef(false);
  const leaving = useRef(false);
  if (seat) wasSeated.current = true;

  // 초대 링크로 바로 들어온 경우 자동 입장 시도
  useEffect(() => {
    if (!room || seat || triedJoin.current || wasSeated.current || leaving.current) return;
    triedJoin.current = true;
    joinRoom(roomId, uid, name).then((r) => {
      if (r !== 'ok') setJoinError(r === 'full' ? '이미 가득 찬 방입니다. (1vs1 전용)' : '방을 찾을 수 없습니다.');
    });
  }, [room, seat, roomId, uid, name]);

  // 내 좌석 접속 상태 유지
  const presenceOff = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!seat) return;
    const off = backend.watchPresence(roomId, seat);
    presenceOff.current = off;
    return () => { off(); presenceOff.current = null; };
  }, [roomId, seat]);

  // 내가 쫓겨났거나(상대 방장이 방을 닫음) 방이 사라진 경우
  useEffect(() => {
    if (leaving.current) return;
    if (room === null && wasSeated.current) { toast('방장이 방을 닫았습니다.'); goLobby(); }
    else if (room && !seat && wasSeated.current) { toast('방에서 퇴장되었습니다.'); goLobby(); }
  }, [room, seat, toast]);

  const leave = async () => {
    if (room?.status === 'playing' && !confirm('게임 중입니다. 나가면 방에서 퇴장합니다. 나갈까요?')) return;
    leaving.current = true;
    presenceOff.current?.();
    if (room) await leaveRoom(room, uid).catch(() => {});
    goLobby();
  };

  if (room === undefined) return <div className="center-msg"><div className="spinner" />방 불러오는 중…</div>;
  if (room === null || joinError) {
    return (
      <div className="center-msg">
        {joinError ?? '방이 존재하지 않습니다.'}
        <button className="btn primary" onClick={goLobby}>로비로</button>
      </div>
    );
  }
  if (!seat) return <div className="center-msg"><div className="spinner" />입장 중…</div>;

  const game = getGame(room.gameId);
  if (!game) return <div className="center-msg">지원하지 않는 게임입니다: {room.gameId}<button className="btn" onClick={leave}>나가기</button></div>;

  return (
    <div className="page room-page">
      <header className="room-header">
        <button className="icon-btn" onClick={leave} aria-label="나가기">←</button>
        <div className="room-header-title">
          <div className="room-title">{room.title}</div>
          <div className="room-meta">{game.emoji} {game.name}</div>
        </div>
        <InviteButton roomId={room.id} />
      </header>
      {room.status === 'lobby'
        ? <WaitingRoom room={room} seat={seat} />
        : <GameView room={room} seat={seat} onLeave={leave} />}
    </div>
  );
}

function InviteButton({ roomId }: { roomId: string }) {
  const toast = useToast();
  const share = async () => {
    const url = `${location.origin}${location.pathname}${location.search}#/room/${roomId}`;
    try {
      if (navigator.share) await navigator.share({ title: '데블스 플랜 1vs1 Game', text: '1vs1 대결 신청!', url });
      else { await navigator.clipboard.writeText(url); toast('초대 링크를 복사했습니다.'); }
    } catch { /* 공유 취소 */ }
  };
  return <button className="icon-btn" onClick={share} aria-label="초대하기">🔗</button>;
}

function PlayerCard({ room, seat, mySeat, active }: { room: Room; seat: Seat; mySeat: Seat; active?: boolean }) {
  const p = room[seat];
  const label = seat === 'host' ? '방장' : '도전자';
  return (
    <div className={`player-card seat-${seat} ${active ? 'active' : ''} ${p ? '' : 'empty'}`}>
      <div className="player-role">{label}{seat === mySeat && ' · 나'}</div>
      <div className="player-name">{p ? p.name : '대기 중…'}</div>
      {p && room.status === 'lobby' && (
        <div className={`ready-tag ${p.ready ? 'on' : ''}`}>{p.ready ? 'READY' : 'NOT READY'}</div>
      )}
      {p && !p.connected && <div className="disconnected">연결 끊김</div>}
    </div>
  );
}

function WaitingRoom({ room, seat }: { room: Room; seat: Seat }) {
  const game = getGame(room.gameId)!;
  const me = room[seat]!;
  const [busy, setBusy] = useState(false);
  const toggle = async () => { setBusy(true); try { await setReady(room.id, seat, !me.ready); } finally { setBusy(false); } };
  const hint = !room.guest ? '상대를 기다리는 중입니다. 🔗 버튼으로 초대 링크를 보내보세요.'
    : me.ready ? '상대가 READY 하면 게임이 바로 시작됩니다.'
    : '둘 다 READY 하면 게임이 시작됩니다.';

  return (
    <>
      <div className="vs-row">
        <PlayerCard room={room} seat="host" mySeat={seat} />
        <div className="vs">VS</div>
        <PlayerCard room={room} seat="guest" mySeat={seat} />
      </div>
      <section className="card rules">
        <h3>{game.emoji} {game.name} 규칙</h3>
        <ul>{game.rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </section>
      <div className="bottom-bar">
        <p className="hint">{hint}</p>
        <button className={`btn block big ${me.ready ? 'ghost' : 'primary'}`} disabled={busy} onClick={toggle}>
          {me.ready ? 'READY 취소' : 'READY'}
        </button>
      </div>
    </>
  );
}

function GameView({ room, seat, onLeave }: { room: Room; seat: Seat; onLeave: () => void }) {
  const game = getGame(room.gameId)!;
  const toast = useToast();
  const session = room.session!;
  const state = useMemo(() => JSON.parse(session.stateJson), [session.stateJson]);
  const turn = game.currentTurn(state);
  const finished = room.status === 'finished';
  const result = session.result;
  const opp = room[other(seat)];
  const names = { host: room.host.name, guest: room.guest?.name ?? '-' };
  const [sending, setSending] = useState(false);

  const onMove = async (move: unknown) => {
    if (sending) return;
    setSending(true);
    const err = await makeMove(room.id, seat, move).finally(() => setSending(false));
    if (err) toast(err);
  };

  let status = '';
  if (finished && result) {
    status = result.winner === null ? '무승부' : result.winner === seat ? '승리!' : '패배';
  } else if (turn) status = turn === seat ? '내 차례' : `${names[turn]} 차례`;
  else status = '진행 중';

  return (
    <>
      <div className="vs-row compact">
        {SEATS.map((s) => <PlayerCard key={s} room={room} seat={s} mySeat={seat} active={!finished && turn === s} />)}
      </div>
      <div className={`turn-banner ${!finished && turn === seat ? 'mine' : ''}`}>{status}</div>
      {!opp?.connected && !finished && <div className="warn">상대의 연결이 끊겼습니다. 재접속을 기다리는 중…</div>}

      <div className="board-wrap">
        <game.Board
          state={state}
          mySeat={seat}
          isMyTurn={turn === null || turn === seat}
          disabled={finished || sending}
          names={names}
          onMove={onMove}
        />
      </div>

      {!finished && (
        <div className="bottom-bar">
          <button className="btn ghost block" onClick={() => confirm('기권하시겠습니까?') && resign(room.id, seat)}>기권</button>
        </div>
      )}

      {finished && result && <div style={{ height: 190 }} />}
      {finished && result && (
        <div className="result-overlay">
          <div className={`result-card ${result.winner === null ? 'draw' : result.winner === seat ? 'win' : 'lose'}`}>
            <div className="result-title">{status}</div>
            <div className="result-sub">
              {result.winner === null ? '승부가 나지 않았습니다.'
                : `${names[result.winner]} 승리${result.reason === 'resign' ? ' (기권승)' : ''}`}
            </div>
            <div className="row">
              <button className="btn ghost" onClick={onLeave}>나가기</button>
              <button className="btn primary grow" onClick={() => backToLobby(room.id)}>대기실로 (재대결)</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
