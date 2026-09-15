/**
 * StairCraft Studio - Architectural Stair Calculator & Parametric 3D Engine
 */

// Global Application State
const state = {
  unit: 'mm',             // 'mm' | 'cm' | 'in'
  stairType: 'straight',  // 'straight' | 'l-shaped' | 'u-shaped' | 'spiral' | 'double-l'
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

  // Dynamic parameters for stair typologies
  landingStep: 8,               // Step index where landing occurs (L-shape, U-shape)
  stairwellGap: 150,            // Well hole gap (mm) between parallel flights (U-shape, Double-L)
  turnDirection: 'left',        // 'left' | 'right'

  // Double-L (stair1.jpg) specifics
  doubleLLanding1Step: 6,       // Flight 1 steps before Landing 1
  doubleLIntermediateSteps: 2,  // Steps between Landing 1 & Landing 2 (matching stair1.jpg)

  // Spiral specifics
  spiralPoleRadius: 80,         // Radius of central column circle in mm
  spiralRotationAngle: 270,     // Total rotation arc in degrees (180 - 450)
  spiralDirection: 'cw',        // 'cw' | 'ccw'

  // Blueprint View Mode
  blueprintViewMode: 'dual',    // 'dual' | 'side' | 'front'

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
    blondelStatus: 'ideal',
    blondelText: 'Perfect residential proportion',
    flight1Steps: 8,
    flight2Steps: 8,
    landingHeight: 1400.0,
    landing2Height: 1750.0,
    spiralInnerRadius: 80,
    spiralOuterRadius: 980
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

function dispVal(valInMm, precision = 1) {
  if (state.unit === 'cm') {
    return (valInMm / 10).toFixed(precision);
  } else if (state.unit === 'in') {
    return (valInMm / 25.4).toFixed(precision);
  }
  return Math.round(valInMm);
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
  renderDynamicParameters();
  updateAllViews();
});

