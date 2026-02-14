function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CENTER);
  noFill();
}

function draw() {
  background(20);
  translate(width / 2, height / 2);

  for (let i = 0; i < 8; i++) {
    let angle = frameCount * 0.01 * (i + 1);
    let size = 40 + i * 30;
    stroke(255, 100 + i * 20, 150, 200);
    push();
    rotate(angle);
    rect(0, 0, size, size);
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
