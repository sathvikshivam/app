export type Letter = {
  letter: string;
  tip: string;
  /** J and Z are traced in the air and recognized by the motion tracker (src/vision/motion.ts). */
  motion?: boolean;
  /** A `require()`d PNG. */
  image: number;
};

// Hand-shape art: public domain, see assets/signs/CREDITS.md.
export const LETTERS: Letter[] = [
  {
    letter: 'A',
    tip: 'Make a fist with your thumb resting against the side of your index finger.',
    image: require('@/assets/signs/A.png'),
  },
  {
    letter: 'B',
    tip: 'Flat hand, fingers together pointing up, thumb folded across your palm.',
    image: require('@/assets/signs/B.png'),
  },
  { letter: 'C', tip: 'Curve your fingers and thumb into the shape of a C.', image: require('@/assets/signs/C.png') },
  {
    letter: 'D',
    tip: 'Index finger up; the other fingertips touch your thumb to make a circle.',
    image: require('@/assets/signs/D.png'),
  },
  {
    letter: 'E',
    tip: 'Curl your fingertips down to rest on your thumb, tucked under them.',
    image: require('@/assets/signs/E.png'),
  },
  {
    letter: 'F',
    tip: 'Touch index finger to thumb in a circle; the other three fingers stand up.',
    image: require('@/assets/signs/F.png'),
  },
  {
    letter: 'G',
    tip: 'Index finger and thumb point sideways, parallel, like a little pinch.',
    image: require('@/assets/signs/G.png'),
  },
  { letter: 'H', tip: 'Index and middle fingers together, pointing sideways.', image: require('@/assets/signs/H.png') },
  {
    letter: 'I',
    tip: 'Pinky finger up, the rest in a fist with your thumb across the front.',
    image: require('@/assets/signs/I.png'),
  },
  {
    letter: 'J',
    tip: 'Make an I, then trace a J in the air with your pinky.',
    motion: true,
    image: require('@/assets/signs/J.png'),
  },
  {
    letter: 'K',
    tip: 'Index up, middle finger angled forward, thumb resting between them.',
    image: require('@/assets/signs/K.png'),
  },
  { letter: 'L', tip: 'Index finger up and thumb out to make an L.', image: require('@/assets/signs/L.png') },
  { letter: 'M', tip: 'Fold your thumb under your first three fingers.', image: require('@/assets/signs/M.png') },
  { letter: 'N', tip: 'Fold your thumb under your first two fingers.', image: require('@/assets/signs/N.png') },
  {
    letter: 'O',
    tip: 'All fingertips curve to touch your thumb, making an O.',
    image: require('@/assets/signs/O.png'),
  },
  { letter: 'P', tip: 'Like K, but tipped so your fingers point down.', image: require('@/assets/signs/P.png') },
  { letter: 'Q', tip: 'Like G, but pointing down toward the ground.', image: require('@/assets/signs/Q.png') },
  { letter: 'R', tip: 'Cross your middle finger over your index finger.', image: require('@/assets/signs/R.png') },
  {
    letter: 'S',
    tip: 'Make a fist with your thumb wrapped across the front of your fingers.',
    image: require('@/assets/signs/S.png'),
  },
  {
    letter: 'T',
    tip: 'Tuck your thumb between your index and middle fingers.',
    image: require('@/assets/signs/T.png'),
  },
  { letter: 'U', tip: 'Index and middle fingers up and pressed together.', image: require('@/assets/signs/U.png') },
  {
    letter: 'V',
    tip: 'Index and middle fingers up and spread apart, like a peace sign.',
    image: require('@/assets/signs/V.png'),
  },
  { letter: 'W', tip: 'Index, middle, and ring fingers up and spread.', image: require('@/assets/signs/W.png') },
  { letter: 'X', tip: 'Index finger bent into a hook, the rest in a fist.', image: require('@/assets/signs/X.png') },
  {
    letter: 'Y',
    tip: 'Thumb and pinky stretched out, the middle three fingers folded down.',
    image: require('@/assets/signs/Y.png'),
  },
  {
    letter: 'Z',
    tip: 'Trace a Z in the air with your index finger.',
    motion: true,
    image: require('@/assets/signs/Z.png'),
  },
];

// Number cards are original drawings rendered from our training data (ml/render_digit_cards.py).
export const DIGITS: Letter[] = [
  {
    letter: '0',
    tip: 'Curve all your fingers to meet your thumb in an O shape.',
    image: require('@/assets/signs/0.png'),
  },
  { letter: '1', tip: 'Index finger up, palm facing you.', image: require('@/assets/signs/1.png') },
  {
    letter: '2',
    tip: 'Index and middle fingers up and apart, palm facing you.',
    image: require('@/assets/signs/2.png'),
  },
  { letter: '3', tip: 'Thumb, index, and middle fingers out.', image: require('@/assets/signs/3.png') },
  {
    letter: '4',
    tip: 'Four fingers up and spread, thumb folded into your palm.',
    image: require('@/assets/signs/4.png'),
  },
  { letter: '5', tip: 'Open hand with all five fingers spread.', image: require('@/assets/signs/5.png') },
  {
    letter: '6',
    tip: 'Touch your thumb to your pinky; the other three fingers stay up.',
    image: require('@/assets/signs/6.png'),
  },
  {
    letter: '7',
    tip: 'Touch your thumb to your ring finger; the other fingers stay up.',
    image: require('@/assets/signs/7.png'),
  },
  {
    letter: '8',
    tip: 'Touch your thumb to your middle finger; the other fingers stay up.',
    image: require('@/assets/signs/8.png'),
  },
  {
    letter: '9',
    tip: 'Touch your thumb to your index finger; the other three fingers stay up.',
    image: require('@/assets/signs/9.png'),
  },
];

/** Every sign with a picture, keyed by character: letters A–Z and digits 0–9. */
export const SIGN_MAP: Record<string, Letter> = Object.fromEntries([...LETTERS, ...DIGITS].map((l) => [l.letter, l]));
