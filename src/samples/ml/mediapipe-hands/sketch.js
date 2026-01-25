// Mediapipe Hand Tracking
// カメラから手を検出して可視化

let capture;
let handLandmarker;
let results;
let modelLoaded = false;

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

async function setup() {
  createCanvas(windowWidth, windowHeight);
  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();

  // Mediapipe Vision を動的にロード
  const vision = await loadMediapipeVision();
  if (vision) {
    await initHandLandmarker(vision);
  }
}

async function loadMediapipeVision() {
  try {
    // ESMモジュールを動的インポート
    const module = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs"
    );
    return module;
  } catch (e) {
    console.error("Failed to load Mediapipe Vision:", e);
    return null;
  }
}

async function initHandLandmarker(vision) {
  try {
    const { HandLandmarker, FilesetResolver } = vision;

    const wasmFiles = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    handLandmarker = await HandLandmarker.createFromOptions(wasmFiles, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });

    modelLoaded = true;
    console.log("Hand Landmarker ready");
  } catch (e) {
    console.error("Failed to init Hand Landmarker:", e);
  }
}

function draw() {
  background(20);

  // カメラ映像を中央に配置
  let aspectRatio = capture.width / capture.height;
  let displayHeight = height;
  let displayWidth = displayHeight * aspectRatio;
  if (displayWidth > width) {
    displayWidth = width;
    displayHeight = displayWidth / aspectRatio;
  }
  let offsetX = (width - displayWidth) / 2;
  let offsetY = (height - displayHeight) / 2;

  // 左右反転して表示
  push();
  translate(offsetX + displayWidth, offsetY);
  scale(-1, 1);
  image(capture, 0, 0, displayWidth, displayHeight);
  pop();

  // 手の検出
  if (modelLoaded && capture.loadedmetadata) {
    try {
      results = handLandmarker.detectForVideo(capture.elt, performance.now());
    } catch (e) {
      // 検出エラーは無視
    }
  }

  // 検出結果を描画
  if (results && results.landmarks) {
    for (let hand of results.landmarks) {
      drawHand(hand, offsetX, offsetY, displayWidth, displayHeight);
    }
  }

  // ステータス表示
  fill(255);
  noStroke();
  textSize(14);
  text(modelLoaded ? "Hand Tracking Active" : "Loading model...", 10, 25);
  if (results && results.landmarks) {
    text(`Hands detected: ${results.landmarks.length}`, 10, 45);
  }
}

function drawHand(landmarks, ox, oy, w, h) {
  // 接続線を描画
  stroke(0, 255, 150);
  strokeWeight(2);
  for (let [i, j] of HAND_CONNECTIONS) {
    let x1 = ox + (1 - landmarks[i].x) * w;
    let y1 = oy + landmarks[i].y * h;
    let x2 = ox + (1 - landmarks[j].x) * w;
    let y2 = oy + landmarks[j].y * h;
    line(x1, y1, x2, y2);
  }

  // ランドマークを描画
  noStroke();
  for (let i = 0; i < landmarks.length; i++) {
    let x = ox + (1 - landmarks[i].x) * w;
    let y = oy + landmarks[i].y * h;

    // 指先は大きく
    let size = [4, 8, 12, 16, 20].includes(i) ? 12 : 6;
    fill(255, 100, 150);
    ellipse(x, y, size, size);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
