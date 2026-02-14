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

export const DEFAULT_FILES: Files = {
  html: DEFAULT_HTML,
  css: DEFAULT_CSS,
  js: `function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(20);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}`,
};
