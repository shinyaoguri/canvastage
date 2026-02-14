let particles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  for (let i = 0; i < 60; i++) {
    particles.push({ x: random(width), y: random(height), s: random(1, 3) });
  }
}

function draw() {
  background(20);

  for (let p of particles) {
    p.y -= p.s;
    if (p.y < 0) { p.y = height; p.x = random(width); }
    fill(255, 200, 100, 180);
    ellipse(p.x, p.y, p.s * 3);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
