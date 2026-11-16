import { useState } from 'react';
import { Brand } from '../components/Brand';

export function NicknamePage({ initial, onDone }: { initial: string; onDone: (n: string) => void }) {
  const [v, setV] = useState(initial);
  const name = v.trim();
  return (
    <div className="page nickname-page">
      <Brand />
      <form className="card" onSubmit={(e) => { e.preventDefault(); if (name) onDone(name.slice(0, 12)); }}>
        <label className="field-label" htmlFor="nick">플레이어 이름</label>
        <input id="nick" className="input" value={v} maxLength={12} autoFocus placeholder="닉네임 (최대 12자)" onChange={(e) => setV(e.target.value)} />
        <button className="btn primary block" disabled={!name}>입장하기</button>
      </form>
    </div>
  );
}
