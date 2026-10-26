export type Point3 = [number, number, number];

/** One camera frame from the vision engine. `points` is null when no hand is visible. */
export type HandFrame = {
  t: number;
  points: Point3[] | null;
  aspect?: number;
  handedness?: 'Left' | 'Right';
  /** Every detected hand (up to two), biggest first. `points` above is hands[0]. */
  hands?: { points: Point3[]; handedness: 'Left' | 'Right' }[];
};

export type EngineStatus =
  { state: 'loading'; message: string } | { state: 'ready'; delegate: string } | { state: 'error'; message: string };
