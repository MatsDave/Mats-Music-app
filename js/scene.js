import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const ACCENT = 0xff9d2c;

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.72,
    metalness: opts.metalness ?? 0.08,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    flatShading: opts.flatShading ?? true,
  });
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Punch out near-black background and crop to the character. */
function punchBlackToAlpha(img, threshold = 28) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = frame.data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (lum < threshold) {
      d[i + 3] = 0;
    } else {
      const px = (i / 4) % canvas.width;
      const py = Math.floor(i / 4 / canvas.width);
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
  }
  ctx.putImageData(frame, 0, 0);
  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(canvas.width - 1, maxX + pad);
  maxY = Math.min(canvas.height - 1, maxY + pad);
  const w = Math.max(1, maxX - minX + 1);
  const h = Math.max(1, maxY - minY + 1);
  const cropped = document.createElement("canvas");
  cropped.width = w;
  cropped.height = h;
  cropped.getContext("2d").drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
  return cropped;
}

async function createHeroCharacter() {
  const g = new THREE.Group();
  const img = await loadImage("ui/hero.png");
  const punched = punchBlackToAlpha(img);
  const tex = new THREE.CanvasTexture(punched);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;

  const aspect = punched.width / punched.height;
  const height = 2.55;
  const width = height * aspect;
  const matHero = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.2,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  // Primary figure — your artwork (Y-billboard keeps her upright)
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), matHero);
  plane.position.y = height * 0.5;
  plane.renderOrder = 2;
  g.add(plane);

  // Soft ground shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  g.add(shadow);

  // Stand in front of the bench so the seat never covers her legs
  g.position.set(1.15, 0.02, 2.35);
  g.userData.homeY = 0.02;
  g.userData.billboard = plane;
  g.userData.heroHeight = height;
  return g;
}

function createLamp(x, z) {
  const g = new THREE.Group();
  const pole = box(0.08, 3.4, 0.08, mat(0x2a3148, { metalness: 0.4 }), 0, 1.7, 0);
  const arm = box(0.7, 0.06, 0.06, mat(0x2a3148, { metalness: 0.4 }), 0.2, 3.35, 0);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.12, 20), mat(ACCENT, { emissive: ACCENT, emissiveIntensity: 0.85, roughness: 0.35 }));
  dome.position.set(0.45, 3.22, 0);
  const light = new THREE.PointLight(ACCENT, 2.2, 14, 1.6);
  light.position.set(0.45, 3.05, 0);
  light.castShadow = true;
  g.add(pole, arm, dome, light);
  g.position.set(x, 0, z);
  g.userData.dome = dome;
  g.userData.light = light;
  return g;
}

function createKiosk() {
  const g = new THREE.Group();
  const body = box(1.4, 2.4, 0.55, mat(0x171c2c), -4.2, 1.2, 0.6);
  const screen = box(1.05, 1.35, 0.05, mat(0x0a0c14, { emissive: 0x1a2238, emissiveIntensity: 0.4 }), -4.2, 1.45, 0.9);
  const stripe = box(1.05, 0.12, 0.06, mat(ACCENT, { emissive: ACCENT, emissiveIntensity: 0.7 }), -4.2, 2.25, 0.92);
  g.add(body, screen, stripe);

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a0c14";
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = "#ff9d2c";
  ctx.font = "bold 22px Varela Round, sans-serif";
  ctx.fillText("SOLIDIFY", 48, 55);
  ctx.fillText("YOUR BOND", 32, 88);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.48), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  label.position.set(-4.2, 1.55, 0.94);
  g.add(label);
  return g;
}

function createBridge() {
  const g = new THREE.Group();
  const wall = mat(0xc4a882, { roughness: 0.88 });
  const tile = mat(0x8b6b4a, { roughness: 0.92 });
  // continuous right wall flush with platform (closes the void gap)
  g.add(box(1.2, 8, 14, tile, 9.2, 3.5, 0.5));
  // tiled face strip
  for (let y = 0; y < 6; y++) {
    for (let z = 0; z < 8; z++) {
      if ((y + z) % 2 === 0) continue;
      g.add(box(0.08, 0.85, 1.4, wall, 8.58, 0.6 + y * 1.05, -4.5 + z * 1.55));
    }
  }
  // overhead bridge teeth connecting into the wall
  g.add(box(8, 0.4, 1.4, wall, 5.2, 3.1, -0.6));
  for (let i = 0; i < 7; i++) {
    g.add(box(0.4, 0.6, 0.4, wall, 2.4 + i * 0.85, 3.55, -0.6));
  }
  g.add(box(0.7, 3.6, 1.3, wall, 8.4, 1.7, -0.5));
  // filler slab between platform deck and wall
  g.add(box(4.5, 0.35, 8, mat(0x151a2a, { roughness: 0.9 }), 6.5, -0.15, 1.0));
  return g;
}

