/**
 * The page that runs inside the hidden-chrome WebView: opens the camera with getUserMedia,
 * runs MediaPipe HandLandmarker (WASM + GPU) on every video frame, draws the hand skeleton,
 * and posts the 21 raw landmarks back to React Native. Classification happens in RN.
 */
export const MEDIAPIPE_VERSION = '1.1.0';

const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

export type EngineOptions = { facing: 'user' | 'environment'; maxFps: number; showSkeleton: boolean };

export function buildEngineHtml({ facing, maxFps, showSkeleton }: EngineOptions) {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  video, canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .mirror { transform: scaleX(-1); }
</style>
</head><body>
<video id="v" playsinline autoplay muted class="${facing === 'user' ? 'mirror' : ''}"></video>
<canvas id="c" class="${facing === 'user' ? 'mirror' : ''}"></canvas>
<script type="module">
const post = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
window.onerror = (m) => post({ type: 'error', message: String(m) });

const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const SHOW = ${showSkeleton ? 'true' : 'false'};
const MIN_GAP = 1000 / ${maxFps};
const video = document.getElementById('v');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let paused = false;
window.__setPaused = (p) => { paused = p; };

function draw(hands) {
  // Match the canvas to the object-fit: cover crop of the video so bones line up with the hand.
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== W * 2) { canvas.width = W * 2; canvas.height = H * 2; }
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!SHOW) return;
  const vw = video.videoWidth, vh = video.videoHeight;
  const s = Math.max(W / vw, H / vh), ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
  for (const points of hands) {
  const P = points.map((p) => [p[0] * vw * s + ox, p[1] * vh * s + oy]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  for (const [a, b] of BONES) { ctx.beginPath(); ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); ctx.stroke(); }
  ctx.fillStyle = '#7C83FF';
  for (const [x, y] of P) { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
  }
}

async function start() {
  post({ type: 'status', message: 'Opening camera…' });
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: '${facing}', width: { ideal: 640 }, height: { ideal: 480 } },
  });
  video.srcObject = stream;
  await video.play();

  post({ type: 'status', message: 'Loading hand model…' });
  const { FilesetResolver, HandLandmarker } = await import('${CDN}/vision_bundle.mjs');
  const fileset = await FilesetResolver.forVisionTasks('${CDN}/wasm');
  const make = (delegate) => HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: '${MODEL_URL}', delegate },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  let landmarker, delegate = 'GPU';
  try { landmarker = await make('GPU'); } catch (e) { delegate = 'CPU'; landmarker = await make('CPU'); }
  post({ type: 'ready', delegate, width: video.videoWidth, height: video.videoHeight });

  let last = 0, frames = 0, fpsT = performance.now();
  const loop = () => {
    requestAnimationFrame(loop);
    const now = performance.now();
    if (paused || now - last < MIN_GAP || video.readyState < 2) return;
    last = now;
    const r = landmarker.detectForVideo(video, now);
    const hands = (r.landmarks || []).map((hand, i) => ({
      points: hand.map((p) => [+p.x.toFixed(5), +p.y.toFixed(5), +p.z.toFixed(5)]),
      handedness: r.handedness[i][0].categoryName,
    }));
    draw(hands.map((h) => h.points));
    // The biggest hand on screen is the one fingerspelling; word signs use both.
    const size = (h) => { const xs = h.points.map((p) => p[0]), ys = h.points.map((p) => p[1]);
      return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)); };
    hands.sort((a, b) => size(b) - size(a));
    post({ type: 'frame', t: now, aspect: video.videoWidth / video.videoHeight,
           points: hands.length ? hands[0].points : null,
           handedness: hands.length ? hands[0].handedness : undefined, hands });
    frames++;
    if (now - fpsT > 1000) { post({ type: 'fps', fps: Math.round(frames * 1000 / (now - fpsT)) }); frames = 0; fpsT = now; }
  };
  loop();
}
start().catch((e) => post({ type: 'error', message: (e && (e.name + ': ' + e.message)) || String(e) }));
</script>
</body></html>`;
}
