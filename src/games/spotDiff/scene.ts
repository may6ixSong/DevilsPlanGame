/**
 * 틀린 그림 찾기 장면 생성기.
 * 시드(숫자) 하나로 같은 그림이 항상 똑같이 만들어지고, 정확히 5군데만 바뀐 두 번째 그림과
 * 각 차이의 위치(정답 영역)를 함께 돌려준다. → 이미지 파일을 저장할 필요 없이 시드만 공유하면 된다.
 */

export const W = 1600;
export const H = 900;

type Rand = () => number;
export function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: Rand, arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
const between = (r: Rand, lo: number, hi: number) => lo + r() * (hi - lo);

/* ───────── 색 ───────── */
export const PALETTE = {
  red: '#e2493f', orange: '#f28c28', yellow: '#f6c945', lime: '#9ccc45', green: '#4caf50',
  teal: '#2bb3a3', sky: '#4fb3e8', blue: '#3a6fd8', purple: '#8c5bd6', pink: '#ef7fb0',
  brown: '#9a6234', cream: '#f4e7c8', white: '#fbfaf6', gray: '#9aa0a6', navy: '#2d3b6b',
} as const;
type ColorName = keyof typeof PALETTE;
const BRIGHT: ColorName[] = ['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'sky', 'blue', 'purple', 'pink'];
const HUE_GROUP: Record<string, number> = { red: 0, pink: 0, orange: 1, yellow: 1, brown: 1, lime: 2, green: 2, teal: 3, sky: 3, blue: 4, navy: 4, purple: 5, cream: 6, white: 6, gray: 6 };
/** 원래 색과 확실히 구분되는 다른 색 */
function contrastColor(r: Rand, c: ColorName): ColorName {
  const opts = BRIGHT.filter((x) => HUE_GROUP[x] !== HUE_GROUP[c]);
  return pick(r, opts);
}

const INK = '#2b2420';
const O = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"`;
const col = (c: ColorName) => PALETTE[c];

/* ───────── 물체 ───────── */
export interface Item {
  id: number;
  kind: string;
  x: number;
  y: number;
  s: number;
  flip: boolean;
  hidden: boolean;
  colors: Record<string, ColorName>;
  flags: Record<string, boolean>;
}

type Mutation = 'color' | 'remove' | 'size' | 'flip' | `flag:${string}`;

interface Kind {
  /** (0,0) 기준, 크기 1 일 때의 영역 [x0, y0, x1, y1] */
  box: [number, number, number, number];
  render(it: Item): string;
  mutations: Mutation[];
  /** 차이를 설명하는 말 (정답 확인 화면용) */
  describe?: Partial<Record<string, string>>;
}

const KINDS: Record<string, Kind> = {
  sun: {
    box: [-95, -95, 95, 95],
    render: (it) => {
      const rays = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return `<line x1="${Math.cos(a) * 70}" y1="${Math.sin(a) * 70}" x2="${Math.cos(a) * 92}" y2="${Math.sin(a) * 92}" ${O}/>`;
      }).join('');
      const face = it.flags.face ? `<circle cx="-18" cy="-8" r="5" fill="${INK}"/><circle cx="18" cy="-8" r="5" fill="${INK}"/><path d="M-22 14 Q0 32 22 14" fill="none" ${O}/>` : '';
      return `${it.flags.rays ? rays : ''}<circle r="58" fill="${col(it.colors.body)}" ${O}/>${face}`;
    },
    mutations: ['color', 'flag:rays', 'flag:face'],
  },
  cloud: {
    box: [-110, -60, 110, 30],
    render: (it) => `<path d="M-95 25 Q-112 -10 -70 -15 Q-60 -58 -12 -45 Q20 -75 55 -40 Q105 -45 100 0 Q115 25 85 25 Z" fill="${col(it.colors.body)}" ${O}/>${it.flags.puff ? `<path d="M-40 25 Q-40 0 -10 5" fill="none" ${O}/>` : ''}`,
    mutations: ['remove', 'size', 'flag:puff'],
  },
  bird: {
    box: [-32, -18, 32, 6],
    render: () => `<path d="M-30 0 Q-15 -18 0 0 Q15 -18 30 0" fill="none" ${O}/>`,
    mutations: ['remove'],
  },
  kite: {
    box: [-50, -70, 70, 190],
    render: (it) => {
      const bows = it.flags.bows ? 3 : 2;
      const tail = `<path d="M0 70 Q30 110 0 140 Q-30 170 10 190" fill="none" ${O}/>`;
      const b = [[18, 100], [-14, 150], [8, 182]].slice(0, bows)
        .map(([bx, by]) => `<path d="M${bx - 12} ${by - 8} L${bx + 12} ${by + 8} L${bx + 12} ${by - 8} L${bx - 12} ${by + 8} Z" fill="${col(it.colors.accent)}" ${O}/>`).join('');
      return `${tail}${b}<path d="M0 -70 L48 0 L0 70 L-48 0 Z" fill="${col(it.colors.body)}" ${O}/><path d="M0 -70 L0 70 M-48 0 L48 0" ${O}/>`;
    },
    mutations: ['color', 'flag:bows', 'flip'],
  },
  house: {
    box: [-140, -330, 140, 0],
    render: (it) => {
      const win = (x: number, cross: boolean) => `<rect x="${x}" y="-140" width="56" height="56" fill="#cfe9f7" ${O}/>${cross ? `<path d="M${x + 28} -140 V-84 M${x} -112 H${x + 56}" ${O}/>` : ''}`;
      const chimney = it.flags.chimney ? `<rect x="55" y="-300" width="34" height="70" fill="${col(it.colors.roof)}" ${O}/>${it.flags.smoke ? `<path d="M72 -310 Q60 -330 75 -345 Q90 -360 75 -380" fill="none" stroke="#b9b4ad" stroke-width="10" stroke-linecap="round"/>` : ''}` : '';
      return `${chimney}<rect x="-115" y="-190" width="230" height="190" fill="${col(it.colors.body)}" ${O}/>`
        + `<path d="M-140 -185 L0 -300 L140 -185 Z" fill="${col(it.colors.roof)}" ${O}/>`
        + `${it.flags.attic ? `<circle cy="-225" r="22" fill="#cfe9f7" ${O}/>` : ''}`
        + win(-95, true) + win(39, it.flags.cross)
        + `<rect x="-28" y="-100" width="56" height="100" fill="${col(it.colors.door)}" ${O}/>${it.flags.knob ? `<circle cx="16" cy="-48" r="5" fill="${INK}"/>` : ''}`;
    },
    mutations: ['color', 'flag:chimney', 'flag:cross', 'flag:knob', 'flag:attic', 'flag:smoke'],
  },
  treeRound: {
    box: [-110, -290, 110, 0],
    render: (it) => {
      const apples = it.flags.apples ? [[-45, -190], [30, -230], [55, -160], [-10, -150]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="${PALETTE.red}" ${O}/>`).join('') : '';
      return `<path d="M-18 0 L-14 -120 L14 -120 L18 0 Z" fill="${PALETTE.brown}" ${O}/>`
        + `<path d="M-100 -150 Q-120 -230 -50 -250 Q-20 -300 40 -270 Q110 -260 100 -180 Q115 -110 40 -115 Q0 -95 -45 -115 Q-105 -105 -100 -150 Z" fill="${col(it.colors.leaf)}" ${O}/>${apples}`;
    },
    mutations: ['color', 'flag:apples', 'size'],
  },
  treePine: {
    box: [-90, -300, 90, 0],
    render: (it) => `<rect x="-14" y="-50" width="28" height="50" fill="${PALETTE.brown}" ${O}/>`
      + `<path d="M-90 -40 L0 -150 L90 -40 Z M-70 -120 L0 -220 L70 -120 Z M-50 -195 L0 -${it.flags.tall ? 300 : 280} L50 -195 Z" fill="${col(it.colors.leaf)}" ${O}/>`
      + (it.flags.star ? `<path d="M0 -${it.flags.tall ? 318 : 298} l6 12 13 2 -10 9 3 13 -12 -6 -12 6 3 -13 -10 -9 13 -2 Z" fill="${PALETTE.yellow}" ${O}/>` : ''),
    mutations: ['color', 'flag:star', 'flag:tall'],
  },
  fence: {
    box: [-150, -110, 150, 0],
    render: (it) => {
      const n = it.flags.full ? 6 : 5;
      const p = Array.from({ length: n }, (_, i) => -140 + i * (280 / 5)).map((x) => `<path d="M${x} 0 V-85 L${x + 15} -105 L${x + 30} -85 V0 Z" fill="${col(it.colors.body)}" ${O}/>`).join('');
      return `<rect x="-150" y="-75" width="320" height="16" fill="${col(it.colors.body)}" ${O}/><rect x="-150" y="-35" width="320" height="16" fill="${col(it.colors.body)}" ${O}/>${p}`;
    },
    mutations: ['color', 'flag:full'],
  },
  flower: {
    box: [-34, -120, 34, 0],
    render: (it) => {
      const n = it.flags.many ? 6 : 5;
      const petals = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return `<circle cx="${Math.cos(a) * 20}" cy="${-95 + Math.sin(a) * 20}" r="15" fill="${col(it.colors.petal)}" ${O}/>`;
      }).join('');
      return `<path d="M0 0 V-90" ${O}/><path d="M0 -40 Q25 -60 30 -40 Q15 -30 0 -40 Z" fill="${PALETTE.green}" ${O}/>${petals}<circle cy="-95" r="11" fill="${col(it.colors.center)}" ${O}/>`;
    },
    mutations: ['color', 'remove', 'flag:many'],
  },
  cat: {
    box: [-80, -150, 95, 0],
    render: (it) => `<path d="M40 -20 Q100 -20 85 -80 Q80 -100 68 -92" fill="none" ${O} stroke-width="14"/><path d="M40 -20 Q100 -20 85 -80 Q80 -100 68 -92" fill="none" stroke="${col(it.colors.fur)}" stroke-width="8" stroke-linecap="round"/>`
      + `<ellipse cx="0" cy="-48" rx="55" ry="48" fill="${col(it.colors.fur)}" ${O}/>`
      + `<path d="M-48 -120 L-40 -152 L-18 -130 M18 -130 L40 -152 L48 -120" fill="${col(it.colors.fur)}" ${O}/>`
      + `<circle cx="0" cy="-110" r="45" fill="${col(it.colors.fur)}" ${O}/>`
      + `<circle cx="-16" cy="-115" r="6" fill="${INK}"/><circle cx="16" cy="-115" r="6" fill="${INK}"/><path d="M-6 -100 L0 -95 L6 -100" fill="none" ${O}/>`
      + (it.flags.whiskers ? `<path d="M-20 -98 H-58 M-20 -92 L-55 -84 M20 -98 H58 M20 -92 L55 -84" ${O} stroke-width="2"/>` : '')
      + (it.flags.bow ? `<path d="M-14 -66 L-34 -78 L-34 -54 Z M14 -66 L34 -78 L34 -54 Z" fill="${PALETTE.red}" ${O}/><circle cy="-66" r="7" fill="${PALETTE.red}" ${O}/>` : ''),
    mutations: ['color', 'flip', 'flag:whiskers', 'flag:bow'],
  },
  mailbox: {
    box: [-50, -175, 70, 0],
    render: (it) => `<rect x="-8" y="-100" width="16" height="100" fill="${PALETTE.brown}" ${O}/>`
      + `<path d="M-48 -100 V-150 Q-48 -175 -20 -175 H20 Q48 -175 48 -150 V-100 Z" fill="${col(it.colors.body)}" ${O}/>`
      + (it.flags.up ? `<path d="M48 -130 V-185 H72 V-165 H54" fill="${PALETTE.red}" ${O}/>` : `<path d="M48 -130 H85 V-112 H48" fill="${PALETTE.red}" ${O}/>`),
    mutations: ['color', 'flag:up'],
  },
  butterfly: {
    box: [-40, -32, 40, 32],
    render: (it) => `<ellipse cx="-20" cy="-12" rx="20" ry="16" fill="${col(it.colors.wing)}" ${O}/><ellipse cx="20" cy="-12" rx="20" ry="16" fill="${col(it.colors.wing)}" ${O}/>`
      + `<ellipse cx="-14" cy="14" rx="13" ry="11" fill="${col(it.colors.wing)}" ${O}/><ellipse cx="14" cy="14" rx="13" ry="11" fill="${col(it.colors.wing)}" ${O}/><path d="M0 -22 V26 M0 -22 L-8 -34 M0 -22 L8 -34" ${O}/>`,
    mutations: ['color', 'remove'],
  },

  /* 바닷가 */
  boat: {
    box: [-130, -260, 130, 20],
    render: (it) => `<path d="M-125 -40 H125 L95 15 H-95 Z" fill="${col(it.colors.hull)}" ${O}/>`
      + `<path d="M0 -40 V-250" ${O}/><path d="M5 -245 L110 -60 H5 Z" fill="${col(it.colors.sail)}" ${O}/>`
      + (it.flags.stripe ? `<path d="M5 -150 L58 -150" ${O} stroke-width="8"/>` : '')
      + (it.flags.pennant ? `<path d="M0 -250 L-45 -235 L0 -220 Z" fill="${PALETTE.red}" ${O}/>` : '')
      + (it.flags.porthole ? `<circle cx="-60" cy="-12" r="11" fill="#cfe9f7" ${O}/><circle cx="-20" cy="-12" r="11" fill="#cfe9f7" ${O}/>` : ''),
    mutations: ['color', 'flip', 'flag:stripe', 'flag:pennant', 'flag:porthole'],
  },
  palm: {
    box: [-150, -380, 130, 0],
    render: (it) => {
      const n = it.flags.full ? 5 : 4;
      const leaves = [[-140, -300], [-110, -390], [40, -400], [125, -300], [10, -260]].slice(0, n)
        .map(([lx, ly]) => `<path d="M10 -330 Q${(lx + 10) / 2} ${ly - 40} ${lx} ${ly} Q${(lx + 10) / 2} ${ly - 5} 10 -330 Z" fill="${col(it.colors.leaf)}" ${O}/>`).join('');
      return `<path d="M-20 0 Q-10 -180 10 -330 L30 -330 Q15 -180 20 0 Z" fill="#c08a52" ${O}/>${leaves}`
        + (it.flags.coconut ? `<circle cx="0" cy="-318" r="14" fill="${PALETTE.brown}" ${O}/><circle cx="25" cy="-312" r="14" fill="${PALETTE.brown}" ${O}/>` : '');
    },
    mutations: ['color', 'flag:full', 'flag:coconut', 'flip'],
  },
  umbrella: {
    box: [-130, -260, 130, 0],
    render: (it) => `<path d="M0 0 V-200" ${O}/><path d="M-125 -170 Q0 -310 125 -170 Z" fill="${col(it.colors.a)}" ${O}/>`
      + `<path d="M-42 -170 Q0 -310 42 -170 Z" fill="${col(it.colors.b)}" ${O}/>`
      + (it.flags.top ? `<circle cy="-245" r="10" fill="${col(it.colors.b)}" ${O}/>` : ''),
    mutations: ['color', 'flag:top', 'size'],
  },
  ball: {
    box: [-45, -90, 45, 0],
    render: (it) => `<circle cy="-45" r="45" fill="${PALETTE.white}" ${O}/><path d="M-45 -45 Q0 -60 45 -45 Q0 -30 -45 -45 Z" fill="${col(it.colors.a)}" ${O}/>`
      + `<path d="M0 -90 Q-18 -45 0 0 Q18 -45 0 -90 Z" fill="${col(it.colors.b)}" ${O}/>`,
    mutations: ['color', 'remove', 'size'],
  },
  castle: {
    box: [-120, -200, 120, 0],
    render: (it) => {
      const tower = (x: number, h: number) => `<path d="M${x - 30} 0 V-${h} h12 v-14 h12 v14 h12 v-14 h12 v14 h12 V0 Z" fill="#e9c98f" ${O}/>`;
      return `<rect x="-80" y="-100" width="160" height="100" fill="#e9c98f" ${O}/>${tower(-80, 150)}${it.flags.mid ? tower(0, 180) : ''}${tower(80, 150)}`
        + `<path d="M-22 0 V-45 Q0 -70 22 -45 V0 Z" fill="${INK}"/>`
        + (it.flags.flag ? `<path d="M-80 -164 V-205 L-50 -195 L-80 -185" fill="${col(it.colors.flag)}" ${O}/>` : '');
    },
    mutations: ['flag:mid', 'flag:flag', 'color'],
  },
  crab: {
    box: [-80, -70, 80, 0],
    render: (it) => `<path d="M-40 -10 L-70 0 M-40 -20 L-75 -15 M40 -10 L70 0 M40 -20 L75 -15" ${O}/>`
      + `<ellipse cy="-30" rx="48" ry="30" fill="${col(it.colors.body)}" ${O}/>`
      + `<path d="M-40 -45 L-60 -62" ${O}/><circle cx="-66" cy="-66" r="13" fill="${col(it.colors.body)}" ${O}/>`
      + (it.flags.both ? `<path d="M40 -45 L60 -62" ${O}/><circle cx="66" cy="-66" r="13" fill="${col(it.colors.body)}" ${O}/>` : '')
      + `<circle cx="-14" cy="-40" r="6" fill="${INK}"/><circle cx="14" cy="-40" r="6" fill="${INK}"/>`,
    mutations: ['color', 'flag:both', 'remove'],
  },
  starfish: {
    box: [-38, -38, 38, 38],
    render: (it) => {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? 15 : 36;
        return `${Math.cos(a) * r},${Math.sin(a) * r}`;
      }).join(' ');
      return `<polygon points="${pts}" fill="${col(it.colors.body)}" ${O}/>`;
    },
    mutations: ['color', 'remove'],
  },
  bucket: {
    box: [-45, -110, 45, 0],
    render: (it) => `${it.flags.handle ? `<path d="M-38 -80 Q0 -125 38 -80" fill="none" ${O}/>` : ''}<path d="M-40 -80 H40 L30 0 H-30 Z" fill="${col(it.colors.body)}" ${O}/><path d="M-37 -55 H37" ${O}/>`,
    mutations: ['color', 'flag:handle', 'remove'],
  },
  fish: {
    box: [-60, -35, 60, 35],
    render: (it) => `<path d="M-50 0 Q0 -40 40 0 Q0 40 -50 0 Z" fill="${col(it.colors.body)}" ${O}/><path d="M38 0 L62 -22 L62 22 Z" fill="${col(it.colors.body)}" ${O}/>`
      + `<circle cx="-25" cy="-6" r="5" fill="${INK}"/>${it.flags.stripe ? `<path d="M0 -18 Q8 0 0 18" fill="none" ${O}/>` : ''}`,
    mutations: ['color', 'flip', 'flag:stripe', 'remove'],
  },
};

/* 추가 물체 */
Object.assign(KINDS, {
  bush: {
    box: [-80, -80, 80, 0],
    render: (it: Item) => `<path d="M-75 0 Q-95 -45 -50 -55 Q-40 -90 0 -78 Q40 -95 55 -55 Q95 -45 75 0 Z" fill="${col(it.colors.leaf)}" ${O}/>`
      + (it.flags.berries ? [[-40, -35], [-5, -55], [35, -30], [10, -22]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="${PALETTE.red}" ${O}/>`).join('') : ''),
    mutations: ['color', 'flag:berries', 'size'],
  },
  rock: {
    box: [-60, -55, 60, 0],
    render: (it: Item) => `<path d="M-58 0 Q-62 -40 -20 -52 Q30 -60 55 -25 Q62 -5 50 0 Z" fill="#b8b2a7" ${O}/>${it.flags.crack ? `<path d="M5 -50 L-5 -30 L10 -18 L0 0" fill="none" ${O}/>` : ''}`,
    mutations: ['remove', 'flag:crack', 'size'],
  },
  mushroom: {
    box: [-40, -75, 40, 0],
    render: (it: Item) => `<path d="M-14 0 V-35 H14 V0 Z" fill="${PALETTE.cream}" ${O}/><path d="M-40 -35 Q-40 -75 0 -75 Q40 -75 40 -35 Z" fill="${col(it.colors.cap)}" ${O}/>`
      + (it.flags.dots ? `<circle cx="-18" cy="-52" r="7" fill="#fff"/><circle cx="10" cy="-62" r="6" fill="#fff"/><circle cx="22" cy="-45" r="5" fill="#fff"/>` : ''),
    mutations: ['color', 'flag:dots', 'remove'],
  },
  sign: {
    box: [-70, -150, 80, 0],
    render: (it: Item) => `<rect x="-7" y="-130" width="14" height="130" fill="${PALETTE.brown}" ${O}/><path d="M-65 -145 H45 L75 -120 L45 -95 H-65 Z" fill="${col(it.colors.board)}" ${O}/>`
      + (it.flags.text ? `<path d="M-48 -120 H25" ${O} stroke-width="6"/>` : ''),
    mutations: ['color', 'flip', 'flag:text'],
  },
  balloon: {
    box: [-35, -45, 35, 130],
    render: (it: Item) => `<path d="M0 42 Q15 80 -5 100 Q-20 115 0 130" fill="none" ${O} stroke-width="2"/><ellipse cy="0" rx="34" ry="42" fill="${col(it.colors.body)}" ${O}/><path d="M-6 42 L6 42 L0 50 Z" fill="${col(it.colors.body)}" ${O}/><path d="M-15 -20 Q-12 -30 -2 -32" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
    mutations: ['color', 'remove'],
  },
  shell: {
    box: [-34, -46, 34, 0],
    render: (it: Item) => `<path d="M0 0 L-32 -24 Q-30 -48 0 -46 Q30 -48 32 -24 Z" fill="${col(it.colors.body)}" ${O}/><path d="M0 -4 L-16 -40 M0 -4 L0 -44 M0 -4 L16 -40" fill="none" stroke="${INK}" stroke-width="2" stroke-opacity=".55"/>`,
    mutations: ['color', 'remove'],
  },
  surfboard: {
    box: [-40, -200, 40, 0],
    render: (it: Item) => `<ellipse cy="-100" rx="36" ry="100" fill="${col(it.colors.body)}" ${O}/>${it.flags.stripe ? `<path d="M0 -195 V-5" stroke="${col(it.colors.stripe)}" stroke-width="12"/><ellipse cy="-100" rx="36" ry="100" fill="none" ${O}/>` : ''}`,
    mutations: ['color', 'flag:stripe'],
  },
  lighthouse: {
    box: [-45, -230, 45, 0],
    render: (it: Item) => `<path d="M-40 0 L-25 -180 H25 L40 0 Z" fill="#fff" ${O}/><path d="M-36 -45 L-33 -80 H33 L36 -45 Z M-30 -115 L-28 -145 H28 L30 -115 Z" fill="${col(it.colors.stripe)}" ${O}/>`
      + `<rect x="-22" y="-215" width="44" height="35" fill="${it.flags.light ? PALETTE.yellow : '#cfe9f7'}" ${O}/><path d="M-30 -215 L0 -240 L30 -215 Z" fill="${col(it.colors.stripe)}" ${O}/>`,
    mutations: ['color', 'flag:light'],
  },
} as Record<string, Kind>);

/** 일부만 바뀌는 차이의 정답 영역 (없으면 물체 전체) */
const REGIONS: Record<string, Record<string, [number, number, number, number]>> = {
  sun: { face: [-45, -35, 45, 40] },
  kite: { bows: [-35, 85, 35, 200] },
  house: { chimney: [40, -390, 110, -225], smoke: [45, -390, 105, -300], cross: [30, -150, 105, -75], knob: [-10, -70, 40, -25], attic: [-35, -260, 35, -190] },
  treeRound: { apples: [-100, -260, 100, -130] },
  treePine: { star: [-28, -330, 28, -280], tall: [-55, -320, 55, -190] },
  fence: { full: [100, -110, 175, 0] },
  flower: { many: [-38, -125, 38, -65] },
  cat: { whiskers: [-62, -120, 62, -80], bow: [-42, -88, 42, -48] },
  mailbox: { up: [35, -195, 95, -100] },
  boat: { stripe: [0, -170, 70, -130], pennant: [-52, -258, 8, -212], porthole: [-80, -28, 0, 4] },
  palm: { coconut: [-20, -340, 45, -295] },
  umbrella: { top: [-20, -265, 20, -225] },
  castle: { mid: [-38, -200, 38, -100], flag: [-88, -212, -42, -160] },
  crab: { both: [30, -85, 85, -38] },
  bucket: { handle: [-42, -112, 42, -75] },
  fish: { stripe: [-18, -24, 18, 24] },
  sign: { text: [-55, -135, 35, -105] },
  lighthouse: { light: [-28, -245, 28, -175] },
};

/* ───────── 장면 구성 ───────── */
interface Scene { theme: string; bg: string; items: Item[]; }
type Spec = { colors: Record<string, ColorName>; flags?: string[] };

function boxAt(kind: string, x: number, y: number, s: number, flip: boolean, region?: [number, number, number, number]): [number, number, number, number] {
  let [a, b, c, d] = region ?? KINDS[kind].box;
  if (flip) [a, c] = [-c, -a];
  return [x + a * s, y + b * s, x + c * s, y + d * s];
}
const overlap = (p: number[], q: number[], m = 10) => p[0] < q[2] + m && q[0] < p[2] + m && p[1] < q[3] + m && q[1] < p[3] + m;

/** 다른 물체와 겹치지 않는 자리를 찾아 놓는다 */
function makePlacer(r: Rand) {
  const items: Item[] = [];
  const boxes: number[][] = [];
  return {
    items,
    place(kind: string, xr: [number, number], yr: [number, number], sr: [number, number], spec: Spec, allowOverlap = false) {
      for (let t = 0; t < 60; t++) {
        const x = between(r, ...xr), y = between(r, ...yr), s = between(r, ...sr);
        const flip = r() < 0.5;
        const bx = boxAt(kind, x, y, s, flip);
        if (bx[0] < 10 || bx[2] > W - 10 || bx[1] < 6 || bx[3] > H - 4) continue;
        if (!allowOverlap && boxes.some((o) => overlap(o, bx))) continue;
        const flags: Record<string, boolean> = {};
        for (const k of spec.flags ?? []) flags[k] = r() < 0.6;
        items.push({ id: items.length, kind, x, y, s, flip, hidden: false, colors: spec.colors, flags });
        boxes.push(bx);
        return true;
      }
      return false;
    },
  };
}

const C = (r: Rand, ...names: ColorName[]) => pick(r, names);

function village(r: Rand): Scene {
  const P = makePlacer(r);
  P.place('sun', [1250, 1500], [100, 150], [0.9, 1], { colors: { body: C(r, 'yellow', 'orange') }, flags: ['rays', 'face'] });
  for (let i = 0; i < 2; i++) P.place('house', [180, 1150], [600, 640], [0.95, 1.1], { colors: { body: C(r, 'cream', 'yellow', 'sky', 'pink', 'white'), roof: C(r, 'red', 'blue', 'brown', 'purple', 'teal'), door: C(r, 'brown', 'green', 'blue', 'red') }, flags: ['chimney', 'cross', 'knob', 'attic', 'smoke'] });
  for (let i = 0; i < 4; i++) {
    if (r() < 0.5) P.place('treeRound', [100, 1520], [590, 640], [0.85, 1.05], { colors: { leaf: C(r, 'green', 'lime', 'teal') }, flags: ['apples'] });
    else P.place('treePine', [100, 1520], [590, 640], [0.85, 1.05], { colors: { leaf: C(r, 'green', 'teal') }, flags: ['star', 'tall'] });
  }
  for (let i = 0; i < 3; i++) P.place('cloud', [120, 1200], [70, 210], [0.75, 1.05], { colors: { body: 'white' }, flags: ['puff'] });
  P.place('kite', [500, 1200], [150, 260], [0.75, 0.9], { colors: { body: C(r, ...BRIGHT), accent: C(r, ...BRIGHT) }, flags: ['bows'] });
  P.place('balloon', [150, 1450], [140, 330], [0.85, 1], { colors: { body: C(r, ...BRIGHT) } });
  for (let i = 0; i < 4; i++) P.place('bird', [150, 1450], [100, 380], [0.8, 1.2], { colors: {} });
  P.place('fence', [150, 1450], [730, 790], [0.9, 1], { colors: { body: C(r, 'white', 'brown', 'cream') }, flags: ['full'] });
  P.place('mailbox', [150, 1450], [740, 800], [0.9, 1], { colors: { body: C(r, 'blue', 'red', 'green') }, flags: ['up'] });
  P.place('cat', [150, 1450], [800, 880], [0.85, 1], { colors: { fur: C(r, 'orange', 'gray', 'white', 'brown') }, flags: ['whiskers', 'bow'] });
  P.place('sign', [150, 1450], [730, 820], [0.85, 1], { colors: { board: C(r, 'brown', 'cream', 'yellow') }, flags: ['text'] });
  for (let i = 0; i < 3; i++) P.place('bush', [100, 1500], [680, 880], [0.7, 1], { colors: { leaf: C(r, 'green', 'lime', 'teal') }, flags: ['berries'] });
  for (let i = 0; i < 2; i++) P.place('rock', [100, 1500], [700, 890], [0.7, 1], { colors: {}, flags: ['crack'] });
  for (let i = 0; i < 3; i++) P.place('mushroom', [80, 1520], [700, 890], [0.7, 0.95], { colors: { cap: C(r, 'red', 'orange', 'purple') }, flags: ['dots'] });
  for (let i = 0; i < 8; i++) P.place('flower', [50, 1550], [690, 895], [0.75, 1], { colors: { petal: C(r, 'red', 'pink', 'yellow', 'purple', 'orange'), center: C(r, 'yellow', 'orange', 'brown') }, flags: ['many'] });
  for (let i = 0; i < 3; i++) P.place('butterfly', [100, 1500], [400, 700], [0.8, 1], { colors: { wing: C(r, ...BRIGHT) } });
  const bg = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3f4"/><stop offset="1" stop-color="#d9f1fb"/></linearGradient></defs>`
    + `<rect width="${W}" height="${H}" fill="url(#sky)"/>`
    + `<path d="M0 520 Q250 400 520 500 Q800 380 1100 490 Q1350 420 1600 500 V${H} H0 Z" fill="#a7d886" ${O}/>`
    + `<path d="M0 600 Q400 560 800 600 T1600 590 V${H} H0 Z" fill="#7cc35c" ${O}/>`;
  return { theme: 'village', bg, items: sortByDepth(P.items) };
}