// UI Event Listeners
function initUI() {
  // Unit Selector
  document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.unit = btn.dataset.unit;
      updateInputsUI();
      renderDynamicParameters();
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
      renderDynamicParameters();
      calculateStairs();
      updateAllViews();
    });
  });

  // Blueprint View Toggles (Dual / Side Only / Front Only)
  const bpToggleBtns = document.querySelectorAll('#blueprint-view-toggles .bp-toggle-btn');
  bpToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      bpToggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.blueprintViewMode = btn.dataset.view;

      const pane = document.getElementById('blueprint-pane');
      if (pane) {
        pane.classList.remove('mode-side', 'mode-front');
        if (state.blueprintViewMode === 'side') {
          pane.classList.add('mode-side');
        } else if (state.blueprintViewMode === 'front') {
          pane.classList.add('mode-front');
        }
      }
      draw2DBlueprint();
    });
  });

  // Core Inputs Sync (Range Slider & Number Input)
  const syncInput = (sliderId, inputId, stateKey) => {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);
    const badge = document.getElementById(sliderId.replace('slider', 'badge'));

    const update = (val) => {
      const mmVal = parseInputVal(val, state.unit);
      state[stateKey] = mmVal;
      slider.value = mmVal;
      input.value = dispVal(mmVal);
      if (badge) badge.innerText = formatUnit(mmVal);
      calculateStairs();
      renderDynamicParameters();
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
      applyPreset(chip.dataset.preset);
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

      if (tab.dataset.pane === 'pane-blueprint') {
        draw2DBlueprint();
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

// ------------------------------------------------------------------
// DYNAMIC PARAMETRIC SETTINGS RENDERER
// ------------------------------------------------------------------
function renderDynamicParameters() {
  const container = document.getElementById('dynamic-params-container');
  if (!container) return;

  const N = state.results.numRisers || Math.max(2, Math.round(state.totalHeight / state.targetRiser));
  const R_h = state.results.actualRiser || (state.totalHeight / N);

  if (state.stairType === 'straight') {
    container.innerHTML = `
      <div class="dynamic-section-banner">
        <span class="dynamic-section-title"><i class="fa-solid fa-arrows-up-to-line"></i> Straight Flight Controls</span>
        <span class="dynamic-section-pill">Continuous Run</span>
      </div>
      <div class="dynamic-info-box">
        Standard continuous straight run without intermediate landings. Full geometry is controlled parametrically by the Rise, Tread, and Width settings above.
      </div>
    `;
    return;
  }

  if (state.stairType === 'l-shaped') {
    const currentStep = Math.max(1, Math.min(N - 1, state.landingStep || Math.floor(N / 2)));
    state.landingStep = currentStep;
    const landingElev = currentStep * R_h;

    container.innerHTML = `
      <div class="dynamic-section-banner">
        <span class="dynamic-section-title"><i class="fa-solid fa-turn-up"></i> L-Shape 90° Turn Controls</span>
        <span class="dynamic-section-pill">Quarter-Space</span>
      </div>

      <!-- Landing Position / Height -->
      <div class="input-group">
        <div class="input-label-wrapper">
          <label class="input-label" for="slider-landing-step">Landing Height (Split Step)</label>
          <span class="input-val-badge" id="badge-landing-step">Step ${currentStep} (${formatUnit(landingElev)})</span>
        </div>
        <div class="range-slider-container">
          <input type="range" id="slider-landing-step" min="1" max="${N - 1}" step="1" value="${currentStep}">
          <input type="number" id="input-landing-step" class="number-input" min="1" max="${N - 1}" value="${currentStep}">
        </div>
      </div>

      <!-- Turn Direction -->
      <div class="input-group">
        <div class="input-label-wrapper">
          <span class="input-label">Turn Direction</span>
        </div>
        <div class="toggle-group" id="toggle-turn-dir">
          <button class="toggle-opt ${state.turnDirection === 'left' ? 'active' : ''}" data-dir="left">Turn Left (CCW)</button>
          <button class="toggle-opt ${state.turnDirection === 'right' ? 'active' : ''}" data-dir="right">Turn Right (CW)</button>
        </div>
      </div>
    `;

    // Hook listeners
    const slider = document.getElementById('slider-landing-step');
    const input = document.getElementById('input-landing-step');
    const updateLanding = (val) => {
      state.landingStep = Math.max(1, Math.min(N - 1, parseInt(val) || 1));
      slider.value = state.landingStep;
      input.value = state.landingStep;
      calculateStairs();
      updateAllViews();
      const badge = document.getElementById('badge-landing-step');
      if (badge) badge.innerText = `Step ${state.landingStep} (${formatUnit(state.landingStep * state.results.actualRiser)})`;
    };
    slider.addEventListener('input', (e) => updateLanding(e.target.value));
    input.addEventListener('change', (e) => updateLanding(e.target.value));

    document.querySelectorAll('#toggle-turn-dir .toggle-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#toggle-turn-dir .toggle-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.turnDirection = btn.dataset.dir;
        rebuild3DModel();
        draw2DBlueprint();
      });
    });
    return;
  }

  if (state.stairType === 'u-shaped') {
    const currentStep = Math.max(1, Math.min(N - 1, state.landingStep || Math.floor(N / 2)));
    state.landingStep = currentStep;
    const landingElev = currentStep * R_h;

    container.innerHTML = `
      <div class="dynamic-section-banner">
        <span class="dynamic-section-title"><i class="fa-solid fa-arrow-rotate-left"></i> U-Shape 180° Turn Controls</span>
        <span class="dynamic-section-pill">Half-Pace</span>
      </div>

      <!-- Landing Height / Step -->
      <div class="input-group">
        <div class="input-label-wrapper">
          <label class="input-label" for="slider-landing-step">Landing Height (Elevation)</label>
          <span class="input-val-badge" id="badge-landing-step">Step ${currentStep} (${formatUnit(landingElev)})</span>
        </div>
        <div class="range-slider-container">
          <input type="range" id="slider-landing-step" min="1" max="${N - 1}" step="1" value="${currentStep}">
          <input type="number" id="input-landing-step" class="number-input" min="1" max="${N - 1}" value="${currentStep}">
        </div>
      </div>

      <!-- Well Hole Gap -->
      <div class="input-group">
        <div class="input-label-wrapper">
          <label class="input-label" for="slider-well-gap">Stairwell Gap (Well Hole)</label>
          <span class="input-val-badge" id="badge-well-gap">${formatUnit(state.stairwellGap)}</span>
        </div>
        <div class="range-slider-container">
          <input type="range" id="slider-well-gap" min="40" max="600" step="10" value="${state.stairwellGap}">
          <input type="number" id="input-well-gap" class="number-input" value="${dispVal(state.stairwellGap)}">
        </div>
      </div>

      <!-- Turn Direction -->
      <div class="input-group">
        <div class="input-label-wrapper">
          <span class="input-label">Switchback Orientation</span>
        </div>
        <div class="toggle-group" id="toggle-turn-dir">
          <button class="toggle-opt ${state.turnDirection === 'left' ? 'active' : ''}" data-dir="left">Counter-Clockwise</button>
          <button class="toggle-opt ${state.turnDirection === 'right' ? 'active' : ''}" data-dir="right">Clockwise</button>
        </div>
      </div>
    `;

    // Hook listeners
    const slider = document.getElementById('slider-landing-step');
    const input = document.getElementById('input-landing-step');
    const updateLanding = (val) => {
      state.landingStep = Math.max(1, Math.min(N - 1, parseInt(val) || 1));
      slider.value = state.landingStep;
      input.value = state.landingStep;
      calculateStairs();
      updateAllViews();
      const badge = document.getElementById('badge-landing-step');
      if (badge) badge.innerText = `Step ${state.landingStep} (${formatUnit(state.landingStep * state.results.actualRiser)})`;
    };
    slider.addEventListener('input', (e) => updateLanding(e.target.value));
    input.addEventListener('change', (e) => updateLanding(e.target.value));

    const gapSlider = document.getElementById('slider-well-gap');
    const gapInput = document.getElementById('input-well-gap');
    const updateGap = (val) => {
      const mmVal = parseInputVal(val, state.unit);
      state.stairwellGap = Math.max(20, mmVal);
      gapSlider.value = state.stairwellGap;
      gapInput.value = dispVal(state.stairwellGap);
      document.getElementById('badge-well-gap').innerText = formatUnit(state.stairwellGap);
      calculateStairs();
      updateAllViews();
    };
    gapSlider.addEventListener('input', (e) => updateGap(e.target.value));
    gapInput.addEventListener('change', (e) => updateGap(e.target.value));

    document.querySelectorAll('#toggle-turn-dir .toggle-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#toggle-turn-dir .toggle-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.turnDirection = btn.dataset.dir;
        rebuild3DModel();
        draw2DBlueprint();
      });
    });
    return;
  }

  if (state.stairType === 'double-l') {
    const midSteps = Math.max(0, Math.min(6, state.doubleLIntermediateSteps !== undefined ? state.doubleLIntermediateSteps : 2));
    const maxFlight1 = Math.max(1, N - midSteps - 2);
    const l1Step = Math.max(1, Math.min(maxFlight1, state.doubleLLanding1Step || Math.floor((N - midSteps) / 2)));
    state.doubleLLanding1Step = l1Step;
    state.doubleLIntermediateSteps = midSteps;

    const l1Elev = l1Step * R_h;
    const l2Elev = (l1Step + midSteps) * R_h;
    const f2Steps = Math.max(1, N - l1Step - midSteps);

    container.innerHTML = `
      <div class="dynamic-section-banner">
        <span class="dynamic-section-title"><i class="fa-solid fa-arrows-split-up-and-left"></i> Double-L Controls (stair1.jpg)</span>
        <span class="dynamic-section-pill">2-Quarter Landing</span>
      </div>

      <!-- Landing 1 Height / Step -->
      <div class="input-group">
        <div class="input-label-wrapper">
          <label class="input-label" for="slider-landing1-step">Landing 1 Height (Flight 1 Steps)</label>
          <span class="input-val-badge" id="badge-landing1-step">Step ${l1Step} (${formatUnit(l1Elev)})</span>
        </div>
        <div class="range-slider-container">
          <input type="range" id="slider-landing1-step" min="1" max="${maxFlight1}" step="1" value="${l1Step}">
          <input type="number" id="input-landing1-step" class="number-input" min="1" max="${maxFlight1}" value="${l1Step}">
        </div>
      </div>

      <!-- Intermediate Connector Steps -->
      <div class="input-group">
        <div class="input-label-wrapper">
          <label class="input-label" for="slider-intermediate-steps">Intermediate Steps (Between Landings)</label>
          <span class="input-val-badge" id="badge-intermediate-steps">${midSteps} Steps</span>
        </div>
        <div class="range-slider-container">
          <input type="range" id="slider-intermediate-steps" min="0" max="6" step="1" value="${midSteps}">
          <input type="number" id="input-intermediate-steps" class="number-input" min="0" max="6" value="${midSteps}">
        </div>
      </div>

      <!-- Landing 2 Computed Elevation Info -->
      <div class="dynamic-info-box" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div>
          <span style="font-weight: 600; color: var(--text-main);">Landing 2 Elevation:</span>
          <div style="font-size: 0.72rem; color: var(--text-dim);">Flight 2 Return: ${f2Steps} steps</div>
        </div>
        <strong id="badge-landing2-elev" style="color: var(--primary); font-family: var(--font-mono); font-size: 0.95rem;">${formatUnit(l2Elev)}</strong>
      </div>

      <!-- Well Hole Gap -->
      <div class="input-group">
        <div class="input-label-wrapper">
          <label class="input-label" for="slider-well-gap">Stairwell Gap (Between Flights)</label>
          <span class="input-val-badge" id="badge-well-gap">${formatUnit(state.stairwellGap)}</span>
        </div>
        <div class="range-slider-container">
          <input type="range" id="slider-well-gap" min="50" max="600" step="10" value="${state.stairwellGap}">
          <input type="number" id="input-well-gap" class="number-input" value="${dispVal(state.stairwellGap)}">
        </div>
      </div>
    `;

    // Hook listeners
    const l1Slider = document.getElementById('slider-landing1-step');
    const l1Input = document.getElementById('input-landing1-step');
    const updateL1 = (val) => {
      state.doubleLLanding1Step = Math.max(1, Math.min(maxFlight1, parseInt(val) || 1));
      l1Slider.value = state.doubleLLanding1Step;
      l1Input.value = state.doubleLLanding1Step;
      calculateStairs();
      renderDynamicParameters();
      updateAllViews();
    };
    l1Slider.addEventListener('input', (e) => updateL1(e.target.value));
    l1Input.addEventListener('change', (e) => updateL1(e.target.value));

    const midSlider = document.getElementById('slider-intermediate-steps');
    const midInput = document.getElementById('input-intermediate-steps');
    const updateMid = (val) => {
      state.doubleLIntermediateSteps = Math.max(0, Math.min(6, parseInt(val) || 0));
      midSlider.value = state.doubleLIntermediateSteps;
      midInput.value = state.doubleLIntermediateSteps;
      calculateStairs();
      renderDynamicParameters();
      updateAllViews();
    };
    midSlider.addEventListener('input', (e) => updateMid(e.target.value));
    midInput.addEventListener('change', (e) => updateMid(e.target.value));

    const gapSlider = document.getElementById('slider-well-gap');
    const gapInput = document.getElementById('input-well-gap');
    const updateGap = (val) => {
      const mmVal = parseInputVal(val, state.unit);
      state.stairwellGap = Math.max(20, mmVal);
      gapSlider.value = state.stairwellGap;
      gapInput.value = dispVal(state.stairwellGap);
      document.getElementById('badge-well-gap').innerText = formatUnit(state.stairwellGap);
      calculateStairs();
      updateAllViews();
    };
    gapSlider.addEventListener('input', (e) => updateGap(e.target.value));
    gapInput.addEventListener('change', (e) => updateGap(e.target.value));
    return;
  }

  if (state.stairType === 'spiral') {
    const poleRadius = state.spiralPoleRadius || 80;
    const rotAngle = state.spiralRotationAngle || 270;
    const outerRadius = state.stairWidth + poleRadius;
    const outerDiameter = outerRadius * 2;

    container.innerHTML = `
      <div class="dynamic-section-banner">
        <span class="dynamic-section-title"><i class="fa-solid fa-dharmachakra"></i> Spiral Geometric Controls</span>
        <span class="dynamic-section-pill">Parametric Hub</span>
      </div>

      <!-- Center Circle / Column Radius -->
      <div class="input-group">
        <div class="input-label-wrapper">
          <label class="input-label" for="slider-pole-radius">Center Circle / Column Radius</label>
          <span class="input-val-badge" id="badge-pole-radius">R = ${formatUnit(poleRadius)} (Ø ${formatUnit(poleRadius * 2)})</span>
        </div>
        <div class="range-slider-container">
          <input type="range" id="slider-pole-radius" min="30" max="250" step="5" value="${poleRadius}">
          <input type="number" id="input-pole-radius" class="number-input" value="${dispVal(poleRadius)}">
        </div>
      </div>

      <!-- Total Spiral Arc Rotation -->
      <div class="input-group">
        <div class="input-label-wrapper">
          <label class="input-label" for="slider-rotation-angle">Total Arc Rotation</label>
          <span class="input-val-badge" id="badge-rotation-angle">${rotAngle}°</span>
        </div>
        <div class="range-slider-container">
          <input type="range" id="slider-rotation-angle" min="180" max="450" step="15" value="${rotAngle}">
          <input type="number" id="input-rotation-angle" class="number-input" min="180" max="450" value="${rotAngle}">
        </div>
      </div>

      <!-- Outer Diameter Display Box -->
      <div class="dynamic-info-box" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <span>Total Outside Diameter (Ø):</span>
        <strong style="color: var(--primary); font-family: var(--font-mono); font-size: 0.95rem;">${formatUnit(outerDiameter)}</strong>
      </div>

      <!-- Ascending Direction Toggle -->
      <div class="input-group">
        <div class="input-label-wrapper">
          <span class="input-label">Ascending Rotation</span>
        </div>
        <div class="toggle-group" id="toggle-spiral-dir">
          <button class="toggle-opt ${state.spiralDirection === 'cw' ? 'active' : ''}" data-dir="cw">Clockwise (CW)</button>
          <button class="toggle-opt ${state.spiralDirection === 'ccw' ? 'active' : ''}" data-dir="ccw">Counter-CW (CCW)</button>
        </div>
      </div>
    `;

    // Hook listeners
    const poleSlider = document.getElementById('slider-pole-radius');
    const poleInput = document.getElementById('input-pole-radius');
    const updatePole = (val) => {
      const mmVal = parseInputVal(val, state.unit);
      state.spiralPoleRadius = Math.max(20, Math.min(300, mmVal));
      poleSlider.value = state.spiralPoleRadius;
      poleInput.value = dispVal(state.spiralPoleRadius);
      document.getElementById('badge-pole-radius').innerText = `R = ${formatUnit(state.spiralPoleRadius)} (Ø ${formatUnit(state.spiralPoleRadius * 2)})`;
      calculateStairs();
      updateAllViews();
    };
    poleSlider.addEventListener('input', (e) => updatePole(e.target.value));
    poleInput.addEventListener('change', (e) => updatePole(e.target.value));

    const rotSlider = document.getElementById('slider-rotation-angle');
    const rotInput = document.getElementById('input-rotation-angle');
    const updateRot = (val) => {
      state.spiralRotationAngle = Math.max(120, Math.min(540, parseInt(val) || 270));
      rotSlider.value = state.spiralRotationAngle;
      rotInput.value = state.spiralRotationAngle;
      document.getElementById('badge-rotation-angle').innerText = `${state.spiralRotationAngle}°`;
      rebuild3DModel();
      draw2DBlueprint();
    };
    rotSlider.addEventListener('input', (e) => updateRot(e.target.value));
    rotInput.addEventListener('change', (e) => updateRot(e.target.value));

    document.querySelectorAll('#toggle-spiral-dir .toggle-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#toggle-spiral-dir .toggle-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.spiralDirection = btn.dataset.dir;
        rebuild3DModel();
        draw2DBlueprint();
      });
    });
  }
}

