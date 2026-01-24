let angle;

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(20);

  angle = map(mouseX, 0, width, 0, PI / 3);

  stroke(100, 200, 100);
  strokeWeight(2);

  translate(width / 2, height);
  branch(height / 4);
}

function branch(len) {
  line(0, 0, 0, -len);
  translate(0, -len);

  if (len > 4) {
    push();
    rotate(angle);
    branch(len * 0.67);
    pop();

    push();
    rotate(-angle);
    branch(len * 0.67);
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
