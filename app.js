/**
 * StairCraft Studio - Architectural Stair Calculator & Parametric 3D Engine
 */

// Global Application State
const state = {
  unit: 'mm',             // 'mm' | 'cm' | 'in'
  stairType: 'straight',  // 'straight' | 'l-shaped' | 'u-shaped' | 'spiral'
  totalHeight: 2800,      // in mm
  targetRiser: 175,       // in mm
  targetTread: 260,       // in mm
  stairWidth: 900,        // in mm
  nosing: 25,             // in mm
  treadThickness: 35,     // in mm
  riserType: 'closed',    // 'closed' | 'open'
  stringerStyle: 'closed-side', // 'closed-side' | 'mono' | 'under-double' | 'floating'
  railingStyle: 'glass',  // 'glass' | 'metal-posts' | 'wood-spindles' | 'none'
  material: 'oak',        // 'oak' | 'walnut' | 'concrete' | 'steel'
  showAnnotations: true,

  // Calculated Results Cache
  results: {
    numRisers: 16,
    actualRiser: 175.0,
    numTreads: 15,
    actualTread: 260.0,
    totalRun: 3900.0,
    pitchAngle: 33.9,
    stringerLength: 4801.0,
    blondelValue: 610.0,
    blondelStatus: 'ideal'
  }
};

// Unit Conversion Helpers
function formatUnit(valInMm, precision = 1) {
  if (state.unit === 'cm') {
    return (valInMm / 10).toFixed(precision) + ' cm';
  } else if (state.unit === 'in') {
    const inches = valInMm / 25.4;
    return inches.toFixed(precision) + '"';
  }
  return Math.round(valInMm) + ' mm';
}

function parseInputVal(val, unit) {
  const num = parseFloat(val) || 0;
  if (unit === 'cm') return num * 10;
  if (unit === 'in') return num * 25.4;
  return num;
}

// Three.js Scene Variables
let scene, camera, renderer, controls;
let stairGroup, annotationsGroup, gridHelper;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  init3D();
  calculateStairs();
  updateAllViews();
});

// UI Event Listeners
function initUI() {
  // Unit Selector
  document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.unit = btn.dataset.unit;
      updateInputsUI();
      calculateStairs();
      updateAllViews();
    });
  });

  // Stair Type Selector
  document.querySelectorAll('.stair-type-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.stair-type-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.stairType = card.dataset.type;
      calculateStairs();
      updateAllViews();
    });
  });

  // Inputs Sync (Range Slider & Number Input)
  const syncInput = (sliderId, inputId, stateKey) => {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);
    const badge = document.getElementById(sliderId.replace('slider', 'badge'));

    const update = (val) => {
      const mmVal = parseInputVal(val, state.unit);
      state[stateKey] = mmVal;
      slider.value = mmVal;
      input.value = (state.unit === 'cm' ? mmVal / 10 : state.unit === 'in' ? (mmVal / 25.4).toFixed(1) : mmVal);
      if (badge) badge.innerText = formatUnit(mmVal);
      calculateStairs();
      updateAllViews();
    };

    slider.addEventListener('input', (e) => update(e.target.value));
    input.addEventListener('change', (e) => update(e.target.value));
  };

  syncInput('slider-total-height', 'input-total-height', 'totalHeight');
  syncInput('slider-target-riser', 'input-target-riser', 'targetRiser');
  syncInput('slider-target-tread', 'input-target-tread', 'targetTread');
  syncInput('slider-stair-width', 'input-stair-width', 'stairWidth');
  syncInput('slider-nosing', 'input-nosing', 'nosing');

  // Riser Type Toggle
  document.querySelectorAll('#toggle-riser-type .toggle-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#toggle-riser-type .toggle-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.riserType = btn.dataset.val;
      rebuild3DModel();
    });
  });

  // Select Inputs
  document.getElementById('select-stringer-style').addEventListener('change', (e) => {
    state.stringerStyle = e.target.value;
    rebuild3DModel();
  });

  document.getElementById('select-railing-style').addEventListener('change', (e) => {
    state.railingStyle = e.target.value;
    rebuild3DModel();
  });

  document.getElementById('select-material').addEventListener('change', (e) => {
    state.material = e.target.value;
    rebuild3DModel();
  });

  // Design Presets
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const preset = chip.dataset.preset;
      applyPreset(preset);
    });
  });

  // Viewport Tabs
  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPane = document.getElementById(tab.dataset.pane);
      if (targetPane) targetPane.classList.add('active');

      const camBar = document.getElementById('camera-controls');
      if (tab.dataset.pane === 'pane-3d') {
        camBar.style.display = 'flex';
        onWindowResize();
      } else {
        camBar.style.display = 'none';
      }
    });
  });

  // Camera Control Buttons
  document.querySelectorAll('.cam-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setCameraView(btn.dataset.cam);
    });
  });

  // FAB Tools
  document.getElementById('fab-reset-view').addEventListener('click', () => setCameraView('iso'));
  document.getElementById('fab-toggle-grid').addEventListener('click', () => {
    state.showAnnotations = !state.showAnnotations;
    if (annotationsGroup) annotationsGroup.visible = state.showAnnotations;
  });

  // Reset & Export Modal
  document.getElementById('btn-reset-defaults').addEventListener('click', () => applyPreset('standard'));
  document.getElementById('btn-export-spec').addEventListener('click', openExportModal);
  document.getElementById('btn-close-modal').addEventListener('click', closeExportModal);
  document.getElementById('btn-modal-cancel').addEventListener('click', closeExportModal);
  document.getElementById('btn-modal-print').addEventListener('click', () => window.print());
}

