function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(20, 20, 30, 25);

  fill(100, 200, 255);
  noStroke();
  ellipse(mouseX, mouseY, 40, 40);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