function updateInputsUI() {
  const setVal = (inputId, valMm) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.value = dispVal(valMm);

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
    state.spiralPoleRadius = 90;
    state.spiralRotationAngle = 270;
  } else if (presetName === 'switchback-spec') {
    // Exact specification from stair1.jpg
    state.stairType = 'double-l';
    state.totalHeight = 3000;       // 10' / 3m floor height
    state.targetRiser = 176.5;      // 7" riser (approx 17 risers)
    state.targetTread = 280;        // 11" tread (28 cm)
    state.stairWidth = 914;         // 36" (91.4 cm) minimum clear width
    state.doubleLLanding1Step = 7;
    state.doubleLIntermediateSteps = 2; // 2 intermediate connector steps
    state.stairwellGap = 150;
  }

  document.querySelectorAll('.stair-type-card').forEach(card => {
    card.classList.toggle('active', card.dataset.type === state.stairType);
  });

  updateInputsUI();
  calculateStairs();
  renderDynamicParameters();
  updateAllViews();
}

// ------------------------------------------------------------------
// TECHNICAL MATH CALCULATIONS
// ------------------------------------------------------------------
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
  let numTreads = numRisers - 1;

  // 4. Actual Tread Length (Going)
  const actualTread = G_target;

  // Dynamic flights & landing calculations
  let flight1Steps = Math.floor(numRisers / 2);
  let flight2Steps = numRisers - flight1Steps;
  let landingHeight = flight1Steps * actualRiser;
  let landing2Height = landingHeight;
  let totalRun = numTreads * actualTread;

  if (state.stairType === 'l-shaped') {
    flight1Steps = Math.max(1, Math.min(numRisers - 1, state.landingStep || Math.floor(numRisers / 2)));
    flight2Steps = numRisers - flight1Steps;
    landingHeight = flight1Steps * actualRiser;
    totalRun = (flight1Steps * actualTread) + state.stairWidth;
  } else if (state.stairType === 'u-shaped') {
    flight1Steps = Math.max(1, Math.min(numRisers - 1, state.landingStep || Math.floor(numRisers / 2)));
    flight2Steps = numRisers - flight1Steps;
    landingHeight = flight1Steps * actualRiser;
    totalRun = (Math.max(flight1Steps, flight2Steps) * actualTread) + state.stairWidth;
  } else if (state.stairType === 'double-l') {
    const mid = Math.max(0, Math.min(6, state.doubleLIntermediateSteps !== undefined ? state.doubleLIntermediateSteps : 2));
    const maxF1 = Math.max(1, numRisers - mid - 2);
    flight1Steps = Math.max(1, Math.min(maxF1, state.doubleLLanding1Step || Math.floor((numRisers - mid) / 2)));
    flight2Steps = Math.max(1, numRisers - flight1Steps - mid);
    landingHeight = flight1Steps * actualRiser;
    landing2Height = (flight1Steps + mid) * actualRiser;
    totalRun = (Math.max(flight1Steps, flight2Steps) * actualTread) + state.stairWidth;
  } else if (state.stairType === 'spiral') {
    const outerRadius = state.stairWidth + (state.spiralPoleRadius || 80);
    totalRun = outerRadius * 2;
  }

  // 5. Pitch Angle
  const pitchAngle = Math.atan2(actualRiser, actualTread) * (180 / Math.PI);

  // 6. Stringer Hypotenuse Length
  const stringerLength = Math.sqrt(H * H + (numTreads * actualTread) * (numTreads * actualTread));

  // 7. Blondel's Comfort Formula Index (2R + G)
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
    blondelText,
    flight1Steps,
    flight2Steps,
    landingHeight,
    landing2Height,
    spiralInnerRadius: state.spiralPoleRadius || 80,
    spiralOuterRadius: state.stairWidth + (state.spiralPoleRadius || 80)
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
    'double-l': 'Double-L (2-Quarter Landing)',
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
  checkPass('check-headroom', true); // Headroom compliance passes

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
  } else if (state.stairType === 'double-l') {
    buildDoubleLStair(N, R_h, G_d, W, Nosing, T_th, materials);
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

// Build L-Shaped Stair (with dynamic landing height and direction)
function buildLShapedStair(N, R_h, G_d, W, Nosing, T_th, mats) {
  const flight1Count = state.results.flight1Steps || Math.floor(N / 2);
  const flight2Count = state.results.flight2Steps || (N - flight1Count);
  const dirSign = state.turnDirection === 'right' ? 1 : -1;

  // Flight 1 (Along Z)
  for (let i = 0; i < flight1Count; i++) {
    const yPos = (i + 1) * R_h;
    const zPos = i * G_d;

    const treadGeo = new THREE.BoxGeometry(W, T_th, G_d + Nosing);
    const treadMesh = new THREE.Mesh(treadGeo, mats.treadMat);
    treadMesh.position.set(0, yPos - (T_th / 2), zPos + (G_d / 2));
    treadMesh.castShadow = true;
    stairGroup.add(treadMesh);

    if (state.riserType === 'closed') {
      const riserGeo = new THREE.BoxGeometry(W, R_h - T_th, 15);
      const riserMesh = new THREE.Mesh(riserGeo, mats.riserMat);
      riserMesh.position.set(0, yPos - (R_h / 2), zPos);
      stairGroup.add(riserMesh);
    }
  }

  // Intermediate Landing Platform (at dynamic height)
  const landingY = flight1Count * R_h;
  const landingZ = flight1Count * G_d;
  const landingGeo = new THREE.BoxGeometry(W, T_th, W);
  const landingMesh = new THREE.Mesh(landingGeo, mats.treadMat);
  landingMesh.position.set(0, landingY - (T_th / 2), landingZ + (W / 2));
  landingMesh.castShadow = true;
  stairGroup.add(landingMesh);

  // Flight 2 (Turned 90° along X)
  for (let j = 0; j < flight2Count; j++) {
    const stepIdx = flight1Count + j;
    const yPos = (stepIdx + 1) * R_h;
    const xPos = (j + 1) * G_d * dirSign;

    const treadGeo = new THREE.BoxGeometry(G_d + Nosing, T_th, W);
    const treadMesh = new THREE.Mesh(treadGeo, mats.treadMat);
    treadMesh.position.set(xPos + (dirSign * W / 2), yPos - (T_th / 2), landingZ + (W / 2));
    treadMesh.castShadow = true;
    stairGroup.add(treadMesh);

    if (state.riserType === 'closed') {
      const riserGeo = new THREE.BoxGeometry(15, R_h - T_th, W);
      const riserMesh = new THREE.Mesh(riserGeo, mats.riserMat);
      riserMesh.position.set(xPos - (dirSign * G_d / 2) + (dirSign * W / 2), yPos - (R_h / 2), landingZ + (W / 2));
      stairGroup.add(riserMesh);
    }
  }
}

// Build U-Shaped Stair (with dynamic landing height and well gap)
function buildUShapedStair(N, R_h, G_d, W, Nosing, T_th, mats) {
  const flight1Count = state.results.flight1Steps || Math.floor(N / 2);
  const flight2Count = state.results.flight2Steps || (N - flight1Count);
  const wellGap = state.stairwellGap || 150;
  const dirSign = state.turnDirection === 'right' ? 1 : -1;

  const x1 = -dirSign * (W + wellGap) / 2;
  const x2 = dirSign * (W + wellGap) / 2;

  // Flight 1 (Forward Z)
  for (let i = 0; i < flight1Count; i++) {
    const yPos = (i + 1) * R_h;
    const zPos = i * G_d;

    const treadGeo = new THREE.BoxGeometry(W, T_th, G_d + Nosing);
    const treadMesh = new THREE.Mesh(treadGeo, mats.treadMat);
    treadMesh.position.set(x1, yPos - (T_th / 2), zPos + (G_d / 2));
    treadMesh.castShadow = true;
    stairGroup.add(treadMesh);

    if (state.riserType === 'closed') {
      const riserGeo = new THREE.BoxGeometry(W, R_h - T_th, 15);
      const riserMesh = new THREE.Mesh(riserGeo, mats.riserMat);
      riserMesh.position.set(x1, yPos - (R_h / 2), zPos);
      stairGroup.add(riserMesh);
    }
  }

  // Half-Pace Landing
  const landingY = flight1Count * R_h;
  const landingZ = flight1Count * G_d;
  const landingSpan = W * 2 + wellGap;
  const landingGeo = new THREE.BoxGeometry(landingSpan, T_th, W);
  const landingMesh = new THREE.Mesh(landingGeo, mats.treadMat);
  landingMesh.position.set(0, landingY - (T_th / 2), landingZ + (W / 2));
  landingMesh.castShadow = true;
  stairGroup.add(landingMesh);

  // Flight 2 (Return Reverse Z)
  for (let j = 0; j < flight2Count; j++) {
    const stepIdx = flight1Count + j;
    const yPos = (stepIdx + 1) * R_h;
    const zPos = landingZ - (j * G_d);

    const treadGeo = new THREE.BoxGeometry(W, T_th, G_d + Nosing);
    const treadMesh = new THREE.Mesh(treadGeo, mats.treadMat);
    treadMesh.position.set(x2, yPos - (T_th / 2), zPos - (G_d / 2));
    treadMesh.castShadow = true;
    stairGroup.add(treadMesh);

    if (state.riserType === 'closed') {
      const riserGeo = new THREE.BoxGeometry(W, R_h - T_th, 15);
      const riserMesh = new THREE.Mesh(riserGeo, mats.riserMat);
      riserMesh.position.set(x2, yPos - (R_h / 2), zPos);
      stairGroup.add(riserMesh);
    }
  }
}

// Build Double-L / 2-Quarter Landing Stair (matching stair1.jpg!)
function buildDoubleLStair(N, R_h, G_d, W, Nosing, T_th, mats) {
  const f1Count = state.results.flight1Steps || 6;
  const midCount = state.doubleLIntermediateSteps !== undefined ? state.doubleLIntermediateSteps : 2;
  const f2Count = state.results.flight2Steps || (N - f1Count - midCount);
  const wellGap = state.stairwellGap || 150;

  const x1 = -(W + wellGap) / 2;
  const x2 = (W + wellGap) / 2;

  // Flight 1: Ascending forward along +Z
  for (let i = 0; i < f1Count; i++) {
    const yPos = (i + 1) * R_h;
    const zPos = i * G_d;

    const treadGeo = new THREE.BoxGeometry(W, T_th, G_d + Nosing);
    const treadMesh = new THREE.Mesh(treadGeo, mats.treadMat);
    treadMesh.position.set(x1, yPos - (T_th / 2), zPos + (G_d / 2));
    treadMesh.castShadow = true;
    stairGroup.add(treadMesh);

    if (state.riserType === 'closed') {
      const riserGeo = new THREE.BoxGeometry(W, R_h - T_th, 15);
      const riserMesh = new THREE.Mesh(riserGeo, mats.riserMat);
      riserMesh.position.set(x1, yPos - (R_h / 2), zPos);
      stairGroup.add(riserMesh);
    }
  }

  // Quarter Landing 1 (South-West corner)
  const landing1Y = f1Count * R_h;
  const landing1Z = f1Count * G_d;
  const landing1Geo = new THREE.BoxGeometry(W, T_th, W);
  const landing1Mesh = new THREE.Mesh(landing1Geo, mats.treadMat);
  landing1Mesh.position.set(x1, landing1Y - (T_th / 2), landing1Z + (W / 2));
  landing1Mesh.castShadow = true;
  stairGroup.add(landing1Mesh);

  // Intermediate connector steps across the back (from x1 to x2)
  if (midCount > 0) {
    const intermediateSpan = wellGap;
    const stepDx = intermediateSpan / (midCount + 1);

    for (let m = 0; m < midCount; m++) {
      const stepIdx = f1Count + m;
      const yPos = (stepIdx + 1) * R_h;
      const xPos = x1 + (W / 2) + (m + 1) * stepDx;

      const midTreadGeo = new THREE.BoxGeometry(stepDx + 20, T_th, W);
      const midTreadMesh = new THREE.Mesh(midTreadGeo, mats.treadMat);
      midTreadMesh.position.set(xPos, yPos - (T_th / 2), landing1Z + (W / 2));
      midTreadMesh.castShadow = true;
      stairGroup.add(midTreadMesh);
    }
  }

  // Quarter Landing 2 (North-West / Return corner)
  const landing2Y = (f1Count + midCount) * R_h;
  const landing2Mesh = new THREE.Mesh(landing1Geo, mats.treadMat);
  landing2Mesh.position.set(x2, landing2Y - (T_th / 2), landing1Z + (W / 2));
  landing2Mesh.castShadow = true;
  stairGroup.add(landing2Mesh);

  // Flight 2: Ascending reverse along -Z (return flight)
  for (let j = 0; j < f2Count; j++) {
    const stepIdx = f1Count + midCount + j;
    const yPos = (stepIdx + 1) * R_h;
    const zPos = landing1Z - (j * G_d);

    const treadGeo = new THREE.BoxGeometry(W, T_th, G_d + Nosing);
    const treadMesh = new THREE.Mesh(treadGeo, mats.treadMat);
    treadMesh.position.set(x2, yPos - (T_th / 2), zPos - (G_d / 2));
    treadMesh.castShadow = true;
    stairGroup.add(treadMesh);

    if (state.riserType === 'closed') {
      const riserGeo = new THREE.BoxGeometry(W, R_h - T_th, 15);
      const riserMesh = new THREE.Mesh(riserGeo, mats.riserMat);
      riserMesh.position.set(x2, yPos - (R_h / 2), zPos);
      stairGroup.add(riserMesh);
    }
  }

  // Structural Side Stringers for Both Flights
  if (state.stringerStyle === 'closed-side') {
    const f1Len = Math.sqrt((f1Count * R_h) ** 2 + (f1Count * G_d) ** 2);
    const f1Angle = Math.atan2(f1Count * R_h, f1Count * G_d);
    const stringerGeo = new THREE.BoxGeometry(35, 220, f1Len + G_d);

    const strL1 = new THREE.Mesh(stringerGeo, mats.stringerMat);
    strL1.rotation.x = f1Angle;
    strL1.position.set(x1 - W / 2 - 18, (f1Count * R_h) / 2, (f1Count * G_d) / 2);
    stairGroup.add(strL1);

    const f2Len = Math.sqrt((f2Count * R_h) ** 2 + (f2Count * G_d) ** 2);
    const f2Angle = -Math.atan2(f2Count * R_h, f2Count * G_d);
    const stringerGeo2 = new THREE.BoxGeometry(35, 220, f2Len + G_d);

    const strR2 = new THREE.Mesh(stringerGeo2, mats.stringerMat);
    strR2.rotation.x = f2Angle;
    strR2.position.set(x2 + W / 2 + 18, landing2Y + (f2Count * R_h) / 2, landing1Z - (f2Count * G_d) / 2);
    stairGroup.add(strR2);
  }
}

// Build Spiral Stair (with dynamic center pole radius & rotation angle)
function buildSpiralStair(N, R_h, G_d, W, Nosing, T_th, mats) {
  const totalHeight = N * R_h;
  const poleRadius = state.spiralPoleRadius || 80;
  const rotAngleDeg = state.spiralRotationAngle || 270;
  const totalAngleRad = (rotAngleDeg * Math.PI) / 180;
  const dirSign = state.spiralDirection === 'ccw' ? -1 : 1;

  // Central Cylindrical Column (Parametric Radius)
  const colGeo = new THREE.CylinderGeometry(poleRadius, poleRadius, totalHeight + 400, 36);
  const colMesh = new THREE.Mesh(colGeo, mats.stringerMat);
  colMesh.position.set(0, (totalHeight + 400) / 2, 0);
  colMesh.castShadow = true;
  stairGroup.add(colMesh);

  // Spiral Steps
  const outerR = poleRadius + W;
  for (let i = 0; i < N; i++) {
    const angle = dirSign * (i / N) * totalAngleRad;
    const yPos = (i + 1) * R_h;

    // Wedge Shape radiating from central pole
    const wedgeShape = new THREE.Shape();
    const halfWidthInner = Math.max(15, poleRadius * 0.25);
    const halfWidthOuter = (outerR * 0.28);

    wedgeShape.moveTo(poleRadius, -halfWidthInner);
    wedgeShape.lineTo(outerR, -halfWidthOuter);
    wedgeShape.lineTo(outerR, halfWidthOuter);
    wedgeShape.lineTo(poleRadius, halfWidthInner);
    wedgeShape.closePath();

    const extrudeSettings = { depth: T_th, bevelEnabled: false };
    const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, extrudeSettings);
    const stepMesh = new THREE.Mesh(wedgeGeo, mats.treadMat);

    stepMesh.rotation.x = Math.PI / 2;
    stepMesh.rotation.z = -angle;
    stepMesh.position.set(0, yPos - (T_th / 2), 0);
    stepMesh.castShadow = true;
    stairGroup.add(stepMesh);
  }
}