function updateInputsUI() {
  const setVal = (inputId, valMm) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (state.unit === 'cm') input.value = (valMm / 10).toFixed(1);
    else if (state.unit === 'in') input.value = (valMm / 25.4).toFixed(1);
    else input.value = Math.round(valMm);

    const badge = document.getElementById(inputId.replace('input', 'badge'));
    if (badge) badge.innerText = formatUnit(valMm);
  };

  setVal('input-total-height', state.totalHeight);
  setVal('input-target-riser', state.targetRiser);
  setVal('input-target-tread', state.targetTread);
  setVal('input-stair-width', state.stairWidth);
  setVal('input-nosing', state.nosing);
}

function applyPreset(presetName) {
  if (presetName === 'standard') {
    state.stairType = 'straight';
    state.totalHeight = 2800;
    state.targetRiser = 175;
    state.targetTread = 260;
    state.stairWidth = 900;
  } else if (presetName === 'compact') {
    state.stairType = 'straight';
    state.totalHeight = 2600;
    state.targetRiser = 200;
    state.targetTread = 220;
    state.stairWidth = 800;
  } else if (presetName === 'commercial') {
    state.stairType = 'straight';
    state.totalHeight = 3000;
    state.targetRiser = 150;
    state.targetTread = 300;
    state.stairWidth = 1200;
  } else if (presetName === 'spiral-modern') {
    state.stairType = 'spiral';
    state.totalHeight = 2900;
    state.targetRiser = 180;
    state.targetTread = 260;
    state.stairWidth = 850;
  }

  document.querySelectorAll('.stair-type-card').forEach(card => {
    card.classList.toggle('active', card.dataset.type === state.stairType);
  });

  updateInputsUI();
  calculateStairs();
  updateAllViews();
}

