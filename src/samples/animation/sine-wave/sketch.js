function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(20);

  stroke(100, 200, 255);
  strokeWeight(2);
  noFill();

  beginShape();
  for (let x = 0; x < width; x += 5) {
    let y = height / 2 + sin((x + frameCount * 2) * 0.02) * 100;
    vertex(x, y);
  }
  endShape();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
