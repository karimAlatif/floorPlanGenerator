/**
 * src/lib/babylonViewer.js
 *
 * BabylonJS scene manager - multi-floor building, PBR lighting, highlight, explode.
 * NOTE: window resize is NOT handled here - the React component manages it.
 */

import * as BABYLON from '@babylonjs/core';

let engine         = null;
let scene          = null;
let camera         = null;
let buildingRoot   = null;
let highlightLayer = null;

// Per-floor data - rebuilt on every buildBuilding call
let floorNodeData      = []; // [{ floorId, node, baseY, slotHeight }]
const floorMeshMap     = new Map(); // floorId -> Mesh[]
let _highlightedMeshes = [];
let _isExploded        = false;

// ---------- Init -------------------------------------------------------
export function initBabylon(canvas) {
  // Reset module state for hot-reload / remount
  floorNodeData      = [];
  floorMeshMap.clear();
  _highlightedMeshes = [];
  _isExploded        = false;

  engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
  });

  scene = new BABYLON.Scene(engine);
  scene.clearColor   = new BABYLON.Color4(0.04, 0.04, 0.08, 1);
  scene.ambientColor = new BABYLON.Color3(0.10, 0.09, 0.07);

  // Camera
  camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3.2, 80, BABYLON.Vector3.Zero(), scene);
  camera.lowerRadiusLimit   = 5;
  camera.upperRadiusLimit   = 600;
  camera.upperBetaLimit     = Math.PI / 2.05;
  camera.wheelPrecision     = 5;
  camera.panningSensibility = 100;
  camera.attachControl(canvas, true);

  // 1. Sky dome - warm overcast sky
  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity   = 0.50;
  hemi.diffuse     = new BABYLON.Color3(0.86, 0.84, 0.78);
  hemi.groundColor = new BABYLON.Color3(0.18, 0.14, 0.10);
  hemi.specular    = new BABYLON.Color3(0, 0, 0);

  // 2. Key sun - golden hour angle, strong & directional
  const key = new BABYLON.DirectionalLight('key', new BABYLON.Vector3(-0.50, -1, -0.40).normalize(), scene);
  key.intensity = 3.2;
  key.diffuse   = new BABYLON.Color3(1.00, 0.92, 0.76);
  key.specular  = new BABYLON.Color3(0.40, 0.30, 0.14);
  key.position  = new BABYLON.Vector3(60, 90, 40);

  // 3. Cool fill - sky bounce from opposite side
  const fill = new BABYLON.DirectionalLight('fill', new BABYLON.Vector3(0.40, -0.20, 0.55).normalize(), scene);
  fill.intensity = 0.55;
  fill.diffuse   = new BABYLON.Color3(0.50, 0.64, 1.00);
  fill.specular  = new BABYLON.Color3(0, 0, 0);

  // 4. Subtle back rim - separates geometry from background
  const rim = new BABYLON.DirectionalLight('rim', new BABYLON.Vector3(0.10, -0.30, 1.0).normalize(), scene);
  rim.intensity = 0.20;
  rim.diffuse   = new BABYLON.Color3(0.70, 0.78, 1.00);
  rim.specular  = new BABYLON.Color3(0, 0, 0);

  // Shadow generator (key light only for performance)
  const shadowGen = new BABYLON.ShadowGenerator(2048, key);
  shadowGen.useBlurExponentialShadowMap = true;
  shadowGen.blurKernel                  = 20;
  shadowGen.darkness                    = 0.52;
  shadowGen.transparencyShadow          = true;
  shadowGen.forceBackFacesOnly          = true;

  // Highlight layer for active-floor glow
  try {
    highlightLayer = new BABYLON.HighlightLayer('hl', scene, {
      mainTextureRatio:    0.5,
      blurTextureSizeRatio: 0.5,
    });
    highlightLayer.outerGlow          = true;
    highlightLayer.innerGlow          = false;
    highlightLayer.blurHorizontalSize = 1.0;
    highlightLayer.blurVerticalSize   = 1.0;
  } catch (_) { highlightLayer = null; }

  _addGrid(scene);
  _addPostProcess(camera, scene);

  engine.runRenderLoop(() => scene.render());

  return { engine, scene, shadowGen };
}

function _addGrid(scene) {
  const lines = [];
  const size = 200, step = 5;
  for (let i = -size; i <= size; i += step) {
    lines.push([ new BABYLON.Vector3(i, 0.001, -size), new BABYLON.Vector3(i, 0.001,  size) ]);
    lines.push([ new BABYLON.Vector3(-size, 0.001, i), new BABYLON.Vector3( size, 0.001, i) ]);
  }
  const grid = BABYLON.MeshBuilder.CreateLineSystem('grid', { lines }, scene);
  grid.color = new BABYLON.Color3(0.20, 0.18, 0.16);
}