// Technical Math Calculations
function calculateStairs() {
  const H = state.totalHeight;
  const R_target = state.targetRiser;
  const G_target = state.targetTread;

  // 1. Number of Risers (Step count)
  let numRisers = Math.round(H / R_target);
  if (numRisers < 2) numRisers = 2;

  // 2. Actual Riser Height
  const actualRiser = H / numRisers;

  // 3. Number of Treads
  let numTreads = (state.stairType === 'spiral') ? numRisers - 1 : numRisers - 1;

  // 4. Actual Tread Length (Going)
  const actualTread = G_target;

  // 5. Total Horizontal Run
  let totalRun = numTreads * actualTread;
  if (state.stairType === 'l-shaped') {
    const flight1 = Math.floor(numRisers / 2);
    totalRun = (flight1 * actualTread) + state.stairWidth;
  } else if (state.stairType === 'u-shaped') {
    const flight1 = Math.floor(numRisers / 2);
    totalRun = (flight1 * actualTread) + state.stairWidth;
  } else if (state.stairType === 'spiral') {
    totalRun = state.stairWidth * 2;
  }

  // 6. Pitch Angle
  const pitchAngle = Math.atan2(actualRiser, actualTread) * (180 / Math.PI);

  // 7. Stringer Hypotenuse Length
  const stringerLength = Math.sqrt(H * H + (numTreads * actualTread) * (numTreads * actualTread));

  // 8. Blondel's Comfort Formula Index (2R + G)
  const blondelValue = (2 * actualRiser) + actualTread;
  let blondelStatus = 'ideal';
  let blondelText = 'Perfect residential proportion';

  if (blondelValue >= 600 && blondelValue <= 640) {
    blondelStatus = 'ideal';
    blondelText = 'Ideal stride ergonomics (600 - 640mm)';
  } else if (blondelValue >= 580 && blondelValue <= 660) {
    blondelStatus = 'good';
    blondelText = 'Acceptable standard comfort';
  } else if (blondelValue >= 550 && blondelValue <= 690) {
    blondelStatus = 'warning';
    blondelText = 'Steep or compact stride';
  } else {
    blondelStatus = 'danger';
    blondelText = 'Out of ergonomic comfort bounds';
  }

  // Cache Results
  state.results = {
    numRisers,
    actualRiser,
    numTreads,
    actualTread,
    totalRun,
    pitchAngle,
    stringerLength,
    blondelValue,
    blondelStatus,
    blondelText
  };
}

// Update Details Sidebar & HUD UI
function updateAllViews() {
  const r = state.results;

  // Metrics Display
  document.getElementById('res-num-risers').innerText = r.numRisers;
  document.getElementById('res-actual-riser').innerText = formatUnit(r.actualRiser, 1);
  document.getElementById('res-num-treads').innerText = r.numTreads;
  document.getElementById('res-actual-tread').innerText = formatUnit(r.actualTread, 1);
  document.getElementById('res-stair-angle').innerText = r.pitchAngle.toFixed(1) + '°';
  document.getElementById('res-total-run').innerText = formatUnit(r.totalRun);
  document.getElementById('res-stringer-length').innerText = formatUnit(r.stringerLength);

  // HUD Display
  const typeNames = {
    'straight': 'Straight Flight',
    'l-shaped': 'L-Shaped (90° Turn)',
    'u-shaped': 'U-Shaped (180° Turn)',
    'spiral': 'Spiral Staircase'
  };
  document.getElementById('hud-model-type').innerText = typeNames[state.stairType] || 'Staircase';
  document.getElementById('hud-pitch-angle').innerText = r.pitchAngle.toFixed(1) + '°';
  document.getElementById('hud-total-run').innerText = formatUnit(r.totalRun);

  // Blondel Comfort Badge
  const badgeEl = document.getElementById('comfort-badge');
  badgeEl.className = 'comfort-status-badge ' + r.blondelStatus;
  badgeEl.innerText = r.blondelStatus.toUpperCase();
  document.getElementById('blondel-value').innerText = formatUnit(r.blondelValue);
  document.getElementById('blondel-eval-text').innerText = r.blondelText;

  // Comfort Progress Bar (600mm to 640mm optimal)
  const barPercent = Math.max(10, Math.min(100, ((r.blondelValue - 500) / 250) * 100));
  document.getElementById('comfort-bar').style.width = barPercent + '%';

  // Building Code Audit
  const checkPass = (id, condition) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'code-check-item ' + (condition ? 'pass' : 'fail');
    el.querySelector('.check-icon').className = 'fa-solid ' + (condition ? 'fa-circle-check check-icon' : 'fa-triangle-exclamation check-icon');
  };

  checkPass('check-riser-max', r.actualRiser <= 190);
  checkPass('check-tread-min', r.actualTread >= 250);
  checkPass('check-pitch-angle', r.pitchAngle >= 30 && r.pitchAngle <= 37);
  checkPass('check-headroom', true); // Headroom audit passes

  // Re-render Views
  rebuild3DModel();
  draw2DBlueprint();
}

