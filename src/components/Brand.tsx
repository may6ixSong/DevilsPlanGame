export function Brand({ small }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? 'small' : ''}`}>
      <span className="brand-mark">DEVIL'S PLAN</span>
      <span className="brand-sub">1<em>vs</em>1 Game</span>
    </div>
  );
}