function _addPostProcess(camera, scene) {
  try {
    const pipeline = new BABYLON.DefaultRenderingPipeline('pipeline', true, scene, [camera]);

    pipeline.imageProcessingEnabled                  = true;
    pipeline.imageProcessing.toneMappingEnabled      = true;
    pipeline.imageProcessing.toneMappingType         = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipeline.imageProcessing.exposure                = 1.25;
    pipeline.imageProcessing.contrast                = 1.18;
    pipeline.imageProcessing.vignetteEnabled         = true;
    pipeline.imageProcessing.vignetteWeight          = 2.0;
    pipeline.imageProcessing.vignetteCameraFov       = 0.5;
    pipeline.imageProcessing.colorCurvesEnabled      = true;

    pipeline.fxaaEnabled     = true;

    pipeline.bloomEnabled    = true;
    pipeline.bloomThreshold  = 0.80;
    pipeline.bloomWeight     = 0.20;
    pipeline.bloomKernel     = 48;
    pipeline.bloomScale      = 0.5;

    pipeline.sharpenEnabled         = true;
    pipeline.sharpen.edgeAmount     = 0.22;
    pipeline.sharpen.colorAmount    = 1.0;
  } catch (_) { /* unavailable in some configs */ }
}

// ---------- Highlight active floor ----------------------------------------
export function highlightFloor(floorId) {
  if (!highlightLayer) return;

  _highlightedMeshes.forEach(m => {
    try { highlightLayer.removeMesh(m); } catch (_) {}
  });
  _highlightedMeshes = [];

  if (floorId == null) return;
  const meshes = floorMeshMap.get(floorId);
  if (!meshes) return;

  const glowColor = new BABYLON.Color3(1.0, 0.72, 0.08); // warm amber
  meshes.forEach(m => {
    try {
      highlightLayer.addMesh(m, glowColor);
      _highlightedMeshes.push(m);
    } catch (_) {}
  });
}

// ---------- Explode / collapse floors -------------------------------------
export function setExplodeGap(exploded) {
  if (!scene || !floorNodeData.length) return;
  _isExploded = exploded;

  const EXTRA_GAP = 7; // extra world-units per floor level when exploded
  const ease = new BABYLON.CubicEase();
  ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);

  floorNodeData.forEach(({ node, baseY }, i) => {
    const targetY = exploded ? baseY + i * EXTRA_GAP : baseY;

    const anim = new BABYLON.Animation(
      'explode_' + i, 'position.y', 60,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    anim.setKeys([
      { frame:  0, value: node.position.y },
      { frame: 24, value: targetY },
    ]);
    anim.setEasingFunction(ease);
    node.animations = [anim];
    scene.beginAnimation(node, 0, 24, false);
  });
}