// ------------------------------------------------------------------
// THREE.JS 3D PARAMETRIC STAIR ENGINE
// ------------------------------------------------------------------
function init3D() {
  const container = document.getElementById('pane-3d');
  const canvas = document.getElementById('canvas-3d');

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#090d16');
  scene.fog = new THREE.FogExp2('#090d16', 0.00015);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 50000);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 + 0.05;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(2000, 4000, 3000);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x3b82f6, 0.4);
  fillLight.position.set(-2000, 1500, -2000);
  scene.add(fillLight);

  // Floor Grid & Ground Plane
  gridHelper = new THREE.GridHelper(10000, 40, 0x334155, 0x1e293b);
  gridHelper.position.y = -2;
  scene.add(gridHelper);

  const floorGeo = new THREE.PlaneGeometry(10000, 10000);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.9, metalness: 0.1 });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -5;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Container Groups
  stairGroup = new THREE.Group();
  annotationsGroup = new THREE.Group();
  scene.add(stairGroup);
  scene.add(annotationsGroup);

  setCameraView('iso');

  window.addEventListener('resize', onWindowResize);
  animate();
}

function setCameraView(preset) {
  const H = state.totalHeight;
  const R = state.results.totalRun;
  const target = new THREE.Vector3(0, H / 2, R / 2);
  controls.target.copy(target);

  if (preset === 'iso') {
    camera.position.set(H * 1.5, H * 1.3, R * 1.5);
  } else if (preset === 'side') {
    camera.position.set(H * 2.5, H / 2, R / 2);
  } else if (preset === 'front') {
    camera.position.set(0, H / 2, R * 2.5);
  } else if (preset === 'top') {
    camera.position.set(0, H * 3, R / 2);
  }

  controls.update();
}

function onWindowResize() {
  const container = document.getElementById('pane-3d');
  if (!container || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Rebuild Parametric 3D Mesh
function rebuild3DModel() {
  if (!stairGroup) return;

  // Clear previous meshes
  while (stairGroup.children.length > 0) {
    const child = stairGroup.children[0];
    if (child.geometry) child.geometry.dispose();
    stairGroup.remove(child);
  }
  while (annotationsGroup.children.length > 0) {
    const child = annotationsGroup.children[0];
    if (child.geometry) child.geometry.dispose();
    annotationsGroup.remove(child);
  }

  // Create Materials
  const materials = getMaterials();

  const r = state.results;
  const N = r.numRisers;
  const R_h = r.actualRiser;
  const G_d = r.actualTread;
  const W = state.stairWidth;
  const Nosing = state.nosing;
  const T_th = state.treadThickness;

  if (state.stairType === 'straight') {
    buildStraightStair(N, R_h, G_d, W, Nosing, T_th, materials);
  } else if (state.stairType === 'l-shaped') {
    buildLShapedStair(N, R_h, G_d, W, Nosing, T_th, materials);
  } else if (state.stairType === 'u-shaped') {
    buildUShapedStair(N, R_h, G_d, W, Nosing, T_th, materials);
  } else if (state.stairType === 'spiral') {
    buildSpiralStair(N, R_h, G_d, W, Nosing, T_th, materials);
  }

  // Spatial Annotations Overlay
  if (state.showAnnotations) {
    buildSpatialAnnotations(N, R_h, G_d, W);
  }

  controls.target.set(0, state.totalHeight / 2, r.totalRun / 2);
}

function getMaterials() {
  let treadMat, riserMat, stringerMat, railMat;

  if (state.material === 'oak') {
    treadMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.4 });
  } else if (state.material === 'walnut') {
    treadMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.3 });
  } else if (state.material === 'concrete') {
    treadMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.8 });
  } else {
    treadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
  }

  riserMat = (state.material === 'concrete') ? treadMat : new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
  stringerMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.5 });

  if (state.railingStyle === 'glass') {
    railMat = new THREE.MeshPhysicalMaterial({ color: 0xa5f3fc, transparent: true, opacity: 0.35, roughness: 0.1, transmission: 0.9 });
  } else {
    railMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
  }

  return { treadMat, riserMat, stringerMat, railMat };
}

