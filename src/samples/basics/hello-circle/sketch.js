function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
}

function draw() {
  background(20);

  let size = 100 + sin(frameCount * 0.03) * 30;
  let r = 255, g = 100 + sin(frameCount * 0.02) * 50, b = 150;

  fill(r, g, b);
  ellipse(width / 2, height / 2, size, size);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