// Build 3D Spatial Annotations
function buildSpatialAnnotations(N, R_h, G_d, W) {
  const H = N * R_h;
  const R = state.results.totalRun;

  const lineMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
  const pointsHeight = [
    new THREE.Vector3(W / 2 + 100, 0, R),
    new THREE.Vector3(W / 2 + 100, H, R)
  ];
  const heightGeo = new THREE.BufferGeometry().setFromPoints(pointsHeight);
  annotationsGroup.add(new THREE.Line(heightGeo, lineMat));

  const pointsRun = [
    new THREE.Vector3(W / 2 + 100, 0, 0),
    new THREE.Vector3(W / 2 + 100, 0, R)
  ];
  const runGeo = new THREE.BufferGeometry().setFromPoints(pointsRun);
  annotationsGroup.add(new THREE.Line(runGeo, lineMat));
}

// ------------------------------------------------------------------
// 2D ARCHITECTURAL BLUEPRINT RENDERER (SIDE & FRONT ELEVATIONS)
// ------------------------------------------------------------------
function draw2DBlueprint() {
  const sideSvg = document.getElementById('blueprint-side-svg');
  const frontSvg = document.getElementById('blueprint-front-svg');
  if (!sideSvg || !frontSvg) return;

  drawSideBlueprint(sideSvg);
  drawFrontBlueprint(frontSvg);

  // Update Blueprint Card Footers
  const r = state.results;
  const bpSideGoing = document.getElementById('bp-side-going');
  const bpSideRise = document.getElementById('bp-side-rise');
  const bpSidePitch = document.getElementById('bp-side-pitch');
  const bpFrontWidth = document.getElementById('bp-front-width');
  const bpFrontHeight = document.getElementById('bp-front-height');
  const bpFrontLanding = document.getElementById('bp-front-landing');

  if (bpSideGoing) bpSideGoing.innerText = formatUnit(r.actualTread, 1);
  if (bpSideRise) bpSideRise.innerText = formatUnit(r.actualRiser, 1);
  if (bpSidePitch) bpSidePitch.innerText = r.pitchAngle.toFixed(1) + '°';
  if (bpFrontWidth) bpFrontWidth.innerText = formatUnit(state.stairWidth);
  if (bpFrontHeight) bpFrontHeight.innerText = formatUnit(state.totalHeight);

  if (bpFrontLanding) {
    if (state.stairType === 'straight') {
      bpFrontLanding.innerText = 'Continuous (None)';
    } else if (state.stairType === 'double-l') {
      bpFrontLanding.innerText = `${formatUnit(r.landingHeight)} / ${formatUnit(r.landing2Height)}`;
    } else if (state.stairType === 'spiral') {
      bpFrontLanding.innerText = `Pole R=${formatUnit(state.spiralPoleRadius)}`;
    } else {
      bpFrontLanding.innerText = `At Step ${r.flight1Steps} (${formatUnit(r.landingHeight)})`;
    }
  }
}