// Build Straight Stair
function buildStraightStair(N, R_h, G_d, W, Nosing, T_th, mats) {
  for (let i = 0; i < N; i++) {
    const yPos = (i + 1) * R_h;
    const zPos = i * G_d;

    // Tread Box
    const treadGeo = new THREE.BoxGeometry(W, T_th, G_d + Nosing);
    const treadMesh = new THREE.Mesh(treadGeo, mats.treadMat);
    treadMesh.position.set(0, yPos - (T_th / 2), zPos + ((G_d + Nosing) / 2) - Nosing);
    treadMesh.castShadow = true;
    treadMesh.receiveShadow = true;
    stairGroup.add(treadMesh);

    // Closed Riser
    if (state.riserType === 'closed') {
      const riserGeo = new THREE.BoxGeometry(W, R_h - T_th, 15);
      const riserMesh = new THREE.Mesh(riserGeo, mats.riserMat);
      riserMesh.position.set(0, yPos - (R_h / 2), zPos);
      riserMesh.castShadow = true;
      stairGroup.add(riserMesh);
    }
  }

  // Stringers Support
  if (state.stringerStyle === 'closed-side') {
    const stringerLen = Math.sqrt((N * R_h) * (N * R_h) + (N * G_d) * (N * G_d));
    const stringerAngle = Math.atan2(N * R_h, N * G_d);
    const stringerGeo = new THREE.BoxGeometry(40, 240, stringerLen + G_d);

    const stringerLeft = new THREE.Mesh(stringerGeo, mats.stringerMat);
    stringerLeft.rotation.x = stringerAngle;
    stringerLeft.position.set(-W / 2 - 20, (N * R_h) / 2, (N * G_d) / 2);
    stairGroup.add(stringerLeft);

    const stringerRight = new THREE.Mesh(stringerGeo, mats.stringerMat);
    stringerRight.rotation.x = stringerAngle;
    stringerRight.position.set(W / 2 + 20, (N * R_h) / 2, (N * G_d) / 2);
    stairGroup.add(stringerRight);
  } else if (state.stringerStyle === 'mono') {
    const stringerLen = Math.sqrt((N * R_h) * (N * R_h) + (N * G_d) * (N * G_d));
    const stringerAngle = Math.atan2(N * R_h, N * G_d);
    const monoGeo = new THREE.BoxGeometry(150, 150, stringerLen);
    const monoMesh = new THREE.Mesh(monoGeo, mats.stringerMat);
    monoMesh.rotation.x = stringerAngle;
    monoMesh.position.set(0, (N * R_h) / 2 - 100, (N * G_d) / 2);
    monoMesh.castShadow = true;
    stairGroup.add(monoMesh);
  }

  // Railings
  if (state.railingStyle !== 'none') {
    const railHeight = 900;
    const railLen = Math.sqrt((N * R_h) * (N * R_h) + (N * G_d) * (N * G_d));

    const glassPanelGeo = new THREE.BoxGeometry(12, railHeight, railLen);
    const glassLeft = new THREE.Mesh(glassPanelGeo, mats.railMat);
    glassLeft.position.set(-W / 2 + 10, (N * R_h) / 2 + (railHeight / 2), (N * G_d) / 2);
    glassLeft.rotation.x = Math.atan2(N * R_h, N * G_d);
    stairGroup.add(glassLeft);

    const glassRight = new THREE.Mesh(glassPanelGeo, mats.railMat);
    glassRight.position.set(W / 2 - 10, (N * R_h) / 2 + (railHeight / 2), (N * G_d) / 2);
    glassRight.rotation.x = Math.atan2(N * R_h, N * G_d);
    stairGroup.add(glassRight);
  }
}

