let x, y;
let speed = 5;

function setup() {
  createCanvas(windowWidth, windowHeight);
  x = width / 2;
  y = height / 2;
}

function draw() {
  background(20, 20, 30, 50);

  // WASDまたは矢印キーで移動
  if (keyIsPressed) {
    if (key === 'w' || key === 'W' || keyCode === UP_ARROW) y -= speed;
    if (key === 's' || key === 'S' || keyCode === DOWN_ARROW) y += speed;
    if (key === 'a' || key === 'A' || keyCode === LEFT_ARROW) x -= speed;
    if (key === 'd' || key === 'D' || keyCode === RIGHT_ARROW) x += speed;
  }

  // 画面端で跳ね返り
  x = constrain(x, 20, width - 20);
  y = constrain(y, 20, height - 20);

  fill(100, 200, 255);
  noStroke();
  ellipse(x, y, 40, 40);

  // 説明テキスト
  fill(255, 150);
  textAlign(CENTER);
  textSize(14);
  text("WASD or Arrow Keys to move", width / 2, 30);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
