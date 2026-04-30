/**
 * src/lib/babylonViewer.js
 *
 * BabylonJS scene manager — multi-floor building, elegant lighting.
 * NOTE: window resize is NOT handled here — the React component manages it.
 */

import * as BABYLON from '@babylonjs/core';

let engine       = null;
let scene        = null;
let camera       = null;
let buildingRoot = null;

// ── Init ─────────────────────────────────────────────────────────────────────
export function initBabylon(canvas) {
  engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
  });

  scene = new BABYLON.Scene(engine);
  // Warm off-white sky gradient – not pitch black
  scene.clearColor = new BABYLON.Color4(0.07, 0.07, 0.1, 1);
  scene.ambientColor = new BABYLON.Color3(0.25, 0.22, 0.18);

  // ── Camera ──
  camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3.2, 80, BABYLON.Vector3.Zero(), scene);
  camera.lowerRadiusLimit   = 5;
  camera.upperRadiusLimit   = 600;
  camera.upperBetaLimit     = Math.PI / 2.05;
  camera.wheelPrecision     = 5;
  camera.panningSensibility = 100;
  camera.attachControl(canvas, true);

  // ── Lights ──
  // 1. Warm sky dome (bright)
  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity    = 1.1;
  hemi.diffuse      = new BABYLON.Color3(0.98, 0.95, 0.88);   // warm white
  hemi.groundColor  = new BABYLON.Color3(0.28, 0.24, 0.20);   // warm bounce light
  hemi.specular     = new BABYLON.Color3(0.1, 0.1, 0.08);

  // 2. Key directional — warm sun angle
  const key = new BABYLON.DirectionalLight('key', new BABYLON.Vector3(-0.6, -1, -0.5), scene);
  key.intensity = 1.4;
  key.diffuse   = new BABYLON.Color3(1.0, 0.92, 0.78);        // golden
  key.specular  = new BABYLON.Color3(0.5, 0.4, 0.2);
  key.position  = new BABYLON.Vector3(40, 60, 30);

  // 3. Fill light from opposite side – cool blue
  const fill = new BABYLON.DirectionalLight('fill', new BABYLON.Vector3(0.5, -0.4, 0.6), scene);
  fill.intensity = 0.4;
  fill.diffuse   = new BABYLON.Color3(0.6, 0.75, 1.0);
  fill.specular  = new BABYLON.Color3(0, 0, 0);

  // ── Shadow generator (key light) ──
  const shadowGen = new BABYLON.ShadowGenerator(2048, key);
  shadowGen.useBlurExponentialShadowMap = true;
  shadowGen.blurKernel                  = 32;
  shadowGen.darkness                    = 0.35;

  // ── Ground plane ──
  _addGround(scene);

  // ── Thin grid ──
  _addGrid(scene);

  // ── Post-processing: slight tone-mapping ──
  _addPostProcess(camera, scene);

  engine.runRenderLoop(() => scene.render());

  return { engine, scene, shadowGen };
}

function _addGround(scene) {
  const ground = BABYLON.MeshBuilder.CreateGround('infiniteGround', { width: 600, height: 600, subdivisions: 1 }, scene);
  const mat    = new BABYLON.StandardMaterial('groundMat', scene);
  mat.diffuseColor  = new BABYLON.Color3(0.13, 0.12, 0.11);
  mat.specularColor = new BABYLON.Color3(0, 0, 0);
  ground.material       = mat;
  ground.receiveShadows = true;
  ground.position.y     = -0.01;
}

function _addGrid(scene) {
  const lines = [];
  const size = 200, step = 5;
  for (let i = -size; i <= size; i += step) {
    const alpha = i % 25 === 0 ? 0.25 : 0.1;
    lines.push([
      new BABYLON.Vector3(i, 0.001, -size),
      new BABYLON.Vector3(i, 0.001, size),
    ]);
    lines.push([
      new BABYLON.Vector3(-size, 0.001, i),
      new BABYLON.Vector3(size, 0.001, i),
    ]);
  }
  const grid = BABYLON.MeshBuilder.CreateLineSystem('grid', { lines }, scene);
  grid.color = new BABYLON.Color3(0.22, 0.20, 0.18);
}

function _addPostProcess(camera, scene) {
  try {
    const pipeline = new BABYLON.DefaultRenderingPipeline('pipeline', true, scene, [camera]);
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType    = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipeline.imageProcessing.exposure           = 1.15;
    pipeline.imageProcessing.contrast           = 1.1;
    pipeline.fxaaEnabled         = true;
    pipeline.bloomEnabled        = false;
  } catch (_) {
    // DefaultRenderingPipeline may not be available in all configs – skip gracefully
  }
}

