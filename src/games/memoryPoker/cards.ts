/** 카드 표기: 숫자 + 무늬. 예) 'As' = 스페이드 A, 'Th' = 하트 10 */
export type Card = string;
export const RANKS = '23456789TJQKA';
export const SUITS = 'shdc'; // ♠ ♥ ♦ ♣

export const rankOf = (c: Card) => RANKS.indexOf(c[0]) + 2; // 2..14
export const suitOf = (c: Card) => c[1];
export const rankLabel = (c: Card) => (c[0] === 'T' ? '10' : c[0]);
export const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const isRed = (c: Card) => c[1] === 'h' || c[1] === 'd';
export const cardName = (c: Card) => `${SUIT_SYMBOL[suitOf(c)]}${rankLabel(c)}`;
export const card = (rank: number, suit: string): Card => RANKS[rank - 2] + suit;

export function fullDeck(): Card[] {
  const d: Card[] = [];
  for (const r of RANKS) for (const s of SUITS) d.push(r + s);
  return d;
}

export function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
