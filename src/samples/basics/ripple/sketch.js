let rings = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  noFill();
}

function draw() {
  background(20);

  for (let i = rings.length - 1; i >= 0; i--) {
    let r = rings[i];
    r.size += 3;
    r.alpha -= 3;
    stroke(100, 180, 255, r.alpha);
    ellipse(r.x, r.y, r.size);
    if (r.alpha <= 0) rings.splice(i, 1);
  }
}

function mousePressed() {
  rings.push({ x: mouseX, y: mouseY, size: 0, alpha: 255 });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
