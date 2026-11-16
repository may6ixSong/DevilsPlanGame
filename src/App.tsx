import { useEffect, useState } from 'react';
import { backend } from './backend';
import { ToastProvider } from './components/Toast';
import { useHashRoute, useNickname } from './platform/hooks';
import { LobbyPage } from './pages/LobbyPage';
import { RoomPage } from './pages/RoomPage';
import { NicknamePage } from './pages/NicknamePage';

export function App() {
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useNickname();
  const [editingName, setEditingName] = useState(false);
  const route = useHashRoute();

  useEffect(() => {
    backend.init().then(setUid).catch((e) => setError(String(e?.message ?? e)));
  }, []);

  let body;
  if (error) body = <div className="center-msg">서버 연결 실패<br /><small>{error}</small></div>;
  else if (!uid) body = <div className="center-msg"><div className="spinner" />접속 중…</div>;
  else if (!name || editingName) body = <NicknamePage initial={name} onDone={(n) => { setName(n); setEditingName(false); }} />;
  else if (route.page === 'room') body = <RoomPage key={route.roomId} roomId={route.roomId} uid={uid} name={name} />;
  else body = <LobbyPage uid={uid} name={name} onEditName={() => setEditingName(true)} />;

  return (
    <ToastProvider>
      <div className="app">
        {backend.mode === 'local' && <div className="local-banner">로컬 테스트 모드 · 같은 브라우저의 다른 탭과 대전</div>}
        {body}
      </div>
    </ToastProvider>
  );
}
