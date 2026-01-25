import { Files } from "./preview";

export const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>sketch</title>
  <script src="https://cdn.jsdelivr.net/npm/p5@1/lib/p5.min.js"></script>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <script src="sketch.js"></script>
</body>
</html>`;

export const DEFAULT_CSS = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

canvas {
  display: block;
}`;

export const DEFAULT_JS = `function setup() {
  createCanvas(windowWidth, windowHeight);
  background(20);
}

function draw() {
  background(20, 20, 30, 25);

  fill(255, 100, 150);
  noStroke();

  let x = width / 2 + sin(frameCount * 0.02) * 200;
  let y = height / 2 + cos(frameCount * 0.03) * 150;
  let size = 50 + sin(frameCount * 0.05) * 30;

  ellipse(x, y, size, size);

  fill(100, 200, 255, 150);
  ellipse(mouseX, mouseY, 30, 30);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}`;

export const DEFAULT_FILES: Files = {
  html: DEFAULT_HTML,
  css: DEFAULT_CSS,
  js: DEFAULT_JS,
};