function beach(r: Rand): Scene {
  const P = makePlacer(r);
  P.place('sun', [100, 400], [100, 150], [0.85, 0.95], { colors: { body: C(r, 'yellow', 'orange') }, flags: ['rays', 'face'] });
  P.place('palm', [1150, 1500], [690, 720], [0.95, 1.05], { colors: { leaf: C(r, 'green', 'lime') }, flags: ['full', 'coconut'] });
  P.place('lighthouse', [60, 1500], [380, 390], [0.75, 0.85], { colors: { stripe: C(r, 'red', 'blue') }, flags: ['light'] });
  P.place('boat', [500, 1300], [420, 470], [0.65, 0.8], { colors: { hull: C(r, 'red', 'blue', 'navy', 'brown'), sail: C(r, 'white', 'yellow', 'pink') }, flags: ['stripe', 'pennant', 'porthole'] });
  for (let i = 0; i < 2; i++) P.place('fish', [100, 1500], [450, 570], [0.75, 0.9], { colors: { body: C(r, 'orange', 'sky', 'pink', 'yellow') }, flags: ['stripe'] });
  for (let i = 0; i < 3; i++) P.place('cloud', [300, 1450], [70, 200], [0.7, 1], { colors: { body: 'white' }, flags: ['puff'] });
  for (let i = 0; i < 4; i++) P.place('bird', [300, 1450], [120, 340], [0.8, 1.2], { colors: {} });
  P.place('umbrella', [150, 1300], [730, 780], [0.9, 1.05], { colors: { a: C(r, 'red', 'blue', 'orange'), b: C(r, 'white', 'yellow') }, flags: ['top'] });
  P.place('surfboard', [150, 1450], [760, 800], [0.8, 0.95], { colors: { body: C(r, 'teal', 'yellow', 'pink'), stripe: C(r, 'red', 'navy') }, flags: ['stripe'] });
  P.place('castle', [150, 1450], [790, 860], [0.8, 0.95], { colors: { flag: C(r, 'red', 'blue', 'green') }, flags: ['mid', 'flag'] });
  P.place('ball', [100, 1500], [790, 890], [0.8, 0.95], { colors: { a: C(r, 'red', 'blue'), b: C(r, 'yellow', 'green') } });
  P.place('bucket', [100, 1500], [800, 890], [0.8, 0.95], { colors: { body: C(r, 'red', 'blue', 'green', 'purple') }, flags: ['handle'] });
  P.place('crab', [100, 1500], [830, 890], [0.75, 0.9], { colors: { body: C(r, 'red', 'orange') }, flags: ['both'] });
  for (let i = 0; i < 4; i++) P.place('starfish', [60, 1540], [660, 880], [0.7, 0.9], { colors: { body: C(r, 'orange', 'pink', 'yellow', 'purple') } });
  for (let i = 0; i < 4; i++) P.place('shell', [60, 1540], [660, 890], [0.8, 1], { colors: { body: C(r, 'pink', 'cream', 'orange', 'white') } });
  const bg = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc9f0"/><stop offset="1" stop-color="#d4f0fa"/></linearGradient></defs>`
    + `<rect width="${W}" height="${H}" fill="url(#sky)"/>`
    + `<rect y="380" width="${W}" height="260" fill="#3f9bd6"/>`
    + `<path d="M0 430 q40 -12 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" fill="none" stroke="#9fd5f2" stroke-width="5"/>`
    + `<path d="M0 600 Q400 570 800 610 T1600 590 V${H} H0 Z" fill="#f3dca6" ${O}/>`
    + `<path d="M0 380 H${W}" ${O}/>`;
  return { theme: 'beach', bg, items: sortByDepth(P.items) };
}

