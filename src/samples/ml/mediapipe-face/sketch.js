// Mediapipe Face Mesh
// カメラから顔のメッシュを検出して可視化

let capture;
let faceLandmarker;
let results;
let modelLoaded = false;

// 主要な顔の輪郭インデックス
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162,
  21, 54, 103, 67, 109,
];

// 目の輪郭
const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

// 唇の輪郭
const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const LIPS_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];

// 眉毛
const LEFT_EYEBROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
const RIGHT_EYEBROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];

async function setup() {
  createCanvas(windowWidth, windowHeight);
  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();

  const vision = await loadMediapipeVision();
  if (vision) {
    await initFaceLandmarker(vision);
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

async function initFaceLandmarker(vision) {
  try {
    const { FaceLandmarker, FilesetResolver } = vision;

    const wasmFiles = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(wasmFiles, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 2,
      outputFaceBlendshapes: true,
    });

    modelLoaded = true;
    console.log("Face Landmarker ready");
  } catch (e) {
    console.error("Failed to init Face Landmarker:", e);
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

  // 左右反転して表示（薄く）
  push();
  translate(offsetX + displayWidth, offsetY);
  scale(-1, 1);
  tint(255, 60);
  image(capture, 0, 0, displayWidth, displayHeight);
  pop();

  // 顔検出
  if (modelLoaded && capture.loadedmetadata) {
    try {
      results = faceLandmarker.detectForVideo(capture.elt, performance.now());
    } catch (e) {
      // 検出エラーは無視
    }
  }

  // 検出結果を描画
  if (results && results.faceLandmarks) {
    for (let i = 0; i < results.faceLandmarks.length; i++) {
      let face = results.faceLandmarks[i];
      let blendshapes = results.faceBlendshapes ? results.faceBlendshapes[i] : null;
      drawFace(face, blendshapes, offsetX, offsetY, displayWidth, displayHeight);
    }
  }

  // ステータス表示
  fill(255);
  noStroke();
  textSize(14);
  text(modelLoaded ? "Face Mesh Active" : "Loading model...", 10, 25);
  if (results && results.faceLandmarks) {
    text(`Faces detected: ${results.faceLandmarks.length}`, 10, 45);
  }
}

function drawFace(landmarks, blendshapes, ox, oy, w, h) {
  // 顔の輪郭
  drawContour(landmarks, FACE_OVAL, ox, oy, w, h, color(100, 200, 255, 180));

  // 眉毛
  drawContour(landmarks, LEFT_EYEBROW, ox, oy, w, h, color(255, 200, 100, 180), false);
  drawContour(landmarks, RIGHT_EYEBROW, ox, oy, w, h, color(255, 200, 100, 180), false);

  // 目
  drawContour(landmarks, LEFT_EYE, ox, oy, w, h, color(100, 255, 200, 200));
  drawContour(landmarks, RIGHT_EYE, ox, oy, w, h, color(100, 255, 200, 200));

  // 唇
  drawContour(landmarks, LIPS_OUTER, ox, oy, w, h, color(255, 100, 150, 200));
  drawContour(landmarks, LIPS_INNER, ox, oy, w, h, color(255, 150, 180, 180));

  // メッシュ全体を薄く表示
  stroke(80, 120, 200, 40);
  strokeWeight(0.5);
  for (let i = 0; i < landmarks.length; i++) {
    let x = ox + (1 - landmarks[i].x) * w;
    let y = oy + landmarks[i].y * h;
    point(x, y);
  }

  // ブレンドシェイプ表示
  if (blendshapes && blendshapes.categories) {
    drawBlendshapes(blendshapes.categories);
  }
}

function drawContour(landmarks, indices, ox, oy, w, h, c, closed = true) {
  stroke(c);
  strokeWeight(2);
  noFill();
  beginShape();
  for (let idx of indices) {
    let x = ox + (1 - landmarks[idx].x) * w;
    let y = oy + landmarks[idx].y * h;
    vertex(x, y);
  }
  if (closed) {
    endShape(CLOSE);
  } else {
    endShape();
  }
}

function drawBlendshapes(categories) {
  // 主要な表情を右側に表示
  const mainExpressions = [
    "browDownLeft",
    "browDownRight",
    "eyeBlinkLeft",
    "eyeBlinkRight",
    "jawOpen",
    "mouthSmileLeft",
    "mouthSmileRight",
  ];

  let y = 70;
  fill(255);
  noStroke();
  textSize(11);
  textAlign(LEFT);

  for (let exp of mainExpressions) {
    let cat = categories.find((c) => c.categoryName === exp);
    if (cat) {
      let val = cat.score;
      text(`${exp}: ${val.toFixed(2)}`, width - 180, y);

      // バー表示
      fill(50);
      rect(width - 180, y + 3, 100, 8);
      fill(100, 200, 255);
      rect(width - 180, y + 3, val * 100, 8);
      fill(255);

      y += 18;
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
