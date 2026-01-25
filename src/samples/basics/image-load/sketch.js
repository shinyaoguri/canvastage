let img;
let angle = 0;

function preload() {
  // picsum.photos はCORS対応の画像サービス
  img = loadImage("https://picsum.photos/800/600");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  imageMode(CENTER);
}

function draw() {
  background(20);

  push();
  translate(width / 2, height / 2);
  rotate(sin(angle) * 0.1);

  let scale = 0.5 + sin(frameCount * 0.02) * 0.1;
  let w = img.width * scale;
  let h = img.height * scale;

  image(img, 0, 0, w, h);
  pop();

  angle += 0.02;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
