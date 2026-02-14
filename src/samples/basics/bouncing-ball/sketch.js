let x, y, vx, vy;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  x = width / 2;
  y = height / 2;
  vx = 3;
  vy = 2;
}

function draw() {
  background(20);

  x += vx;
  y += vy;
  if (x < 20 || x > width - 20) vx *= -1;
  if (y < 20 || y > height - 20) vy *= -1;

  fill(100, 200, 255);
  ellipse(x, y, 40, 40);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
