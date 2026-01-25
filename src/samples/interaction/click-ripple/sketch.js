let ripples = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(20);

  noFill();
  for (let i = ripples.length - 1; i >= 0; i--) {
    let r = ripples[i];
    r.size += 4;
    r.alpha -= 3;

    stroke(100, 200, 255, r.alpha);
    strokeWeight(2);
    ellipse(r.x, r.y, r.size);

    if (r.alpha <= 0) {
      ripples.splice(i, 1);
    }
  }
}

function mousePressed() {
  ripples.push({
    x: mouseX,
    y: mouseY,
    size: 0,
    alpha: 255
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
