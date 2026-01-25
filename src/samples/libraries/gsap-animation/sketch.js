// @use gsap

let circles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);

  // 円を作成
  for (let i = 0; i < 10; i++) {
    circles.push({
      x: random(width),
      y: random(height),
      size: random(30, 80),
      color: color(random(255), random(255), random(255))
    });
  }
}

function draw() {
  background(20);

  for (let c of circles) {
    fill(c.color);
    noStroke();
    ellipse(c.x, c.y, c.size);
  }
}

function mousePressed() {
  // クリックした円をアニメーション
  for (let c of circles) {
    let d = dist(mouseX, mouseY, c.x, c.y);
    if (d < c.size / 2) {
      gsap.to(c, {
        x: random(width),
        y: random(height),
        size: random(30, 80),
        duration: 0.5,
        ease: "elastic.out(1, 0.3)"
      });
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
