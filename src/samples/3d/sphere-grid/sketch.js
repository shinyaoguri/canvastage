function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
}

function draw() {
  background(20);

  ambientLight(60);
  directionalLight(255, 255, 255, 0.5, 0.5, -1);

  rotateX(frameCount * 0.005);
  rotateY(frameCount * 0.007);

  let spacing = 80;
  let num = 5;

  for (let x = -num; x <= num; x++) {
    for (let y = -num; y <= num; y++) {
      for (let z = -num; z <= num; z++) {
        push();
        translate(x * spacing, y * spacing, z * spacing);

        let d = dist(0, 0, 0, x, y, z);
        let size = map(sin(d * 0.5 + frameCount * 0.05), -1, 1, 10, 30);

        normalMaterial();
        sphere(size);
        pop();
      }
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
