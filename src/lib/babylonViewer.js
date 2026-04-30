/**
 * src/lib/babylonViewer.js
 *
 * BabylonJS scene manager — supports multi-floor building rendering.
 * NOTE: window resize is NOT handled here — the React component does it.
 */

import * as BABYLON from '@babylonjs/core';

let engine       = null;
let scene        = null;
let camera       = null;
let buildingRoot = null;  // TransformNode that holds all floors

// ── Init ─────────────────────────────────────────────────────────────────────
export function initBabylon(canvas) {
  engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

  scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.1, 1);

  // Camera
  camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3, 80, BABYLON.Vector3.Zero(), scene);
  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 500;
  camera.upperBetaLimit   = Math.PI / 2.1;
  camera.attachControl(canvas, true);

  // Lights
  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.6;
  hemi.diffuse   = new BABYLON.Color3(0.9, 0.9, 1);

  const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1, -2, -1), scene);
  dir.intensity = 0.8;
  dir.position  = new BABYLON.Vector3(20, 40, 20);

  // Shadow generator
  const shadowGen = new BABYLON.ShadowGenerator(1024, dir);
  shadowGen.useBlurExponentialShadowMap = true;

  // Infinite background grid
  _addGrid(scene);

  engine.runRenderLoop(() => scene.render());

  return { engine, scene, shadowGen };
}

function _addGrid(scene) {
  const lines = [];
  const size  = 200;
  const step  = 5;
  for (let i = -size; i <= size; i += step) {
    lines.push([new BABYLON.Vector3(i, 0, -size), new BABYLON.Vector3(i, 0, size)]);
    lines.push([new BABYLON.Vector3(-size, 0, i), new BABYLON.Vector3(size, 0, i)]);
  }
  const grid = BABYLON.MeshBuilder.CreateLineSystem('grid', { lines }, scene);
  grid.color  = new BABYLON.Color3(0.1, 0.1, 0.24);
}

// ── Build entire building from all floors ─────────────────────────────────────
export function buildBuilding(floors, shadowGen) {
  if (!scene) return;

  // Dispose previous building
  if (buildingRoot) {
    buildingRoot.getChildMeshes().forEach(m => m.dispose());
    buildingRoot.dispose();
    buildingRoot = null;
  }

  const floorsWithWalls = floors.filter(f => f.walls.length > 0);
  if (!floorsWithWalls.length) return;

  buildingRoot = new BABYLON.TransformNode('building', scene);

  // Shared materials (created once, reused across floors)
  const wallMat = new BABYLON.StandardMaterial('wallMat', scene);
  wallMat.diffuseColor  = new BABYLON.Color3(0.85, 0.82, 0.78);
  wallMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

  const floorMat = new BABYLON.StandardMaterial('floorMat', scene);
  floorMat.diffuseColor  = new BABYLON.Color3(0.2, 0.22, 0.28);
  floorMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);

  // Normalise: find the largest image dimension across all floors for consistent scale
  const maxDim = Math.max(...floorsWithWalls.map(f => Math.max(f.image.width, f.image.height)));
  const scale  = 80 / maxDim;

  // Determine max wallHeight for stacking offset
  const storyGap = 0.3;  // small gap between floors for visual clarity

  let cumulativeY = 0;
  let totalHeight = 0;
  let totalMinX = Infinity, totalMaxX = -Infinity;
  let totalMinZ = Infinity, totalMaxZ = -Infinity;

  floorsWithWalls.forEach((floor, floorIdx) => {
    const imgW = floor.image.width;
    const imgH = floor.image.height;
    const wallHeight    = floor.wallHeight    ?? 3;
    const wallThickness = floor.wallThickness ?? 0.2;

    const offsetX = -(imgW * scale) / 2;
    const offsetZ = -(imgH * scale) / 2;

    // Compute min/max for floor mesh
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const w of floor.walls) {
      const x1 = w.x1 * scale + offsetX, z1 = w.y1 * scale + offsetZ;
      const x2 = w.x2 * scale + offsetX, z2 = w.y2 * scale + offsetZ;
      minX = Math.min(minX, x1, x2); maxX = Math.max(maxX, x1, x2);
      minZ = Math.min(minZ, z1, z2); maxZ = Math.max(maxZ, z1, z2);
    }
    totalMinX = Math.min(totalMinX, minX); totalMaxX = Math.max(totalMaxX, maxX);
    totalMinZ = Math.min(totalMinZ, minZ); totalMaxZ = Math.max(totalMaxZ, maxZ);

    const floorBaseY = cumulativeY;
    const pad        = Math.max(0.5, wallThickness * 2);

    // Floor slab
    const slabW = Math.max(1, (maxX - minX) + pad * 2);
    const slabD = Math.max(1, (maxZ - minZ) + pad * 2);
    const slab  = BABYLON.MeshBuilder.CreateGround(`slab_${floorIdx}`, { width: slabW, height: slabD, subdivisions: 1 }, scene);
    slab.position.set((minX + maxX) / 2, floorBaseY, -(minZ + maxZ) / 2);
    slab.material     = floorMat;
    slab.receiveShadows = true;
    slab.parent       = buildingRoot;

    // Floor label (optional: thin text placeholder not rendered, keep for future)
    
    // Walls
    for (let idx = 0; idx < floor.walls.length; idx++) {
      const w = floor.walls[idx];
      const x1 = w.x1 * scale + offsetX, z1 = w.y1 * scale + offsetZ;
      const x2 = w.x2 * scale + offsetX, z2 = w.y2 * scale + offsetZ;
      const dx = x2 - x1, dz = z2 - z1;
      const length = Math.hypot(dx, dz);
      if (length < 0.05) continue;

      const box = BABYLON.MeshBuilder.CreateBox(`w_${floorIdx}_${idx}`, {
        width: length,
        height: wallHeight,
        depth: wallThickness,
      }, scene);
      box.position.set(
        (x1 + x2) / 2,
        floorBaseY + wallHeight / 2,
        -((z1 + z2) / 2),          // negate Z to match image coords
      );
      box.rotation.y = Math.atan2(dz, dx);  // no extra negation — Z already flipped
      box.material       = wallMat;
      box.receiveShadows = true;
      box.parent         = buildingRoot;

      if (shadowGen) shadowGen.addShadowCaster(box);
    }

    cumulativeY += wallHeight + storyGap;
    totalHeight  = cumulativeY;
  });

  // Re-center camera on the whole building
  const cx = (totalMinX + totalMaxX) / 2;
  const cz = -(totalMinZ + totalMaxZ) / 2;
  const span = Math.max(totalMaxX - totalMinX, totalMaxZ - totalMinZ, totalHeight);

  camera.target = new BABYLON.Vector3(cx, totalHeight / 2, cz);
  camera.radius = Math.max(20, span * 1.5);
  camera.alpha  = -Math.PI / 2;
  camera.beta   = Math.PI / 3.5;
}

// ── Reset camera ─────────────────────────────────────────────────────────────
export function resetCamera() {
  if (!camera) return;
  camera.alpha  = -Math.PI / 2;
  camera.beta   = Math.PI / 3;
  camera.radius = 80;
  camera.target = BABYLON.Vector3.Zero();
}

// ── Legacy single-floor helpers (kept for compatibility) ─────────────────────
export function buildWalls(walls, imgWidth, imgHeight, options = {}) {
  if (!walls.length) return;
  buildBuilding([{
    walls,
    points: [],
    image: { width: imgWidth, height: imgHeight },
    wallHeight:    options.wallHeight    ?? 3,
    wallThickness: options.wallThickness ?? 0.2,
  }], options.shadowGen);
}