/** 아래쪽(앞쪽)에 있는 물체가 나중에 그려지도록 */
function sortByDepth(items: Item[]) {
  return items.slice().sort((a, b) => a.y - b.y).map((it, i) => ({ ...it, id: i }));
}

const THEMES: Record<string, (r: Rand) => Scene> = { village, beach };
export const THEME_NAMES: Record<string, string> = { village: '마을', beach: '바닷가' };

/* ───────── 차이 만들기 ───────── */
export interface Difference { x: number; y: number; r: number; label: string; }

const KIND_LABEL: Record<string, string> = {
  sun: '해', cloud: '구름', bird: '새', kite: '연', house: '집', treeRound: '나무', treePine: '나무', fence: '울타리',
  flower: '꽃', cat: '고양이', mailbox: '우체통', butterfly: '나비', boat: '배', palm: '야자수', umbrella: '파라솔',
  ball: '비치볼', castle: '모래성', crab: '게', starfish: '불가사리', bucket: '양동이', fish: '물고기',
  bush: '덤불', rock: '바위', mushroom: '버섯', sign: '표지판', balloon: '풍선', shell: '조개', surfboard: '서핑보드', lighthouse: '등대',
};

const typeOf = (m: Mutation) => (m.startsWith('flag:') ? 'shape' : m);

