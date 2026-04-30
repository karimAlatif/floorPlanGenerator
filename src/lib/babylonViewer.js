/**
 * src/lib/babylonViewer.js
 *
 * BabylonJS scene manager.
 * NOTE: window resize is NOT handled here — the React component does it.
 */

import * as BABYLON from '@babylonjs/core';

let engine     = null;
let scene      = null;
let camera     = null;
let wallMeshes = [];

export function initBabylon(canvas) {
  engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

  scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.1, 1);

  // Camera
  camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3, 40, BABYLON.Vector3.Zero(), scene);
  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 200;
  camera.upperBetaLimit   = Math.PI / 2.1;
  camera.attachControl(canvas, true);

  // Lights
  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.6;
  hemi.diffuse   = new BABYLON.Color3(0.9, 0.9, 1);

  const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1, -2, -1), scene);
  dir.intensity = 0.8;
  dir.position  = new BABYLON.Vector3(20, 30, 20);

  // Shadow generator
  const shadowGen = new BABYLON.ShadowGenerator(1024, dir);
  shadowGen.useBlurExponentialShadowMap = true;

  // Ground
  const ground    = BABYLON.MeshBuilder.CreateGround('ground', { width: 200, height: 200 }, scene);
  const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
  groundMat.diffuseColor  = new BABYLON.Color3(0.12, 0.12, 0.18);
  groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
  ground.material       = groundMat;
  ground.receiveShadows = true;

  // Grid helper
  _addGrid(scene);

  engine.runRenderLoop(() => scene.render());

  return { engine, scene, shadowGen };
}

function _addGrid(scene) {
  const lines = [];
  const size  = 100;
  const step  = 5;
  for (let i = -size; i <= size; i += step) {
    lines.push([new BABYLON.Vector3(i, 0.01, -size), new BABYLON.Vector3(i, 0.01, size)]);
    lines.push([new BABYLON.Vector3(-size, 0.01, i), new BABYLON.Vector3(size, 0.01, i)]);
  }
  const grid  = BABYLON.MeshBuilder.CreateLineSystem('grid', { lines }, scene);
  grid.color  = new BABYLON.Color3(0.12, 0.12, 0.28);
}

export function buildWalls(walls, imgWidth, imgHeight, options = {}) {
  const { wallHeight = 3, wallThickness = 0.2, shadowGen = null } = options;

  // Dispose previous walls
  for (const m of wallMeshes) m.dispose();
  wallMeshes = [];

  if (!scene || !walls.length) return;

  // Scale floorplan to fit ~80 BabylonJS units
  const scale   = 80 / Math.max(imgWidth, imgHeight);
  const offsetX = -(imgWidth  * scale) / 2;
  const offsetZ = -(imgHeight * scale) / 2;

  const wallMat = new BABYLON.StandardMaterial('wallMat', scene);
  wallMat.diffuseColor  = new BABYLON.Color3(0.85, 0.82, 0.78);
  wallMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

  const root = new BABYLON.TransformNode('wallsRoot', scene);

  walls.forEach((w, idx) => {
    const x1 = w.x1 * scale + offsetX;
    const z1 = w.y1 * scale + offsetZ;
    const x2 = w.x2 * scale + offsetX;
    const z2 = w.y2 * scale + offsetZ;

    const dx = x2 - x1, dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) return;

    const box = BABYLON.MeshBuilder.CreateBox(`wall_${idx}`, {
      width: length,
      height: wallHeight,
      depth: wallThickness,
    }, scene);

    box.position.set((x1 + x2) / 2, wallHeight / 2, (z1 + z2) / 2);
    box.rotation.y   = -Math.atan2(dz, dx);
    box.material     = wallMat;
    box.receiveShadows = true;
    box.parent = root;

    if (shadowGen) shadowGen.addShadowCaster(box);
    wallMeshes.push(box);
  });

  root.scaling.set(1, 1, -1);

  // Recenter camera
  if (wallMeshes.length > 0) {
    camera.target = new BABYLON.Vector3(0, wallHeight / 2, 0);
    camera.radius = Math.max(imgWidth, imgHeight) * scale * 0.8;
  }
}

export function resetCamera() {
  if (!camera) return;
  camera.alpha  = -Math.PI / 2;
  camera.beta   = Math.PI / 3;
  camera.radius = 60;
  camera.target = BABYLON.Vector3.Zero();
}