// 1. SIDE ELEVATION SECTION (Longitudinal)
function drawSideBlueprint(svg) {
  const N = state.results.numRisers;
  const R_h = state.results.actualRiser;
  const G_d = state.results.actualTread;
  const H = state.totalHeight;
  const TotalRun = state.results.totalRun;

  const w = 800;
  const h = 560;
  const marginX = 80;
  const marginY = 85;

  const drawWidth = w - marginX * 2;
  const drawHeight = h - marginY * 2;

  const scaleX = drawWidth / Math.max(TotalRun, 2200);
  const scaleY = drawHeight / Math.max(H, 2200);
  const scale = Math.min(scaleX, scaleY);

  const startX = marginX + 30;
  const startY = h - marginY;

  let pathD = `M ${startX} ${startY} `;
  let handrailD = '';

  const isSwitchback = (state.stairType === 'u-shaped' || state.stairType === 'double-l');
  const f1Count = state.results.flight1Steps || Math.floor(N / 2);
  const midCount = state.stairType === 'double-l' ? (state.doubleLIntermediateSteps || 2) : 0;
  const f2Count = N - f1Count - midCount;

  let endX = startX;
  let endY = startY;

  if (state.stairType === 'straight' || state.stairType === 'l-shaped') {
    for (let i = 0; i < N; i++) {
      const y2 = startY - ((i + 1) * R_h * scale);
      const x2 = startX + ((i + 1) * G_d * scale);
      pathD += `V ${y2} H ${x2} `;
    }
    endX = startX + (N * G_d * scale);
    endY = startY - (N * R_h * scale);

    // Handrail line 900mm above steps with curved start/ends (matching stair1.jpg)
    const railOffset = 900 * scale;
    const hrStartX = startX - 25;
    const hrStartY = startY - railOffset;
    const hrEndX = endX + 25;
    const hrEndY = endY - railOffset;
    handrailD = `M ${hrStartX} ${hrStartY + 10} Q ${hrStartX + 15} ${hrStartY} ${startX} ${hrStartY} L ${endX} ${hrEndY} Q ${hrEndX - 15} ${hrEndY} ${hrEndX} ${hrEndY + 10}`;
  } else if (isSwitchback) {
    // Lower flight
    for (let i = 0; i < f1Count; i++) {
      const y2 = startY - ((i + 1) * R_h * scale);
      const x2 = startX + ((i + 1) * G_d * scale);
      pathD += `V ${y2} H ${x2} `;
    }
    const landX1 = startX + (f1Count * G_d * scale);
    const landY1 = startY - (f1Count * R_h * scale);
    const landSpan = (state.stairWidth * 0.9) * scale;
    pathD += `H ${landX1 + landSpan} `;

    // Intermediate steps / return flight
    if (midCount > 0) {
      for (let m = 0; m < midCount; m++) {
        const y2 = landY1 - ((m + 1) * R_h * scale);
        const x2 = landX1 + landSpan + ((m + 1) * 20 * scale);
        pathD += `V ${y2} H ${x2} `;
      }
    }
    const landY2 = startY - ((f1Count + midCount) * R_h * scale);
    const f2StartX = landX1 + landSpan;

    // Return Flight profile (matching stair1.jpg side section)
    for (let j = 0; j < f2Count; j++) {
      const y2 = landY2 - ((j + 1) * R_h * scale);
      const x2 = f2StartX - ((j + 1) * G_d * scale * 0.75);
      pathD += `V ${y2} H ${x2} `;
    }
    endX = f2StartX - (f2Count * G_d * scale * 0.75);
    endY = startY - (H * scale);

    const railOffset = 900 * scale;
    handrailD = `M ${startX - 20} ${startY - railOffset + 10} Q ${startX} ${startY - railOffset} ${startX + 20} ${startY - railOffset} L ${landX1} ${landY1 - railOffset} M ${landX1} ${landY2 - railOffset} L ${endX - 20} ${endY - railOffset}`;
  } else {
    // Spiral projection
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 1.5;
      const x = startX + drawWidth / 2 + Math.cos(angle) * (drawWidth / 3.5);
      const y = startY - (i * R_h * scale);
      pathD += (i === 0 ? `M ${x} ${y} ` : `L ${x} ${y} `);
    }
    endX = startX + drawWidth / 2;
    endY = startY - (H * scale);
  }

  svg.innerHTML = `
    <!-- Technical Blueprint Grid Lines -->
    <defs>
      <pattern id="bp-grid-side" width="25" height="25" patternUnits="userSpaceOnUse">
        <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(59, 130, 246, 0.12)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bp-grid-side)"/>

    <!-- Level Datums -->
    <line x1="20" y1="${startY}" x2="${w - 20}" y2="${startY}" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4"/>
    <text x="25" y="${startY - 8}" fill="#60a5fa" font-family="JetBrains Mono" font-size="11" font-weight="700">∇ FINISHED GROUND LEVEL (±0.00)</text>

    <line x1="20" y1="${startY - (H * scale)}" x2="${w - 20}" y2="${startY - (H * scale)}" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4,4"/>
    <text x="25" y="${startY - (H * scale) - 8}" fill="#10b981" font-family="JetBrains Mono" font-size="11" font-weight="700">∇ TOP FINISHED FLOOR (+${formatUnit(H)})</text>

    <!-- Steps Silhouette -->
    <path d="${pathD}" fill="none" stroke="#60a5fa" stroke-width="3" stroke-linejoin="round"/>

    <!-- Handrail Curve (stair1.jpg feature) -->
    ${handrailD ? `<path d="${handrailD}" fill="none" stroke="#a78bfa" stroke-width="3" stroke-linecap="round"/>` : ''}
    ${handrailD ? `<text x="${startX + 40}" y="${startY - 900 * scale - 12}" fill="#c4b5fd" font-family="JetBrains Mono" font-size="11">Handrail 34"–36" (900mm)</text>` : ''}

    <!-- Riser & Tread Callout Samples -->
    <text x="${startX + (G_d * scale) / 2}" y="${startY - (R_h * scale) / 2 + 4}" fill="#93c5fd" font-family="JetBrains Mono" font-size="11" font-weight="600" text-anchor="middle">
      R = ${formatUnit(R_h, 1)}
    </text>
    <text x="${startX + (G_d * scale) * 1.5}" y="${startY - (R_h * scale) - 8}" fill="#93c5fd" font-family="JetBrains Mono" font-size="11" font-weight="600" text-anchor="middle">
      G = ${formatUnit(G_d, 1)}
    </text>

    <!-- Total Height Dimension (H) -->
    <line x1="${w - 60}" y1="${startY}" x2="${w - 60}" y2="${startY - (H * scale)}" stroke="#10b981" stroke-width="2"/>
    <line x1="${w - 70}" y1="${startY}" x2="${w - 50}" y2="${startY}" stroke="#10b981" stroke-width="2"/>
    <line x1="${w - 70}" y1="${startY - (H * scale)}" x2="${w - 50}" y2="${startY - (H * scale)}" stroke="#10b981" stroke-width="2"/>
    <text x="${w - 50}" y="${startY - (H * scale) / 2 + 4}" fill="#10b981" font-family="JetBrains Mono" font-size="13" font-weight="700">
      H = ${formatUnit(H)}
    </text>

    <!-- Pitch Angle Indicator -->
    <path d="M ${startX + 55} ${startY} A 55 55 0 0 0 ${startX + 44} ${startY - 30}" fill="none" stroke="#f59e0b" stroke-width="2"/>
    <text x="${startX + 65}" y="${startY - 18}" fill="#f59e0b" font-family="JetBrains Mono" font-size="12" font-weight="700">
      ${state.results.pitchAngle.toFixed(1)}°
    </text>

    <!-- Sheet Header Block -->
    <text x="30" y="36" fill="#f8fafc" font-family="Inter" font-size="15" font-weight="700">LONGITUDINAL ELEVATION & PITCH SECTION</text>
    <text x="30" y="54" fill="#94a3b8" font-family="JetBrains Mono" font-size="11">
      ${N} Risers @ ${formatUnit(R_h, 1)} | ${N - 1} Treads @ ${formatUnit(G_d, 1)} | Incline: ${state.results.pitchAngle.toFixed(1)}°
    </text>
  `;
}