function createPlatform() {
  const g = new THREE.Group();
  const deckMat = mat(0x151a2a, { roughness: 0.9 });
  // wider deck so it meets the right wall
  const deck = box(22, 0.35, 9, deckMat, 0.5, -0.15, 0.8);
  deck.receiveShadow = true;
  g.add(deck);

  const edgeMat = mat(ACCENT, { emissive: ACCENT, emissiveIntensity: 0.95, roughness: 0.3 });
  g.add(box(20, 0.04, 0.12, edgeMat, 0.2, 0.04, 4.85));
  g.add(box(20, 0.04, 0.12, edgeMat, 0.2, 0.04, 4.15));

  // tracks
  const rail = mat(0x3a4258, { metalness: 0.7, roughness: 0.4 });
  g.add(box(40, 0.08, 0.12, rail, 0, -0.55, 6.4));
  g.add(box(40, 0.08, 0.12, rail, 0, -0.55, 7.3));
  for (let i = -18; i <= 18; i += 1.1) {
    g.add(box(0.18, 0.08, 1.15, mat(0x2a3144), i, -0.62, 6.85));
  }

  // solid ground — large enough that looking down never shows void
  const ground = box(80, 0.4, 50, mat(0x0a0c14, { roughness: 1 }), 0, -1.2, 2);
  ground.receiveShadow = true;
  g.add(ground);
  // under-deck skirt so underside isn't empty when camera dips
  g.add(box(22, 0.9, 9, mat(0x0d1018), 0.5, -0.7, 0.8));
  return g;
}

function createBackWall() {
  const g = new THREE.Group();
  const brick = mat(0x1c2233, { roughness: 0.92 });
  g.add(box(24, 7, 0.6, brick, 0.5, 3, -3.6));
  // glowing posters
  const posters = [
    { x: -6, c: 0xff9d2c, t: "WAY OUT" },
    { x: -2, c: 0x5eb6ff, t: "NIGHT" },
    { x: 2.5, c: 0xff4fa3, t: "LISTEN" },
    { x: 6, c: 0xb59cff, t: "SOLEIL" },
  ];
  for (const p of posters) {
    g.add(box(2.2, 2.8, 0.08, mat(0x0a0c14, { emissive: p.c, emissiveIntensity: 0.25 }), p.x, 2.4, -3.25));
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0a0c14";
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = `#${p.c.toString(16).padStart(6, "0")}`;
    ctx.font = "bold 42px Varela Round, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.t, 128, 78);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.95), new THREE.MeshBasicMaterial({ map: tex }));
    label.position.set(p.x, 2.4, -3.2);
    g.add(label);
  }
  return g;
}

function createStationProps() {
  const g = new THREE.Group();
  const metal = mat(0x2a3144, { metalness: 0.45, roughness: 0.4 });
  const accent = mat(ACCENT, { emissive: ACCENT, emissiveIntensity: 0.5 });

  // ticket gates / barriers
  for (let i = 0; i < 5; i++) {
    const x = -3.5 + i * 0.85;
    g.add(box(0.35, 1.1, 0.55, metal, x, 0.55, -1.4));
    g.add(box(0.55, 0.08, 0.08, accent, x, 1.05, -1.1));
  }

  // pillars along platform
  for (const x of [-7, -3.5, 3.5, 7]) {
    g.add(box(0.45, 4.2, 0.45, mat(0x1a2030), x, 2.0, -2.2));
  }

  // second bench
  const wood = mat(0xd9c7a8, { roughness: 0.8 });
  g.add(box(2.6, 0.12, 0.65, wood, -5.2, 0.55, 1.4));
  g.add(box(2.6, 0.5, 0.1, wood, -5.2, 0.82, 1.1));
  g.add(box(0.1, 0.5, 0.65, metal, -6.4, 0.28, 1.4));
  g.add(box(0.1, 0.5, 0.65, metal, -4.0, 0.28, 1.4));

  // trash / bin
  g.add(box(0.4, 0.7, 0.4, metal, 2.6, 0.35, 2.2));
  g.add(box(0.42, 0.06, 0.42, accent, 2.6, 0.72, 2.2));

  // info totem
  g.add(box(0.5, 2.2, 0.35, metal, 4.2, 1.1, 2.0));
  g.add(box(0.55, 0.7, 0.08, mat(0x0a0c14, { emissive: 0x5eb6ff, emissiveIntensity: 0.35 }), 4.2, 1.6, 2.2));

  // hanging wayfinding sign
  g.add(box(3.2, 0.7, 0.12, mat(0x12151f, { emissive: ACCENT, emissiveIntensity: 0.15 }), 0.2, 3.6, 0.2));
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#12151f";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#ff9d2c";
  ctx.font = "bold 48px Varela Round, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PLATFORM  ◀  NORTH", 256, 80);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.55), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(0.2, 3.6, 0.28);
  g.add(sign);

  // left side short wall so platform doesn't float alone
  g.add(box(1.0, 5, 10, mat(0x141826), -10.2, 2.2, 0.5));

  return g;
}

