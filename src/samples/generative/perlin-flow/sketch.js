let particles = [];
let numParticles = 1000;
let noiseScale = 0.01;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(20);

  for (let i = 0; i < numParticles; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      prevX: 0,
      prevY: 0
    });
    particles[i].prevX = particles[i].x;
    particles[i].prevY = particles[i].y;
  }
}

function draw() {
  for (let p of particles) {
    let angle = noise(p.x * noiseScale, p.y * noiseScale, frameCount * 0.005) * TWO_PI * 2;

    p.prevX = p.x;
    p.prevY = p.y;
    p.x += cos(angle) * 1;
    p.y += sin(angle) * 1;

    // 画面外に出たらリセット
    if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
      p.x = random(width);
      p.y = random(height);
      p.prevX = p.x;
      p.prevY = p.y;
    }

    stroke(255, 100, 150, 20);
    strokeWeight(1);
    line(p.prevX, p.prevY, p.x, p.y);
  }
}

function mousePressed() {
  background(20);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(20);
}