// ---------- Build entire building -----------------------------------------
export function buildBuilding(floors, shadowGen) {
  if (!scene) return;

  if (buildingRoot) {
    buildingRoot.getChildMeshes().forEach(m => m.dispose());
    buildingRoot.dispose();
    buildingRoot = null;
  }
  // dispose(false, forceDisposeTextures=true) to also free GPU texture memory
  ['wallMat', 'slabMat'].forEach(n => scene.getMaterialByName(n)?.dispose(false, true));

  floorNodeData      = [];
  floorMeshMap.clear();
  _highlightedMeshes = [];
  _isExploded        = false;

  const floorsWithWalls = floors.filter(f => f.walls.length > 0);
  if (!floorsWithWalls.length) return;

  buildingRoot = new BABYLON.TransformNode('building', scene);

  // PBR wall material - warm plaster
  const wallMat          = new BABYLON.PBRMaterial('wallMat', scene);
  wallMat.albedoColor    = new BABYLON.Color3(0.93, 0.89, 0.83);
  wallMat.metallic       = 0.0;
  wallMat.roughness      = 0.88;
  wallMat.directIntensity      = 1.0;
  wallMat.environmentIntensity = 0.06;

  // PBR slab material - oak wood floor
  const slabMat          = new BABYLON.PBRMaterial('slabMat', scene);
  slabMat.metallic       = 0.0;
  slabMat.roughness      = 0.78;
  slabMat.directIntensity      = 1.0;
  slabMat.environmentIntensity = 0.08;

  // Load PBR texture maps (from public/textures/2K/)
  const _tex = (file, isLinear) => {
    const t = new BABYLON.Texture('/textures/2K/' + file, scene);
    t.uScale = 4; t.vScale = 4; // tile over the slab
    if (isLinear) t.gammaSpace = false;
    return t;
  };
  slabMat.albedoTexture  = _tex('Poliigon_WoodVeneerOak_7760_BaseColor.jpg', false);
  slabMat.bumpTexture    = _tex('Poliigon_WoodVeneerOak_7760_Normal.png',     true);
  slabMat.ambientTexture = _tex('Poliigon_WoodVeneerOak_7760_AmbientOcclusion.jpg', true);
  slabMat.ambientTextureStrength = 0.8;
  // Roughness scalar is used since we don't pack an ORM texture
  // (Roughness map drives microSurface via useRoughnessFromMetallicTextureGreen
  //  only when metallicTexture is set; we keep it as a scalar for simplicity)

  const maxDim = Math.max(...floorsWithWalls.map(f => Math.max(f.image.width, f.image.height)));
  const scale  = 80 / maxDim;

  const storyGap = 0.20;
  let cumulativeY = 0;

  let totalMinX = Infinity, totalMaxX = -Infinity;
  let totalMinZ = Infinity, totalMaxZ = -Infinity;
  let totalHeight = 0;

  // Reverse so the first item in the sidebar is the HIGHEST floor
  const ordered = [...floorsWithWalls].reverse();

  ordered.forEach((floor, fi) => {
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

    const baseY     = cumulativeY;
    const pad       = Math.max(wT, 0.4);
    const slabThick = 0.14;

    // Per-floor root node - used by explode animation
    const floorNode = new BABYLON.TransformNode('fn_' + floor.id, scene);
    floorNode.position.y = baseY;
    floorNode.parent     = buildingRoot;

    const meshes = [];

    // Floor slab
    const slab = BABYLON.MeshBuilder.CreateBox('slab_' + floor.id, {
      width:  Math.max(1, (maxX - minX) + pad * 2),
      height: slabThick,
      depth:  Math.max(1, (maxZ - minZ) + pad * 2),
    }, scene);
    slab.position.set((minX + maxX) / 2, -slabThick / 2, -(minZ + maxZ) / 2);
    slab.material       = slabMat;
    slab.receiveShadows = true;
    slab.parent         = floorNode;
    if (shadowGen) shadowGen.addShadowCaster(slab);
    meshes.push(slab);

    // Walls
    for (let idx = 0; idx < floor.walls.length; idx++) {
      const w  = floor.walls[idx];
      const x1 = w.x1 * scale + offsetX, z1 = w.y1 * scale + offsetZ;
      const x2 = w.x2 * scale + offsetX, z2 = w.y2 * scale + offsetZ;
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;

      const box = BABYLON.MeshBuilder.CreateBox('w_' + floor.id + '_' + idx, {
        width: len, height: wH, depth: wT,
      }, scene);
      box.position.set((x1 + x2) / 2, wH / 2, -((z1 + z2) / 2));
      box.rotation.y     = Math.atan2(dz, dx);
      box.material       = wallMat;
      box.receiveShadows = true;
      box.parent         = floorNode;
      if (shadowGen) shadowGen.addShadowCaster(box);
      meshes.push(box);
    }

    floorMeshMap.set(floor.id, meshes);
    floorNodeData.push({ floorId: floor.id, node: floorNode, baseY, slotHeight: wH + storyGap });

    cumulativeY += wH + storyGap;
    totalHeight  = cumulativeY;
  });

  const cx   = (totalMinX + totalMaxX) / 2;
  const cz   = -(totalMinZ + totalMaxZ) / 2;
  const span = Math.max(totalMaxX - totalMinX, totalMaxZ - totalMinZ, totalHeight);

  camera.target = new BABYLON.Vector3(cx, totalHeight / 2, cz);
  camera.radius = Math.max(20, span * 1.6);
  camera.alpha  = -Math.PI / 4;
  camera.beta   = Math.PI / 3.2;
}

// ---------- Reset camera --------------------------------------------------
export function resetCamera() {
  if (!camera) return;
  camera.alpha  = -Math.PI / 2;
  camera.beta   = Math.PI / 3;
  camera.radius = 80;
  camera.target = BABYLON.Vector3.Zero();
}

// ---------- Legacy compat shim --------------------------------------------
export function buildWalls(walls, imgWidth, imgHeight, options = {}) {
  if (!walls.length) return;
  buildBuilding([{
    id:            -1,
    walls,
    points:        [],
    image:         { width: imgWidth, height: imgHeight },
    wallHeight:    options.wallHeight    ?? 3,
    wallThickness: options.wallThickness ?? 0.2,
  }], options.shadowGen);
}