function createBench() {
  const g = new THREE.Group();
  const wood = mat(0xd9c7a8, { roughness: 0.8 });
  g.add(box(3.2, 0.12, 0.7, wood, 0.4, 0.55, 1.1));
  g.add(box(3.2, 0.55, 0.1, wood, 0.4, 0.85, 0.78));
  g.add(box(0.12, 0.55, 0.7, mat(0x2a3144), -1.05, 0.28, 1.1));
  g.add(box(0.12, 0.55, 0.7, mat(0x2a3144), 1.85, 0.28, 1.1));
  return g;
}

function createGhost() {
  const ghost = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.55, 6, 12),
    mat(0xd9c7a8, { transparent: true, opacity: 0.22, roughness: 0.9 })
  );
  ghost.position.set(-0.35, 0.95, 1.15);
  ghost.castShadow = false;
  return ghost;
}

function createStars() {
  const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 120;
    positions[i * 3 + 1] = 8 + Math.random() * 40;
    positions[i * 3 + 2] = -20 - Math.random() * 60;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.85 }));
}

function createProceduralTrain() {
  const g = new THREE.Group();
  const bodyMat = mat(0x1c2336, { metalness: 0.35, roughness: 0.45 });
  const windowMat = mat(0x7ec8ff, { emissive: 0x3a6a9a, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.3 });
  const stripeMat = mat(ACCENT, { emissive: ACCENT, emissiveIntensity: 0.8 });

  for (let c = 0; c < 4; c++) {
    const car = new THREE.Group();
    car.add(box(4.2, 2.1, 2.4, bodyMat, 0, 1.15, 0));
    car.add(box(3.6, 0.08, 2.42, stripeMat, 0, 0.55, 0));
    for (let w = 0; w < 3; w++) {
      car.add(box(0.85, 0.7, 0.08, windowMat, -1.2 + w * 1.2, 1.45, 1.22));
      car.add(box(0.85, 0.7, 0.08, windowMat, -1.2 + w * 1.2, 1.45, -1.22));
    }
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 16), mat(0x222833, { metalness: 0.6 }));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 1.3, 0.28, 0.95);
      car.add(wheel);
      const wheel2 = wheel.clone();
      wheel2.position.z = -0.95;
      car.add(wheel2);
    }
    car.position.x = c * 4.45;
    g.add(car);
  }
  return g;
}

async function loadTrainModel() {
  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync("models/train_test.glb");
    const root = gltf.scene;
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          o.material.flatShading = true;
          o.material.needsUpdate = true;
        }
      }
    });
    // normalize scale — model sizes vary
    const box3 = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box3.getSize(size);
    // Prefer longest horizontal axis as travel length (X)
    if (size.z > size.x) root.rotation.y = Math.PI / 2;
    root.updateMatrixWorld(true);
    const size2 = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    const targetLen = 18;
    const scale = targetLen / Math.max(size2.x, 0.001);
    root.scale.setScalar(scale);
    const centered = new THREE.Group();
    centered.add(root);
    const mid = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
    root.position.sub(mid);
    root.position.y += size2.y * scale * 0.5;
    return centered;
  } catch {
    return createProceduralTrain();
  }
}

