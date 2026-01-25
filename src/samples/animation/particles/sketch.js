let particles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(20, 20, 30, 25);

  // 新しいパーティクルを追加
  if (frameCount % 2 === 0) {
    particles.push({
      x: width / 2,
      y: height / 2,
      vx: random(-2, 2),
      vy: random(-2, 2),
      life: 255,
      size: random(5, 15),
      hue: random(360)
    });
  }

  // パーティクルを更新・描画
  colorMode(HSB);
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 2;

    fill(p.hue, 80, 100, p.life / 255);
    noStroke();
    ellipse(p.x, p.y, p.size);

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
  colorMode(RGB);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
