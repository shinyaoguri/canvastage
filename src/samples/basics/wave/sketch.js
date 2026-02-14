function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
}

function draw() {
  background(20);

  for (let x = 0; x < width; x += 12) {
    let y = height / 2 + sin((x * 0.02) + frameCount * 0.05) * 80;
    let size = 4 + sin((x * 0.01) + frameCount * 0.03) * 3;
    fill(100, 150 + sin(x * 0.01) * 100, 255, 200);
    ellipse(x, y, size, size);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
