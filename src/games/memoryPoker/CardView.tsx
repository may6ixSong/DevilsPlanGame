import type { Seat } from '../../backend/types';
import { isRed, rankLabel, SUIT_SYMBOL, suitOf, type Card } from './cards';

interface Props {
  card?: Card | null;
  faceUp: boolean;
  selected?: boolean;
  order?: number;
  marks?: Seat[];
  mySeat?: Seat;
  highlight?: boolean;
  dim?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/** 실제 트럼프 카드 모양. faceUp 이 바뀌면 3D 로 뒤집힌다 */
export function CardView({ card, faceUp, selected, order, marks, mySeat, highlight, dim, onClick, disabled, className = '' }: Props) {
  const cls = `pcard ${faceUp && card ? 'up' : ''} ${selected ? 'selected' : ''} ${highlight ? 'hl' : ''} ${dim ? 'dim' : ''} ${onClick ? 'tap' : ''} ${className}`;
  const inner = (
    <span className="pcard-inner">
      <span className="pcard-back" />
      {card && (
        <span className={`pcard-face ${isRed(card) ? 'red' : ''}`}>
          <span className="pc-corner">{rankLabel(card)}<i>{SUIT_SYMBOL[suitOf(card)]}</i></span>
          <span className="pc-pip">{SUIT_SYMBOL[suitOf(card)]}</span>
        </span>
      )}
    </span>
  );
  const overlay = (
    <>
      {order !== undefined && <span className="pc-order">{order}</span>}
      {marks && marks.length > 0 && (
        <span className="pc-marks">
          {marks.map((s) => <b key={s} className={`seat-${s}`}>{s === mySeat ? '나' : '상대'}</b>)}
        </span>
      )}
    </>
  );
  return onClick
    ? <button className={cls} onClick={onClick} disabled={disabled} aria-label={faceUp && card ? card : '뒤집힌 카드'}>{inner}{overlay}</button>
    : <span className={cls}>{inner}{overlay}</span>;
}

export function CardRow({ cards, size = 'sm', highlight }: { cards: Card[]; size?: 'xs' | 'sm' | 'md'; highlight?: Card[] }) {
  return (
    <span className={`card-row ${size}`}>
      {cards.map((c) => <CardView key={c} card={c} faceUp highlight={highlight?.includes(c)} />)}
    </span>
  );
}
