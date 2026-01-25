function setup() {
  createCanvas(windowWidth, windowHeight);
  background(20);
}

function draw() {
  if (mouseIsPressed) {
    stroke(255, 100, 150);
    strokeWeight(4);
    line(pmouseX, pmouseY, mouseX, mouseY);
  }
}

function keyPressed() {
  if (key === 'c' || key === 'C') {
    background(20);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
