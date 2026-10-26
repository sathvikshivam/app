export type MlpModel = {
  labels: string[];
  mean: number[];
  std: number[];
  /** W is [inputs][outputs]. Hidden layers use ReLU, the last layer softmax. */
  layers: { W: number[][]; b: number[] }[];
  metrics?: { heldOutAccuracy: number; samples: number };
};

/**
 * Forward pass of the MLP trained in ml/train.py (scikit-learn MLPClassifier):
 * standardize -> [Dense + ReLU]* -> Dense -> softmax. Pure TypeScript, well under 1 ms per frame.
 */
export function forward(model: MlpModel, features: ArrayLike<number>): Float32Array {
  let x = new Float32Array(features.length);
  for (let i = 0; i < x.length; i++) x[i] = (features[i] - model.mean[i]) / model.std[i];

  model.layers.forEach(({ W, b }, li) => {
    const y = new Float32Array(b.length);
    for (let j = 0; j < b.length; j++) {
      let s = b[j];
      for (let i = 0; i < x.length; i++) s += x[i] * W[i][j];
      y[j] = li < model.layers.length - 1 ? Math.max(0, s) : s;
    }
    x = y;
  });

  let max = -Infinity;
  for (const v of x) max = Math.max(max, v);
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += x[i] = Math.exp(x[i] - max);
  for (let i = 0; i < x.length; i++) x[i] /= sum;
  return x;
}
