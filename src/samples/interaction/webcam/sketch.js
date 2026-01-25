let capture;
let gridSize = 10;

function setup() {
  createCanvas(windowWidth, windowHeight);
  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();
  noStroke();
}

function draw() {
  background(20);

  capture.loadPixels();
  if (capture.pixels.length === 0) return;

  let aspectRatio = capture.width / capture.height;
  let displayHeight = height;
  let displayWidth = displayHeight * aspectRatio;

  if (displayWidth > width) {
    displayWidth = width;
    displayHeight = displayWidth / aspectRatio;
  }

  let offsetX = (width - displayWidth) / 2;
  let offsetY = (height - displayHeight) / 2;

  let cols = floor(displayWidth / gridSize);
  let rows = floor(displayHeight / gridSize);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let x = i * gridSize;
      let y = j * gridSize;

      let captureX = floor(map(i, 0, cols, capture.width, 0));
      let captureY = floor(map(j, 0, rows, 0, capture.height));

      let index = (captureY * capture.width + captureX) * 4;
      let r = capture.pixels[index];
      let g = capture.pixels[index + 1];
      let b = capture.pixels[index + 2];

      let brightness = (r + g + b) / 3;
      let size = map(brightness, 0, 255, 2, gridSize);

      fill(r, g, b);
      ellipse(offsetX + x + gridSize / 2, offsetY + y + gridSize / 2, size, size);
    }
  }
}

function mouseMoved() {
  gridSize = floor(map(mouseX, 0, width, 5, 30));
  gridSize = constrain(gridSize, 5, 30);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
