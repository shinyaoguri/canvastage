let cols, rows;
let cellSize = 40;

function setup() {
  createCanvas(windowWidth, windowHeight);
  cols = ceil(width / cellSize);
  rows = ceil(height / cellSize);
}

function draw() {
  background(20);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let x = i * cellSize + cellSize / 2;
      let y = j * cellSize + cellSize / 2;
      let d = dist(mouseX, mouseY, x, y);
      let size = map(d, 0, 200, cellSize * 0.8, cellSize * 0.2);
      size = constrain(size, cellSize * 0.1, cellSize * 0.8);

      fill(255, 100, 150, 200);
      noStroke();
      ellipse(x, y, size, size);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cols = ceil(width / cellSize);
  rows = ceil(height / cellSize);
}
