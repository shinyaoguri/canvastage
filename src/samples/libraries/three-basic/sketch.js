let scene, camera, renderer, cube;

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Three.js セットアップ
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(width, height);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  document.body.appendChild(renderer.domElement);

  // キューブ
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshNormalMaterial();
  cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
}

function draw() {
  // p5.js キャンバスをクリア
  clear();

  // Three.js アニメーション
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
