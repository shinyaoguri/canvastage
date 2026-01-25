function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(20);
  translate(width / 2, height / 2);

  let numPoints = 500;
  let maxRadius = min(width, height) * 0.4;

  noFill();
  beginShape();
  for (let i = 0; i < numPoints; i++) {
    let angle = map(i, 0, numPoints, 0, TWO_PI * 10);
    let radius = map(i, 0, numPoints, 0, maxRadius);
    let x = cos(angle + frameCount * 0.02) * radius;
    let y = sin(angle + frameCount * 0.02) * radius;

    let hue = map(i, 0, numPoints, 0, 360);
    colorMode(HSB);
    stroke(hue, 80, 100, 0.8);
    colorMode(RGB);
    strokeWeight(2);
    vertex(x, y);
  }
  endShape();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
