function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
}

function draw() {
  background(20);

  // ライティング
  ambientLight(60);
  directionalLight(255, 255, 255, 0, 0, -1);
  pointLight(255, 100, 150, mouseX - width / 2, mouseY - height / 2, 200);

  // 回転
  rotateX(frameCount * 0.01);
  rotateY(frameCount * 0.013);

  // マテリアル
  ambientMaterial(100, 200, 255);

  box(150);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
