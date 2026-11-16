/** 오리지널 엠블럼: 마름모 안의 열쇠 구멍 */
export function Emblem({ size = 44 }: { size?: number }) {
  return (
    <svg className="emblem" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 2 L62 32 L32 62 L2 32 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M32 9 L55 32 L32 55 L9 32 Z" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.55" />
      <circle cx="32" cy="27" r="6" fill="currentColor" />
      <path d="M28.5 30 L26 43 H38 L35.5 30 Z" fill="currentColor" />
    </svg>
  );
}

export function Brand({ hero }: { hero?: boolean }) {
  return (
    <div className={`brand ${hero ? 'hero' : ''}`}>
      <Emblem size={hero ? 84 : 40} />
      <div className="brand-text">
        <span className="brand-mark">DEVIL'S PLAN</span>
        <span className="brand-sub"><i />1 VS 1 GAME<i /></span>
      </div>
    </div>
  );
}
