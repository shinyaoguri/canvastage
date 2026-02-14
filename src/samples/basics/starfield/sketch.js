let stars = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  for (let i = 0; i < 200; i++) {
    stars.push({ x: random(-width, width), y: random(-height, height), z: random(1, 4) });
  }
}

function draw() {
  background(10);
  translate(width / 2, height / 2);

  for (let s of stars) {
    s.x -= s.z * 2;
    if (s.x < -width) s.x = width;
    fill(255, s.z * 80);
    ellipse(s.x, s.y, s.z, s.z);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