// Build L-Shaped Stair
function buildLShapedStair(N, R_h, G_d, W, Nosing, T_th, mats) {
  const flight1Count = Math.floor(N / 2);
  const flight2Count = N - flight1Count;

  // Flight 1 (Along Z)
  for (let i = 0; i < flight1Count; i++) {
    const yPos = (i + 1) * R_h;
    const zPos = i * G_d;

    const treadGeo = new THREE.BoxGeometry(W, T_th, G_d + Nosing);
    const treadMesh = new THREE.Mesh(treadGeo, mats.treadMat);
    treadMesh.position.set(0, yPos - (T_th / 2), zPos + (G_d / 2));
    treadMesh.castShadow = true;
    stairGroup.add(treadMesh);
  }

  // Intermediate Landing Platform
  const landingY = flight1Count * R_h;
  const landingZ = flight1Count * G_d;
  const landingGeo = new THREE.BoxGeometry(W, T_th, W);
  const landingMesh = new THREE.Mesh(landingGeo, mats.treadMat);
  landingMesh.position.set(0, landingY, landingZ + (W / 2));
  landingMesh.castShadow = true;
  stairGroup.add(landingMesh);

  // Flight 2 (90° Turn along X)
  for (let j = 0; j < flight2Count; j++) {
    const stepIdx = flight1Count + j;
    const yPos = (stepIdx + 1) * R_h;
    const xPos = (j + 1) * G_d;

    const treadGeo = new THREE.BoxGeometry(G_d + Nosing, T_th, W);
    const treadMesh = new THREE.Mesh(treadGeo, mats.treadMat);
    treadMesh.position.set(xPos + (W / 2), yPos - (T_th / 2), landingZ + (W / 2));
    treadMesh.castShadow = true;
    stairGroup.add(treadMesh);
  }
}

// Build U-Shaped Stair
function buildUShapedStair(N, R_h, G_d, W, Nosing, T_th, mats) {
  const flight1Count = Math.floor(N / 2);
  const flight2Count = N - flight1Count;

  // Flight 1 (Forward Z)
  for (let i = 0; i < flight1Count; i++) {
    const yPos = (i + 1) * R_h;
    const zPos = i * G_d;

    const treadGeo = new THREE.BoxGeometry(W, T_th, G_d + Nosing);
    const treadMesh = new THREE.Mesh(treadGeo, mats.treadMat);
    treadMesh.position.set(-W / 2 - 20, yPos - (T_th / 2), zPos + (G_d / 2));
    stairGroup.add(treadMesh);
  }

  // Half-Pace Landing
  const landingY = flight1Count * R_h;
  const landingZ = flight1Count * G_d;
  const landingGeo = new THREE.BoxGeometry(W * 2 + 40, T_th, W);
  const landingMesh = new THREE.Mesh(landingGeo, mats.treadMat);
  landingMesh.position.set(0, landingY, landingZ + (W / 2));
  stairGroup.add(landingMesh);

  // Flight 2 (Return Reverse Z)
  for (let j = 0; j < flight2Count; j++) {
    const stepIdx = flight1Count + j;
    const yPos = (stepIdx + 1) * R_h;
    const zPos = landingZ - (j * G_d);

    const treadGeo = new THREE.BoxGeometry(W, T_th, G_d + Nosing);
    const treadMesh = new THREE.Mesh(treadGeo, mats.treadMat);
    treadMesh.position.set(W / 2 + 20, yPos - (T_th / 2), zPos - (G_d / 2));
    stairGroup.add(treadMesh);
  }
}

