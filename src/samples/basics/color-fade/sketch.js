function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
}

function draw() {
  background(20);

  let cols = 10, rows = 10;
  let w = width / cols, h = height / rows;

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let hue = (i * 25 + j * 25 + frameCount) % 360;
      fill(color(`hsl(${hue}, 70%, 60%)`));
      rect(i * w, j * h, w - 2, h - 2, 4);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
