function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(20);

  fill(255, 100, 150);
  noStroke();
  ellipse(width / 2, height / 2, 100, 100);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
