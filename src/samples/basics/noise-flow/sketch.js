function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
}

function draw() {
  background(20, 15);

  for (let i = 0; i < 30; i++) {
    let x = random(width);
    let y = random(height);
    let n = noise(x * 0.005, y * 0.005, frameCount * 0.01);
    let size = n * 8;
    fill(n * 255, 100, 255 - n * 200, 120);
    ellipse(x, y, size);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