// ── Build entire building ─────────────────────────────────────────────────────
export function buildBuilding(floors, shadowGen) {
  if (!scene) return;

  if (buildingRoot) {
    buildingRoot.getChildMeshes().forEach(m => m.dispose());
    buildingRoot.dispose();
    buildingRoot = null;
  }

  // Dispose stale materials from previous build
  ['wallMat','floorMat','slabMat'].forEach(n => {
    scene.getMaterialByName(n)?.dispose();
  });

  const floorsWithWalls = floors.filter(f => f.walls.length > 0);
  if (!floorsWithWalls.length) return;

  buildingRoot = new BABYLON.TransformNode('building', scene);

  // ── Wall material — warm plaster ──
  const wallMat = new BABYLON.StandardMaterial('wallMat', scene);
  wallMat.diffuseColor  = new BABYLON.Color3(0.92, 0.88, 0.82);
  wallMat.specularColor = new BABYLON.Color3(0.06, 0.05, 0.04);
  wallMat.ambientColor  = new BABYLON.Color3(0.20, 0.18, 0.15);

  // ── Floor slab material — polished concrete ──
  const slabMat = new BABYLON.StandardMaterial('slabMat', scene);
  slabMat.diffuseColor  = new BABYLON.Color3(0.38, 0.36, 0.34);
  slabMat.specularColor = new BABYLON.Color3(0.12, 0.10, 0.08);
  slabMat.ambientColor  = new BABYLON.Color3(0.15, 0.14, 0.12);

  // Normalise scale to largest floor image
  const maxDim = Math.max(...floorsWithWalls.map(f => Math.max(f.image.width, f.image.height)));
  const scale  = 80 / maxDim;

  const storyGap = 0.25;
  let cumulativeY = 0;

  let totalMinX = Infinity, totalMaxX = -Infinity;
  let totalMinZ = Infinity, totalMaxZ = -Infinity;
  let totalHeight = 0;

  floorsWithWalls.forEach((floor, floorIdx) => {
    const imgW = floor.image.width;
    const imgH = floor.image.height;
    const wH   = floor.wallHeight    ?? 3;
    const wT   = floor.wallThickness ?? 0.2;

    const offsetX = -(imgW * scale) / 2;
    const offsetZ = -(imgH * scale) / 2;

    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const w of floor.walls) {
      const x1 = w.x1 * scale + offsetX, z1 = w.y1 * scale + offsetZ;
      const x2 = w.x2 * scale + offsetX, z2 = w.y2 * scale + offsetZ;
      minX = Math.min(minX, x1, x2); maxX = Math.max(maxX, x1, x2);
      minZ = Math.min(minZ, z1, z2); maxZ = Math.max(maxZ, z1, z2);
    }
    totalMinX = Math.min(totalMinX, minX); totalMaxX = Math.max(totalMaxX, maxX);
    totalMinZ = Math.min(totalMinZ, minZ); totalMaxZ = Math.max(totalMaxZ, maxZ);

    const baseY = cumulativeY;
    const pad   = Math.max(wT, 0.4);

    // Floor slab (thin — like a structural slab, not a thick box)
    const slabThick = 0.12;
    const slab = BABYLON.MeshBuilder.CreateBox(`slab_${floorIdx}`, {
      width:  Math.max(1, (maxX - minX) + pad * 2),
      height: slabThick,
      depth:  Math.max(1, (maxZ - minZ) + pad * 2),
    }, scene);
    slab.position.set((minX + maxX) / 2, baseY - slabThick / 2, -(minZ + maxZ) / 2);
    slab.material     = slabMat;
    slab.receiveShadows = true;
    slab.parent       = buildingRoot;
    if (shadowGen) shadowGen.addShadowCaster(slab);

    // Walls
    for (let idx = 0; idx < floor.walls.length; idx++) {
      const w  = floor.walls[idx];
      const x1 = w.x1 * scale + offsetX, z1 = w.y1 * scale + offsetZ;
      const x2 = w.x2 * scale + offsetX, z2 = w.y2 * scale + offsetZ;
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;

      const box = BABYLON.MeshBuilder.CreateBox(`w_${floorIdx}_${idx}`, {
        width: len, height: wH, depth: wT,
      }, scene);
      box.position.set((x1 + x2) / 2, baseY + wH / 2, -((z1 + z2) / 2));
      box.rotation.y      = Math.atan2(dz, dx);
      box.material        = wallMat;
      box.receiveShadows  = true;
      box.parent          = buildingRoot;
      if (shadowGen) shadowGen.addShadowCaster(box);
    }

    cumulativeY += wH + storyGap;
    totalHeight  = cumulativeY;
  });

  // ── Re-position camera to frame building ──
  const cx = (totalMinX + totalMaxX) / 2;
  const cz = -(totalMinZ + totalMaxZ) / 2;
  const span = Math.max(totalMaxX - totalMinX, totalMaxZ - totalMinZ, totalHeight);

  camera.target = new BABYLON.Vector3(cx, totalHeight / 2, cz);
  camera.radius = Math.max(20, span * 1.6);
  camera.alpha  = -Math.PI / 4;
  camera.beta   = Math.PI / 3.2;
}

// ── Reset camera ─────────────────────────────────────────────────────────────
export function resetCamera() {
  if (!camera) return;
  camera.alpha  = -Math.PI / 2;
  camera.beta   = Math.PI / 3;
  camera.radius = 80;
  camera.target = BABYLON.Vector3.Zero();
}

// ── Legacy compat shim ───────────────────────────────────────────────────────
export function buildWalls(walls, imgWidth, imgHeight, options = {}) {
  if (!walls.length) return;
  buildBuilding([{
    walls,
    points: [],
    image:         { width: imgWidth, height: imgHeight },
    wallHeight:    options.wallHeight    ?? 3,
    wallThickness: options.wallThickness ?? 0.2,
  }], options.shadowGen);
}