async function loadBackdrop(scene, report) {
  const texLoader = new THREE.TextureLoader();
  try {
    report?.(0.35, "sky");
    const skyTex = await texLoader.loadAsync("textures/sky_tbTextured.png");
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 50),
      new THREE.MeshBasicMaterial({ map: skyTex, fog: false, depthWrite: false })
    );
    sky.position.set(0, 10, -28);
    scene.add(sky);

    report?.(0.5, "backdrop");
    const bgTex = await texLoader.loadAsync("textures/penguin_bg3.webp");
    bgTex.colorSpace = THREE.SRGBColorSpace;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 28),
      new THREE.MeshBasicMaterial({ map: bgTex, transparent: true, fog: false, depthWrite: false })
    );
    bg.position.set(0, 9, -18);
    bg.renderOrder = 1;
    scene.add(bg);

    const moonTex = await texLoader.loadAsync("textures/moon_illus.webp");
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moonPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false })
    );
    moonPlane.position.set(-2, 14, -22);
    scene.add(moonPlane);
  } catch {
    // gradients still work without textures
  }
}

export async function createStationScene(host, { onProgress } = {}) {
  const report = (p, label) => onProgress?.(p, label);
  report(0.05, "renderer");

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.setClearColor(0x06070d, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  Object.assign(renderer.domElement.style, {
    display: "block",
    width: "100%",
    height: "100%",
    touchAction: "none",
    cursor: "grab",
  });

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070914, 0.016);

  const camera = new THREE.PerspectiveCamera(42, host.clientWidth / Math.max(host.clientHeight, 1), 0.1, 220);
  const homePos = new THREE.Vector3(1.15, 1.7, 7.6);
  const homeTarget = new THREE.Vector3(1.15, 1.25, 2.35);
  camera.position.copy(homePos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.target.copy(homeTarget);
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 18;
  // keep camera above the platform — never under the floor
  controls.minPolarAngle = Math.PI * 0.32;
  controls.maxPolarAngle = Math.PI * 0.48;
  // full 360° yaw
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 1.1;

  let lookEnabled = true;
  let trainsEnabled = true;
  let pointerNdc = { x: 0, y: 0 };
  let dragging = false;
  let audioEnergy = 0;

  renderer.domElement.addEventListener("pointerdown", () => {
    dragging = true;
    renderer.domElement.style.cursor = "grabbing";
  });
  window.addEventListener("pointerup", () => {
    dragging = false;
    renderer.domElement.style.cursor = "grab";
  });
  window.addEventListener("pointermove", (e) => {
    pointerNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  report(0.15, "lights");
  scene.add(new THREE.HemisphereLight(0x6a7cb0, 0x1a1420, 0.55));
  const moonLight = new THREE.DirectionalLight(0xb8c8ff, 0.5);
  moonLight.position.set(-8, 18, -6);
  scene.add(moonLight);
  const key = new THREE.DirectionalLight(0xffd2a0, 0.35);
  key.position.set(6, 10, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  report(0.25, "station");
  scene.add(createStars());
  scene.add(createPlatform());
  scene.add(createBench());
  scene.add(createKiosk());
  scene.add(createBridge());
  scene.add(createBackWall());
  scene.add(createStationProps());
  const lampL = createLamp(-3.2, 2.6);
  const lampR = createLamp(3.6, 2.6);
  const lampMid = createLamp(0.2, -0.8);
  scene.add(lampL, lampR, lampMid);
  report(0.4, "hero");
  const hero = await createHeroCharacter();
  scene.add(hero);

  await loadBackdrop(scene, report);

  report(0.7, "train");
  const trainTemplate = await loadTrainModel();
  const trainBackRig = new THREE.Group();
  const trainFrontRig = new THREE.Group();
  const trainBack = trainTemplate.clone(true);
  const trainFront = trainTemplate.clone(true);
  trainBackRig.add(trainBack);
  trainFrontRig.add(trainFront);
  trainBackRig.position.set(-100, -0.15, 6.55);
  trainFrontRig.position.set(100, -0.15, 6.55);
  scene.add(trainBackRig, trainFrontRig);

  // train pass system (inspired by penguin.music trainPassSystem)
  const SPAWN = 42;
  const passes = {
    back: { rig: trainBackRig, dir: 1, active: false, t0: 0, dur: 5000, startX: -SPAWN, endX: SPAWN },
    front: { rig: trainFrontRig, dir: -1, active: false, t0: 0, dur: 5000, startX: SPAWN, endX: -SPAWN },
  };
  let nextPassAt = performance.now() + 1800;
  let nextWhich = "back";

  function startPass(key, burst = false) {
    if (!trainsEnabled) return;
    const p = passes[key];
    p.active = true;
    p.t0 = performance.now();
    p.dur = burst ? 2200 : 5000 + Math.random() * 800;
    p.startX = key === "back" ? -SPAWN : SPAWN;
    p.endX = key === "back" ? SPAWN : -SPAWN;
    p.rig.visible = true;
    p.rig.position.x = p.startX;
    // slight z offset so front/back lanes don't z-fight
    p.rig.position.z = key === "back" ? 6.35 : 6.85;
  }

  function updateTrains(now) {
    if (!trainsEnabled) {
      trainBackRig.visible = false;
      trainFrontRig.visible = false;
      return;
    }
    if (now >= nextPassAt && !passes.back.active && !passes.front.active) {
      startPass(nextWhich, Math.random() < 0.25);
      nextWhich = nextWhich === "back" ? "front" : "back";
      nextPassAt = now + 6500 + Math.random() * 4500;
    }
    for (const p of Object.values(passes)) {
      if (!p.active) continue;
      const u = Math.min(1, (now - p.t0) / p.dur);
      const ease = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      p.rig.position.x = p.startX + (p.endX - p.startX) * ease;
      // fade near edges
      const fade = Math.min(1, Math.abs(p.rig.position.x) < 18 ? 1 : 1 - (Math.abs(p.rig.position.x) - 18) / 24);
      p.rig.traverse((o) => {
        if (o.isMesh && o.material && "opacity" in o.material) {
          o.material.transparent = true;
          o.material.opacity = Math.max(0, fade);
        }
      });
      if (u >= 1) {
        p.active = false;
        p.rig.visible = false;
      }
    }
  }

  report(0.9, "ready");

  const clock = new THREE.Clock();
  let running = true;

  function resize() {
    const w = host.clientWidth;
    const h = Math.max(host.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", resize);

  const parallaxTarget = homeTarget.clone();

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    const now = performance.now();

    // hero — upright Y-billboard + music dance (sway / bounce)
    const homeY = hero.userData.homeY ?? 0.02;
    const dance = audioEnergy;
    hero.position.y = homeY + Math.sin(t * 2.4) * 0.03 + dance * 0.12;
    if (hero.userData.billboard) {
      const plane = hero.userData.billboard;
      const hp = new THREE.Vector3();
      hero.getWorldPosition(hp);
      // Y-axis only billboard — never flips upside down
      const yaw = Math.atan2(camera.position.x - hp.x, camera.position.z - hp.z);
      // hand / shoulder groove: lean + rock with the beat
      const sway = Math.sin(t * 5.5) * (0.04 + dance * 0.22);
      const rock = Math.sin(t * 8.2 + 1.2) * dance * 0.12;
      plane.rotation.set(0, yaw, sway);
      plane.scale.set(
        1 + Math.sin(t * 6.5) * dance * 0.04,
        1 + Math.abs(Math.sin(t * 5.5)) * dance * 0.06,
        1
      );
      plane.position.x = rock * 0.15;
      plane.position.y = (hero.userData.heroHeight ?? 2.5) * 0.5 + Math.sin(t * 11) * dance * 0.05;
    }

    // lamp pulse with audio
    for (const lamp of [lampL, lampR, lampMid]) {
      const pulse = 0.75 + audioEnergy * 1.4 + Math.sin(t * 4) * 0.05;
      lamp.userData.dome.material.emissiveIntensity = pulse;
      lamp.userData.light.intensity = 1.6 + audioEnergy * 3.2;
    }

    updateTrains(now);

    // cursor look (soft parallax) — disabled while turntable / dragging
    if (lookEnabled && !dragging && !controls.autoRotate) {
      parallaxTarget.x = homeTarget.x + pointerNdc.x * 0.35;
      parallaxTarget.y = homeTarget.y + pointerNdc.y * 0.22;
      controls.target.lerp(parallaxTarget, 0.04);
    } else if (!dragging) {
      controls.target.lerp(homeTarget, 0.04);
    }

    controls.update();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    scene,
    camera,
    controls,
    renderer,
    hero,
    setAudioEnergy(v) {
      audioEnergy = THREE.MathUtils.clamp(v, 0, 1);
    },
    setTrainsEnabled(v) {
      trainsEnabled = v;
    },
    setLookEnabled(v) {
      lookEnabled = v;
    },
    setTurntable(v) {
      controls.autoRotate = Boolean(v);
    },
    resetCamera() {
      camera.position.copy(homePos);
      controls.target.copy(homeTarget);
      controls.update();
    },
    burstTrain() {
      startPass(Math.random() < 0.5 ? "back" : "front", true);
    },
    resize,
    dispose() {
      running = false;
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