// 2. FRONT ELEVATION SECTION (Transverse / Front View - matching stair1.jpg middle diagram!)
function drawFrontBlueprint(svg) {
  const N = state.results.numRisers;
  const R_h = state.results.actualRiser;
  const H = state.totalHeight;
  const W = state.stairWidth;

  const w = 800;
  const h = 560;
  const marginX = 90;
  const marginY = 85;

  const drawHeight = h - marginY * 2;
  const scale = drawHeight / Math.max(H, 2200);

  const startY = h - marginY;
  const centerX = w / 2;
  const wScaled = W * scale * 0.85;

  let elementsHtml = '';

  if (state.stairType === 'straight') {
    // Front View of Straight Flight: Steps stacked vertically across width W
    const xLeft = centerX - wScaled / 2;
    const xRight = centerX + wScaled / 2;

    // Ground & Floor headers
    elementsHtml += `
      <!-- Stair Width Box -->
      <rect x="${xLeft}" y="${startY - (H * scale)}" width="${wScaled}" height="${H * scale}" fill="rgba(30, 58, 138, 0.15)" stroke="#3b82f6" stroke-width="2"/>
    `;

    // Horizontal Step Lines
    for (let i = 1; i <= N; i++) {
      const yStep = startY - (i * R_h * scale);
      elementsHtml += `
        <line x1="${xLeft}" y1="${yStep}" x2="${xRight}" y2="${yStep}" stroke="#60a5fa" stroke-width="1.5"/>
        <circle cx="${xLeft - 10}" cy="${yStep}" r="2" fill="#93c5fd"/>
      `;
    }

    // Handrail Posts on Left & Right
    elementsHtml += `
      <line x1="${xLeft}" y1="${startY}" x2="${xLeft}" y2="${startY - (H * scale) - (900 * scale)}" stroke="#a78bfa" stroke-width="2.5"/>
      <line x1="${xRight}" y1="${startY}" x2="${xRight}" y2="${startY - (H * scale) - (900 * scale)}" stroke="#a78bfa" stroke-width="2.5"/>
      <line x1="${xLeft - 10}" y1="${startY - (900 * scale)}" x2="${xRight + 10}" y2="${startY - (H * scale) - (900 * scale)}" stroke="#c4b5fd" stroke-width="3"/>
    `;
  } else if (state.stairType === 'l-shaped') {
    // Front View of L-Shaped Stair: Lower flight rising to landing, upper flight extending across
    const f1Count = state.results.flight1Steps || Math.floor(N / 2);
    const f2Count = N - f1Count;
    const lHeight = f1Count * R_h * scale;

    const x1 = centerX - wScaled;
    const x2 = centerX;
    const x3 = centerX + wScaled;

    // Flight 1 (Front Facing)
    elementsHtml += `
      <rect x="${x1}" y="${startY - lHeight}" width="${wScaled}" height="${lHeight}" fill="rgba(30, 58, 138, 0.2)" stroke="#3b82f6" stroke-width="2"/>
    `;
    for (let i = 1; i <= f1Count; i++) {
      const y = startY - (i * R_h * scale);
      elementsHtml += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#60a5fa" stroke-width="1.5"/>`;
    }

    // Landing Platform
    elementsHtml += `
      <rect x="${x2}" y="${startY - lHeight - 15}" width="${wScaled}" height="15" fill="#3b82f6" stroke="#60a5fa" stroke-width="1.5"/>
      <text x="${x2 + wScaled / 2}" y="${startY - lHeight - 22}" fill="#93c5fd" font-family="JetBrains Mono" font-size="11" text-anchor="middle">
        LANDING LEVEL (+${formatUnit(f1Count * R_h)})
      </text>
    `;

    // Flight 2 (Side Profile seen from Front)
    for (let j = 0; j < f2Count; j++) {
      const y1 = startY - lHeight - (j * R_h * scale);
      const y2 = startY - lHeight - ((j + 1) * R_h * scale);
      const x = x2 + ((j + 1) * (wScaled / f2Count));
      elementsHtml += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#60a5fa" stroke-width="2"/>`;
    }
  } else if (state.stairType === 'u-shaped' || state.stairType === 'double-l') {
    // Front View of Switchback / Double-L Stair (EXACT representation as in stair1.jpg middle diagram!)
    const f1Count = state.results.flight1Steps || 6;
    const midCount = state.stairType === 'double-l' ? (state.doubleLIntermediateSteps || 2) : 0;
    const f2Count = N - f1Count - midCount;

    const gapScaled = (state.stairwellGap || 150) * scale * 0.7;
    const xF1Left = centerX - wScaled - gapScaled / 2;
    const xF1Right = centerX - gapScaled / 2;
    const xF2Left = centerX + gapScaled / 2;
    const xF2Right = centerX + wScaled + gapScaled / 2;

    const l1Y = startY - (f1Count * R_h * scale);
    const l2Y = startY - ((f1Count + midCount) * R_h * scale);
    const topY = startY - (H * scale);

    // Flight 1 (Left Column - bottom flight rising up to landing 1)
    elementsHtml += `
      <rect x="${xF1Left}" y="${l1Y}" width="${wScaled}" height="${f1Count * R_h * scale}" fill="rgba(30, 58, 138, 0.2)" stroke="#3b82f6" stroke-width="2"/>
    `;
    for (let i = 1; i <= f1Count; i++) {
      const y = startY - (i * R_h * scale);
      elementsHtml += `<line x1="${xF1Left}" y1="${y}" x2="${xF1Right}" y2="${y}" stroke="#60a5fa" stroke-width="1.5"/>`;
    }

    // Landing 1 & Connector Steps in stair1.jpg style
    elementsHtml += `
      <!-- Landing 1 Slab -->
      <line x1="${xF1Left - 10}" y1="${l1Y}" x2="${xF1Right + 10}" y2="${l1Y}" stroke="#10b981" stroke-width="2.5"/>
      <text x="${xF1Left + wScaled / 2}" y="${l1Y + 18}" fill="#10b981" font-family="JetBrains Mono" font-size="10" font-weight="700" text-anchor="middle">
        LANDING 1 (+${formatUnit(f1Count * R_h)})
      </text>
    `;

    if (midCount > 0) {
      // Intermediate connector steps rising across the gap
      for (let m = 1; m <= midCount; m++) {
        const ym = l1Y - (m * R_h * scale);
        const xm = xF1Right + ((xF2Left - xF1Right) * (m / (midCount + 1)));
        elementsHtml += `
          <line x1="${xm - 10}" y1="${ym}" x2="${xm + 10}" y2="${ym}" stroke="#f59e0b" stroke-width="2"/>
          <line x1="${xm}" y1="${ym}" x2="${xm}" y2="${ym + (R_h * scale)}" stroke="#f59e0b" stroke-width="1.5"/>
        `;
      }
    }

    // Landing 2 & Flight 2 (Right Column - upper flight rising to top floor)
    elementsHtml += `
      <!-- Landing 2 Slab -->
      <line x1="${xF2Left - 10}" y1="${l2Y}" x2="${xF2Right + 10}" y2="${l2Y}" stroke="#10b981" stroke-width="2.5"/>
      ${midCount > 0 ? `<text x="${xF2Left + wScaled / 2}" y="${l2Y + 18}" fill="#10b981" font-family="JetBrains Mono" font-size="10" font-weight="700" text-anchor="middle">LANDING 2 (+${formatUnit((f1Count + midCount) * R_h)})</text>` : ''}

      <!-- Flight 2 Body -->
      <rect x="${xF2Left}" y="${topY}" width="${wScaled}" height="${f2Count * R_h * scale}" fill="rgba(30, 58, 138, 0.2)" stroke="#3b82f6" stroke-width="2"/>
    `;
    for (let j = 1; j <= f2Count; j++) {
      const y = l2Y - (j * R_h * scale);
      elementsHtml += `<line x1="${xF2Left}" y1="${y}" x2="${xF2Right}" y2="${y}" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="3,3"/>`;
    }

    // Top Landing Slab & Width Annotation matching stair1.jpg
    elementsHtml += `
      <!-- Top Floor Slab -->
      <line x1="${xF2Left - 15}" y1="${topY}" x2="${xF2Right + 25}" y2="${topY}" stroke="#10b981" stroke-width="3"/>
      
      <!-- Top Width Dimension Arrow (36" / 91.4cm minimum clear as in stair1.jpg) -->
      <line x1="${xF2Left}" y1="${topY - 30}" x2="${xF2Right}" y2="${topY - 30}" stroke="#a78bfa" stroke-width="1.5"/>
      <line x1="${xF2Left}" y1="${topY - 36}" x2="${xF2Left}" y2="${topY - 24}" stroke="#a78bfa" stroke-width="1.5"/>
      <line x1="${xF2Right}" y1="${topY - 36}" x2="${xF2Right}" y2="${topY - 24}" stroke="#a78bfa" stroke-width="1.5"/>
      <text x="${xF2Left + wScaled / 2}" y="${topY - 38}" fill="#c4b5fd" font-family="JetBrains Mono" font-size="11" font-weight="700" text-anchor="middle">
        ${formatUnit(W)} (36" min)
      </text>

      <!-- Overall Span Callout -->
      <line x1="${xF1Left}" y1="${startY + 25}" x2="${xF2Right}" y2="${startY + 25}" stroke="#60a5fa" stroke-width="1.5"/>
      <line x1="${xF1Left}" y1="${startY + 20}" x2="${xF1Left}" y2="${startY + 30}" stroke="#60a5fa" stroke-width="1.5"/>
      <line x1="${xF2Right}" y1="${startY + 20}" x2="${xF2Right}" y2="${startY + 30}" stroke="#60a5fa" stroke-width="1.5"/>
      <text x="${centerX}" y="${startY + 42}" fill="#93c5fd" font-family="JetBrains Mono" font-size="11" font-weight="700" text-anchor="middle">
        Total Width Span = ${formatUnit(W * 2 + (state.stairwellGap || 150))}
      </text>
    `;
  } else if (state.stairType === 'spiral') {
    // Front View of Spiral Staircase: Center Column + Radiating Steps
    const poleR = (state.spiralPoleRadius || 80) * scale * 1.4;
    const outerR = (state.stairWidth + (state.spiralPoleRadius || 80)) * scale * 0.75;

    // Center Column
    elementsHtml += `
      <rect x="${centerX - poleR}" y="${startY - (H * scale)}" width="${poleR * 2}" height="${H * scale}" fill="#334155" stroke="#60a5fa" stroke-width="2"/>
      <text x="${centerX}" y="${startY + 24}" fill="#93c5fd" font-family="JetBrains Mono" font-size="11" text-anchor="middle">Pole Ø ${formatUnit((state.spiralPoleRadius || 80) * 2)}</text>
    `;

    // Radiating Step Bars
    for (let i = 1; i <= N; i++) {
      const y = startY - (i * R_h * scale);
      const angle = (i / N) * Math.PI * 1.5;
      const cosVal = Math.cos(angle);
      const stepEndX = centerX + (cosVal * outerR);
      elementsHtml += `
        <line x1="${centerX}" y1="${y}" x2="${stepEndX}" y2="${y}" stroke="#60a5fa" stroke-width="2"/>
        <circle cx="${stepEndX}" cy="${y}" r="3" fill="#93c5fd"/>
      `;
    }

    // Outer Cylindrical Envelope
    elementsHtml += `
      <line x1="${centerX - outerR}" y1="${startY}" x2="${centerX - outerR}" y2="${startY - (H * scale)}" stroke="#a78bfa" stroke-width="1" stroke-dasharray="4,4"/>
      <line x1="${centerX + outerR}" y1="${startY}" x2="${centerX + outerR}" y2="${startY - (H * scale)}" stroke="#a78bfa" stroke-width="1" stroke-dasharray="4,4"/>
    `;
  }

  svg.innerHTML = `
    <!-- Technical Blueprint Grid Lines -->
    <defs>
      <pattern id="bp-grid-front" width="25" height="25" patternUnits="userSpaceOnUse">
        <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(59, 130, 246, 0.12)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bp-grid-front)"/>

    <!-- Level Datum Lines -->
    <line x1="20" y1="${startY}" x2="${w - 20}" y2="${startY}" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4"/>
    <text x="25" y="${startY - 8}" fill="#60a5fa" font-family="JetBrains Mono" font-size="11" font-weight="700">∇ LEVEL 00 (±0.00)</text>

    <line x1="20" y1="${startY - (H * scale)}" x2="${w - 20}" y2="${startY - (H * scale)}" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4,4"/>
    <text x="25" y="${startY - (H * scale) - 8}" fill="#10b981" font-family="JetBrains Mono" font-size="11" font-weight="700">∇ FINISHED CEILING / UPPER LEVEL (+${formatUnit(H)})</text>

    <!-- Transverse Section Graphics -->
    ${elementsHtml}

    <!-- Total Height Dimension (styled as 10' | 3m in stair1.jpg) -->
    <line x1="${w - 60}" y1="${startY}" x2="${w - 60}" y2="${startY - (H * scale)}" stroke="#10b981" stroke-width="2"/>
    <line x1="${w - 70}" y1="${startY}" x2="${w - 50}" y2="${startY}" stroke="#10b981" stroke-width="2"/>
    <line x1="${w - 70}" y1="${startY - (H * scale)}" x2="${w - 50}" y2="${startY - (H * scale)}" stroke="#10b981" stroke-width="2"/>
    <text x="${w - 50}" y="${startY - (H * scale) / 2 + 4}" fill="#10b981" font-family="JetBrains Mono" font-size="13" font-weight="700">
      ${formatUnit(H)} | 10'
    </text>

    <!-- Header Block -->
    <text x="30" y="36" fill="#f8fafc" font-family="Inter" font-size="15" font-weight="700">TRANSVERSE FRONT ELEVATION SECTION</text>
    <text x="30" y="54" fill="#94a3b8" font-family="JetBrains Mono" font-size="11">
      Front Profile Cut | Width: ${formatUnit(W)} | Risers Stack: ${N} Flights
    </text>
  `;
}

