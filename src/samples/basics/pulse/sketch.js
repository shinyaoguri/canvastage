function setup() {
  createCanvas(windowWidth, windowHeight);
  noFill();
}

function draw() {
  background(20);
  translate(width / 2, height / 2);

  for (let i = 0; i < 6; i++) {
    let r = (frameCount * 2 + i * 50) % 300;
    let alpha = map(r, 0, 300, 255, 0);
    stroke(255, 100, 200, alpha);
    strokeWeight(2);
    ellipse(0, 0, r * 2, r * 2);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
