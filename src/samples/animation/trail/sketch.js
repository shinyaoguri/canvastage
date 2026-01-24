let trail = [];
let maxTrail = 50;

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(20);

  // 軌跡に現在位置を追加
  trail.push({ x: mouseX, y: mouseY });
  if (trail.length > maxTrail) {
    trail.shift();
  }

  // 軌跡を描画
  noFill();
  for (let i = 1; i < trail.length; i++) {
    let alpha = map(i, 0, trail.length, 0, 255);
    let weight = map(i, 0, trail.length, 1, 20);
    stroke(255, 100, 150, alpha);
    strokeWeight(weight);
    line(trail[i - 1].x, trail[i - 1].y, trail[i].x, trail[i].y);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
