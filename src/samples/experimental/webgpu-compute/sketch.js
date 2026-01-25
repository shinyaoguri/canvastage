// WebGPU Compute Shader でパーティクルを計算
// 注意: WebGPU対応ブラウザが必要（Chrome 113+, Edge 113+）

const NUM_PARTICLES = 5000;
let particles = [];
let device, computePipeline, particleBuffer, uniformBuffer;
let gpuSupported = false;
let gpuReady = false;
let readBuffer = null;
let pendingRead = false;

function setup() {
  createCanvas(windowWidth, windowHeight);

  // 非同期でGPU初期化を開始
  initWebGPU();
}

async function initWebGPU() {
  if (!navigator.gpu) {
    console.log("WebGPU not supported - falling back to CPU");
    initCPU();
    return;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.log("No WebGPU adapter - falling back to CPU");
      initCPU();
      return;
    }

    device = await adapter.requestDevice();
    gpuSupported = true;
    await initGPU();
    gpuReady = true;
    console.log("WebGPU initialized successfully");
  } catch (e) {
    console.log("WebGPU init failed - falling back to CPU:", e.message);
    initCPU();
  }
}

function initCPU() {
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      vx: random(-2, 2),
      vy: random(-2, 2),
    });
  }
}

async function initGPU() {
  const particleData = new Float32Array(NUM_PARTICLES * 4);
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particleData[i * 4 + 0] = Math.random() * width;
    particleData[i * 4 + 1] = Math.random() * height;
    particleData[i * 4 + 2] = (Math.random() - 0.5) * 4;
    particleData[i * 4 + 3] = (Math.random() - 0.5) * 4;
  }

  particleBuffer = device.createBuffer({
    size: particleData.byteLength,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(particleBuffer.getMappedRange()).set(particleData);
  particleBuffer.unmap();

  uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const shaderModule = device.createShaderModule({
    code: `
      struct Particle {
        pos: vec2f,
        vel: vec2f,
      }

      struct Uniforms {
        resolution: vec2f,
        mouse: vec2f,
      }

      @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
      @group(0) @binding(1) var<uniform> uniforms: Uniforms;

      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) id: vec3u) {
        let i = id.x;
        if (i >= arrayLength(&particles)) { return; }

        var p = particles[i];

        let toMouse = uniforms.mouse - p.pos;
        let dist = length(toMouse);
        if (dist > 10.0) {
          let force = normalize(toMouse) * (100.0 / (dist + 50.0));
          p.vel += force * 0.1;
        }

        p.vel *= 0.99;
        p.pos += p.vel;

        if (p.pos.x < 0.0 || p.pos.x > uniforms.resolution.x) { p.vel.x *= -0.8; }
        if (p.pos.y < 0.0 || p.pos.y > uniforms.resolution.y) { p.vel.y *= -0.8; }
        p.pos = clamp(p.pos, vec2f(0.0), uniforms.resolution);

        particles[i] = p;
      }
    `,
  });

  computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module: shaderModule, entryPoint: "main" },
  });

  // 読み取り用バッファを事前に作成
  readBuffer = device.createBuffer({
    size: NUM_PARTICLES * 16,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
}

// 描画データを保持
let displayData = null;

function draw() {
  background(15, 15, 25);

  if (gpuReady) {
    drawGPU();
  } else if (particles.length > 0) {
    drawCPU();
  } else {
    // 初期化中
    fill(255);
    noStroke();
    textSize(16);
    textAlign(CENTER, CENTER);
    text("Initializing WebGPU...", width / 2, height / 2);
    textAlign(LEFT, BASELINE);
  }

  // ステータス表示
  fill(255);
  noStroke();
  textSize(12);
  text(`${gpuSupported ? "WebGPU" : "CPU"} | ${NUM_PARTICLES} particles`, 10, 20);
  text(`FPS: ${floor(frameRate())}`, 10, 35);
}

function drawCPU() {
  noStroke();
  fill(100, 200, 255, 150);

  for (let p of particles) {
    let dx = mouseX - p.x;
    let dy = mouseY - p.y;
    let dist = sqrt(dx * dx + dy * dy);
    if (dist > 10) {
      p.vx += (dx / dist) * 0.3;
      p.vy += (dy / dist) * 0.3;
    }
    p.vx *= 0.99;
    p.vy *= 0.99;
    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0 || p.x > width) p.vx *= -0.8;
    if (p.y < 0 || p.y > height) p.vy *= -0.8;
    p.x = constrain(p.x, 0, width);
    p.y = constrain(p.y, 0, height);

    ellipse(p.x, p.y, 3, 3);
  }
}

function drawGPU() {
  // 前回の読み取りが完了していない場合はスキップ
  if (pendingRead) {
    // 前回のデータで描画
    if (displayData) {
      renderParticles(displayData);
    }
    return;
  }

  // GPU計算を実行
  device.queue.writeBuffer(
    uniformBuffer,
    0,
    new Float32Array([width, height, mouseX, mouseY])
  );

  const bindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } },
    ],
  });

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(computePipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(NUM_PARTICLES / 64));
  passEncoder.end();

  // 新しい読み取りバッファを作成
  const newReadBuffer = device.createBuffer({
    size: NUM_PARTICLES * 16,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  commandEncoder.copyBufferToBuffer(
    particleBuffer,
    0,
    newReadBuffer,
    0,
    NUM_PARTICLES * 16
  );
  device.queue.submit([commandEncoder.finish()]);

  // 非同期で読み取り
  pendingRead = true;
  newReadBuffer.mapAsync(GPUMapMode.READ).then(() => {
    const data = new Float32Array(newReadBuffer.getMappedRange());
    displayData = new Float32Array(data);
    newReadBuffer.unmap();
    newReadBuffer.destroy();
    pendingRead = false;
  }).catch(() => {
    pendingRead = false;
  });

  // 現在のデータで描画
  if (displayData) {
    renderParticles(displayData);
  }
}

function renderParticles(data) {
  noStroke();
  fill(100, 200, 255, 150);
  for (let i = 0; i < NUM_PARTICLES; i++) {
    ellipse(data[i * 4], data[i * 4 + 1], 3, 3);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