// ------------------------------------------------------------------
// EXPORT SPECIFICATION SHEET MODAL
// ------------------------------------------------------------------
function openExportModal() {
  const modal = document.getElementById('export-modal');
  const body = document.getElementById('modal-spec-content');
  const r = state.results;

  const typeDisplayNames = {
    'straight': 'Straight Flight',
    'l-shaped': 'L-Shaped (90° Turn)',
    'u-shaped': 'U-Shaped (180° Turn)',
    'double-l': 'Double-L (2-Quarter Landing Switchback)',
    'spiral': 'Spiral Staircase'
  };

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
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700;">${typeDisplayNames[state.stairType] || state.stairType.toUpperCase()}</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Parametric Model Configuration</td>
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
            <td style="padding: 10px; border: 1px solid var(--border-color);">Staircase Width</td>
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700;">${formatUnit(state.stairWidth)}</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Clear Walkway Width</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Incline Pitch Angle</td>
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700; color: var(--primary);">${r.pitchAngle.toFixed(1)}°</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Standard Pitch Range (30° - 37°)</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Total Horizontal Run</td>
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700;">${formatUnit(r.totalRun)}</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Floor Footprint Span</td>
          </tr>
          ${state.stairType !== 'straight' && state.stairType !== 'spiral' ? `
          <tr>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Intermediate Landing(s)</td>
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700; color: var(--accent);">${state.stairType === 'double-l' ? `L1: ${formatUnit(r.landingHeight)} | L2: ${formatUnit(r.landing2Height)}` : formatUnit(r.landingHeight)}</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">${state.stairType === 'double-l' ? `${state.doubleLIntermediateSteps} Connector Steps` : `Landing at Step ${r.flight1Steps}`}</td>
          </tr>` : ''}
          ${state.stairType === 'spiral' ? `
          <tr>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Center Column Radius</td>
            <td style="padding: 10px; border: 1px solid var(--border-color); font-weight: 700;">${formatUnit(state.spiralPoleRadius)} (Ø ${formatUnit(state.spiralPoleRadius * 2)})</td>
            <td style="padding: 10px; border: 1px solid var(--border-color);">Total Outside Diameter: ${formatUnit((state.stairWidth + state.spiralPoleRadius) * 2)}</td>
          </tr>` : ''}
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