function applyMutation(it: Item, m: Mutation, r: Rand): { item: Item; label: string; region?: [number, number, number, number] } {
  const k = KIND_LABEL[it.kind];
  const next: Item = { ...it, colors: { ...it.colors }, flags: { ...it.flags } };
  if (m === 'color') {
    const key = pick(r, Object.keys(it.colors));
    next.colors[key] = contrastColor(r, it.colors[key]);
    return { item: next, label: `${k} 색` };
  }
  if (m === 'remove') { next.hidden = true; return { item: next, label: `${k} 사라짐` }; }
  if (m === 'size') { next.s = it.s * 1.3; return { item: next, label: `${k} 크기` }; }
  if (m === 'flip') { next.flip = !it.flip; return { item: next, label: `${k} 방향` }; }
  const flag = m.slice(5);
  next.flags[flag] = !it.flags[flag];
  return { item: next, label: `${k} 모양`, region: REGIONS[it.kind]?.[flag] };
}

function renderScene(scene: Scene, items: Item[]) {
  const body = items.filter((it) => !it.hidden).map((it) => {
    const sx = it.flip ? -it.s : it.s;
    return `<g transform="translate(${it.x.toFixed(1)} ${it.y.toFixed(1)}) scale(${sx.toFixed(3)} ${it.s.toFixed(3)})">${KINDS[it.kind].render(it)}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${scene.bg}${body}</svg>`;
}

export interface Puzzle { seed: number; theme: string; original: string; changed: string; diffs: Difference[]; }

export function generatePuzzle(seed: number, theme?: string): Puzzle {
  const r = seeded(seed);
  const themeKey = theme ?? pick(r, Object.keys(THEMES));
  const scene = THEMES[themeKey](r);
  const items = scene.items;

  // 서로 떨어진 물체 5개를 골라 한 가지씩 바꾼다. 같은 종류의 물체·같은 유형의 변화가 몰리지 않게 한다
  const changed = items.slice();
  const diffs: Difference[] = [];
  const usedKinds = new Set<string>();
  const typeCount: Record<string, number> = {};
  const order = items.map((_, i) => i).sort(() => r() - 0.5);
  for (const idx of order) {
    if (diffs.length === 5) break;
    const it = items[idx];
    const label = KIND_LABEL[it.kind];
    if (usedKinds.has(label)) continue;
    const muts = KINDS[it.kind].mutations.filter((m) => (typeCount[typeOf(m)] ?? 0) < 2);
    if (!muts.length) continue;
    const m = pick(r, muts);
    const res = applyMutation(it, m, r);
    if (m === 'size') {
      const b = boxAt(it.kind, it.x, it.y, res.item.s, it.flip);
      if (b[0] < 0 || b[2] > W || b[1] < 0 || b[3] > H) continue;
    }
    const [x0, y0, x1, y1] = boxAt(it.kind, it.x, it.y, m === 'size' ? res.item.s : it.s, res.item.flip, res.region);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (diffs.some((d) => Math.hypot(d.x - cx, d.y - cy) < 200)) continue;
    changed[idx] = res.item;
    usedKinds.add(label);
    typeCount[typeOf(m)] = (typeCount[typeOf(m)] ?? 0) + 1;
    diffs.push({ x: cx, y: cy, r: Math.max(60, Math.min(140, Math.hypot(x1 - x0, y1 - y0) / 2 + 15)), label: res.label });
  }
  return { seed, theme: themeKey, original: renderScene(scene, items), changed: renderScene(scene, changed), diffs };
}
