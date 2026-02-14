let engine, world;
let boxes = [];
let ground;

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Matter.js エンジン
  engine = Matter.Engine.create();
  world = engine.world;

  // 地面
  ground = Matter.Bodies.rectangle(width / 2, height + 25, width, 50, { isStatic: true });
  Matter.World.add(world, ground);
}

function draw() {
  background(20);

  Matter.Engine.update(engine);

  // ボックスを描画
  fill(100, 200, 255);
  noStroke();
  for (let box of boxes) {
    push();
    translate(box.position.x, box.position.y);
    rotate(box.angle);
    rectMode(CENTER);
    rect(0, 0, 40, 40);
    pop();
  }

  // 地面を描画
  fill(50);
  rectMode(CENTER);
  rect(width / 2, height + 25, width, 50);

  fill(255, 150);
  textAlign(CENTER, TOP);
  textSize(14);
  text("Click to drop boxes", width / 2, 20);
}

function mousePressed() {
  let box = Matter.Bodies.rectangle(mouseX, mouseY, 40, 40);
  boxes.push(box);
  Matter.World.add(world, box);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 地面を再配置
  Matter.Body.setPosition(ground, { x: width / 2, y: height + 25 });
}