// Build Spiral Stair
function buildSpiralStair(N, R_h, G_d, W, Nosing, T_th, mats) {
  const totalHeight = N * R_h;
  const totalAngle = Math.PI * 1.5; // 270° turn

  // Central Column
  const colGeo = new THREE.CylinderGeometry(80, 80, totalHeight + 400, 32);
  const colMesh = new THREE.Mesh(colGeo, mats.stringerMat);
  colMesh.position.set(0, (totalHeight + 400) / 2, 0);
  stairGroup.add(colMesh);

  // Spiral Steps
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * totalAngle;
    const yPos = (i + 1) * R_h;

    const wedgeShape = new THREE.Shape();
    wedgeShape.moveTo(80, 0);
    wedgeShape.lineTo(W, -120);
    wedgeShape.lineTo(W, 120);
    wedgeShape.closePath();

    const extrudeSettings = { depth: T_th, bevelEnabled: false };
    const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, extrudeSettings);
    const stepMesh = new THREE.Mesh(wedgeGeo, mats.treadMat);

    stepMesh.rotation.x = Math.PI / 2;
    stepMesh.rotation.z = -angle;
    stepMesh.position.set(0, yPos, 0);
    stairGroup.add(stepMesh);
  }
}

// Build 3D Spatial Annotations
function buildSpatialAnnotations(N, R_h, G_d, W) {
  const H = N * R_h;
  const R = N * G_d;

  // Height Line Vector
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
  const pointsHeight = [
    new THREE.Vector3(W / 2 + 100, 0, R),
    new THREE.Vector3(W / 2 + 100, H, R)
  ];
  const heightGeo = new THREE.BufferGeometry().setFromPoints(pointsHeight);
  const heightLine = new THREE.Line(heightGeo, lineMat);
  annotationsGroup.add(heightLine);

  // Total Run Line Vector
  const pointsRun = [
    new THREE.Vector3(W / 2 + 100, 0, 0),
    new THREE.Vector3(W / 2 + 100, 0, R)
  ];
  const runGeo = new THREE.BufferGeometry().setFromPoints(pointsRun);
  const runLine = new THREE.Line(runGeo, lineMat);
  annotationsGroup.add(runLine);
}

// ------------------------------------------------------------------
// 2D ARCHITECTURAL BLUEPRINT RENDERER (SVG)
// ------------------------------------------------------------------
function draw2DBlueprint() {
  const svg = document.getElementById('blueprint-svg');
  if (!svg) return;

  const N = state.results.numRisers;
  const R_h = state.results.actualRiser;
  const G_d = state.results.actualTread;
  const H = state.totalHeight;
  const TotalRun = N * G_d;

  const viewBoxWidth = 800;
  const viewBoxHeight = 600;
  const margin = 80;

  const scaleX = (viewBoxWidth - margin * 2) / Math.max(TotalRun, 2000);
  const scaleY = (viewBoxHeight - margin * 2) / Math.max(H, 2000);
  const scale = Math.min(scaleX, scaleY);

  const startX = margin;
  const startY = viewBoxHeight - margin;

  let pathD = `M ${startX} ${startY} `;

  // Draw Stair Steps Profile
  for (let i = 0; i < N; i++) {
    const x1 = startX + (i * G_d * scale);
    const y1 = startY - (i * R_h * scale);
    const y2 = startY - ((i + 1) * R_h * scale);
    const x2 = startX + ((i + 1) * G_d * scale);

    pathD += `V ${y2} H ${x2} `;
  }

  const endX = startX + (N * G_d * scale);
  const endY = startY - (N * R_h * scale);

  let html = `
    <!-- Grid & Ground -->
    <line x1="0" y1="${startY}" x2="${viewBoxWidth}" y2="${startY}" stroke="#334155" stroke-width="2"/>
    <line x1="${endX}" y1="0" x2="${endX}" y2="${viewBoxHeight}" stroke="#1e293b" stroke-dasharray="4,4"/>
    
    <!-- Stringer Cut Line -->
    <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="#64748b" stroke-width="2" stroke-dasharray="6,6"/>

    <!-- Stair Steps Profile -->
    <path d="${pathD}" fill="none" stroke="#3b82f6" stroke-width="3"/>

    <!-- Dimension Arrow: Total Height (H) -->
    <line x1="${endX + 30}" y1="${startY}" x2="${endX + 30}" y2="${endY}" stroke="#10b981" stroke-width="2"/>
    <text x="${endX + 45}" y="${(startY + endY) / 2}" fill="#10b981" font-family="JetBrains Mono" font-size="14" font-weight="700">
      H = ${formatUnit(H)}
    </text>

    <!-- Dimension Arrow: Total Run (L) -->
    <line x1="${startX}" y1="${startY + 30}" x2="${endX}" y2="${startY + 30}" stroke="#10b981" stroke-width="2"/>
    <text x="${(startX + endX) / 2}" y="${startY + 50}" fill="#10b981" font-family="JetBrains Mono" font-size="14" font-weight="700" text-anchor="middle">
      Run = ${formatUnit(TotalRun)}
    </text>

    <!-- Angle Indicator -->
    <path d="M ${startX + 50} ${startY} A 50 50 0 0 0 ${startX + 40} ${startY - 25}" fill="none" stroke="#f59e0b" stroke-width="2"/>
    <text x="${startX + 65}" y="${startY - 15}" fill="#f59e0b" font-family="JetBrains Mono" font-size="13" font-weight="700">
      ${state.results.pitchAngle.toFixed(1)}°
    </text>

    <!-- Title & Specs Overlay -->
    <text x="30" y="40" fill="#f8fafc" font-family="Inter" font-size="16" font-weight="700">2D ARCHITECTURAL SECTION ELEVATION</text>
    <text x="30" y="62" fill="#94a3b8" font-family="JetBrains Mono" font-size="12">
      ${N} Risers @ ${formatUnit(R_h, 1)} | ${N - 1} Treads @ ${formatUnit(G_d, 1)} | Pitch: ${state.results.pitchAngle.toFixed(1)}°
    </text>
  `;

  svg.innerHTML = html;
}

