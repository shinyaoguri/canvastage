let theShader;

const vertSrc = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}
`;

const fragSrc = `
precision mediump float;
varying vec2 vTexCoord;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

void main() {
  vec2 uv = vTexCoord;
  vec2 mouse = u_mouse / u_resolution;

  // 中心からの距離
  vec2 center = uv - 0.5;
  float dist = length(center);

  // マウスからの距離
  float mouseDist = length(uv - mouse);

  // 波紋エフェクト
  float ripple = sin(dist * 30.0 - u_time * 3.0) * 0.5 + 0.5;
  float mouseRipple = sin(mouseDist * 40.0 - u_time * 5.0) * 0.5 + 0.5;

  // カラー生成
  vec3 color = vec3(0.0);
  color.r = ripple * (1.0 - dist);
  color.g = mouseRipple * 0.5;
  color.b = sin(u_time + uv.x * 10.0) * 0.3 + 0.5;

  // ビネット
  float vignette = 1.0 - dist * 0.8;
  color *= vignette;

  gl_FragColor = vec4(color, 1.0);
}
`;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  theShader = createShader(vertSrc, fragSrc);
}

function draw() {
  shader(theShader);
  theShader.setUniform("u_time", millis() / 1000.0);
  theShader.setUniform("u_resolution", [width, height]);
  theShader.setUniform("u_mouse", [mouseX, height - mouseY]);
  rect(0, 0, width, height);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
