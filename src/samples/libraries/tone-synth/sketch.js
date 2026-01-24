// @use tone

let synth;
let notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];

function setup() {
  createCanvas(windowWidth, windowHeight);

  // シンセサイザーを作成
  synth = new Tone.PolySynth(Tone.Synth).toDestination();
}

function draw() {
  background(20);

  let cols = notes.length;
  let w = width / cols;

  for (let i = 0; i < cols; i++) {
    let x = i * w;
    let isHover = mouseX > x && mouseX < x + w;

    if (isHover) {
      fill(100, 200, 255);
    } else {
      fill(50, 80, 100);
    }

    noStroke();
    rect(x + 2, 0, w - 4, height);

    fill(255);
    textAlign(CENTER, BOTTOM);
    textSize(16);
    text(notes[i], x + w / 2, height - 20);
  }

  fill(255, 150);
  textAlign(CENTER, TOP);
  textSize(14);
  text("Click to play notes", width / 2, 20);
}

function mousePressed() {
  // Tone.js の開始（ユーザーインタラクション必須）
  Tone.start();

  let cols = notes.length;
  let w = width / cols;
  let index = floor(mouseX / w);

  if (index >= 0 && index < notes.length) {
    synth.triggerAttackRelease(notes[index], "8n");
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