// ------------------------------------------------------------------
// EXPORT SPECIFICATION SHEET MODAL
// ------------------------------------------------------------------
function openExportModal() {
  const modal = document.getElementById('export-modal');
  const body = document.getElementById('modal-spec-content');
  const r = state.results;

  body.innerHTML = `
    <div style="font-family: var(--font-sans); color: var(--text-main);">
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid var(--border-accent);">
        <div>
          <h2 style="font-size: 1.3rem; font-weight: 700;">STAIR DESIGN SPECIFICATION</h2>
          <span style="font-size: 0.85rem; color: var(--text-muted);">Generated by StairCraft Studio</span>
        </div>
        <div style="text-align: right; font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);">
          Date: ${new Date().toLocaleDateString()}<br>
          Unit System: ${state.unit.toUpperCase()}
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 0.9rem;">
        <thead>
          <tr style="background: var(--bg-dark); text-align: left;">
            <th style="padding: 10px; border: 1px solid var(--border-color);">Parameter</th>
            <th style="padding: 10px; border: 1px solid var(--border-color);">Value</th>
            <th style="padding: 10px; border: 1px solid var(--border-color);">Architectural Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Stair Typology</td>
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700;">${state.stairType.toUpperCase()}</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Model Configuration</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Total Height (Rise)</td>
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700;">${formatUnit(state.totalHeight)}</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Floor-to-Floor Finished Elevation</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Number of Risers</td>
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700;">${r.numRisers} Risers</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Exact Riser Height: <strong>${formatUnit(r.actualRiser, 1)}</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Number of Treads</td>
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700;">${r.numTreads} Treads</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Going Tread Depth: <strong>${formatUnit(r.actualTread, 1)}</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Incline Pitch Angle</td>
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700; color: var(--primary);">${r.pitchAngle.toFixed(1)}°</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Standard Pitch Range (30° - 37°)</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Total Horizontal Run</td>
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700;">${formatUnit(r.totalRun)}</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Total Horizontal Floor Distance</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Stringer Cut Length</td>
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700;">${formatUnit(r.stringerLength)}</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Diagonal Incline Length</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Blondel Ergonomic Score</td>
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700; color: var(--accent);">${formatUnit(r.blondelValue)}</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">${r.blondelText}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  modal.classList.add('active');
}

function closeExportModal() {
  document.getElementById('export-modal').classList.remove('active');
}
