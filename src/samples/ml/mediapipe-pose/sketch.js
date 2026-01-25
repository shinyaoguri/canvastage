// Mediapipe Pose Estimation
// カメラから体の姿勢を検出して可視化

let capture;
let poseLandmarker;
let results;
let modelLoaded = false;

const POSE_CONNECTIONS = [
  // 顔
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  // 胴体
  [11, 12], [11, 23], [12, 24], [23, 24],
  // 左腕
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  // 右腕
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // 左脚
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  // 右脚
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
];

async function setup() {
  createCanvas(windowWidth, windowHeight);
  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();

  const vision = await loadMediapipeVision();
  if (vision) {
    await initPoseLandmarker(vision);
  }
}

async function loadMediapipeVision() {
  try {
    const module = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs"
    );
    return module;
  } catch (e) {
    console.error("Failed to load Mediapipe Vision:", e);
    return null;
  }
}

async function initPoseLandmarker(vision) {
  try {
    const { PoseLandmarker, FilesetResolver } = vision;

    const wasmFiles = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    poseLandmarker = await PoseLandmarker.createFromOptions(wasmFiles, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 2,
    });

    modelLoaded = true;
    console.log("Pose Landmarker ready");
  } catch (e) {
    console.error("Failed to init Pose Landmarker:", e);
  }
}

function draw() {
  background(20);

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
  tint(255, 80);
  image(capture, 0, 0, displayWidth, displayHeight);
  pop();

  // ポーズ検出
  if (modelLoaded && capture.loadedmetadata) {
    try {
      results = poseLandmarker.detectForVideo(capture.elt, performance.now());
    } catch (e) {
      // 検出エラーは無視
    }
  }

  // 検出結果を描画
  if (results && results.landmarks) {
    for (let pose of results.landmarks) {
      drawPose(pose, offsetX, offsetY, displayWidth, displayHeight);
    }
  }

  // ステータス表示
  fill(255);
  noStroke();
  textSize(14);
  text(modelLoaded ? "Pose Estimation Active" : "Loading model...", 10, 25);
  if (results && results.landmarks) {
    text(`Poses detected: ${results.landmarks.length}`, 10, 45);
  }
}

function drawPose(landmarks, ox, oy, w, h) {
  // スケルトン描画
  strokeWeight(3);
  for (let [i, j] of POSE_CONNECTIONS) {
    if (!landmarks[i] || !landmarks[j]) continue;
    if (landmarks[i].visibility < 0.5 || landmarks[j].visibility < 0.5) continue;

    let x1 = ox + (1 - landmarks[i].x) * w;
    let y1 = oy + landmarks[i].y * h;
    let x2 = ox + (1 - landmarks[j].x) * w;
    let y2 = oy + landmarks[j].y * h;

    // 左右で色を変える
    if (i >= 11 && i <= 22) {
      stroke(i % 2 === 1 ? color(100, 200, 255) : color(255, 150, 100));
    } else if (i >= 23) {
      stroke(i % 2 === 1 ? color(100, 255, 200) : color(255, 200, 100));
    } else {
      stroke(200, 200, 200);
    }
    line(x1, y1, x2, y2);
  }

  // ランドマーク描画
  noStroke();
  for (let i = 0; i < landmarks.length; i++) {
    if (!landmarks[i] || landmarks[i].visibility < 0.5) continue;

    let x = ox + (1 - landmarks[i].x) * w;
    let y = oy + landmarks[i].y * h;

    let size = 8;
    fill(255, 100, 200);
    ellipse(x, y, size, size);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
