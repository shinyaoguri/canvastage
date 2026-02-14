let trail = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
}

function draw() {
  background(20);

  trail.push({ x: mouseX, y: mouseY });
  if (trail.length > 40) trail.shift();

  for (let i = 0; i < trail.length; i++) {
    let t = trail[i];
    let size = map(i, 0, trail.length, 2, 24);
    let alpha = map(i, 0, trail.length, 50, 255);
    fill(255, 120, 180, alpha);
    ellipse(t.x, t.y, size);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
