import { useState, useCallback } from 'react';
import FloorplanPanel from './components/FloorplanPanel';
import BabylonPanel from './components/BabylonPanel';
import { detectWalls } from './lib/wallDetector';

export default function App() {
  const [originalImage, setOriginalImage] = useState(null);
  const [cleanedBitmap, setCleanedBitmap] = useState(null);
  const [detectedWalls, setDetectedWalls] = useState([]);
  const [detectedPoints, setDetectedPoints] = useState([]);
  const [showingCleaned, setShowingCleaned] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  const [darkThreshold, setDarkThreshold] = useState(50);
  const [minLen, setMinLen] = useState(20);
  const [minComponentArea, setMinComponentArea] = useState(500);

  const [wallHeight, setWallHeight] = useState(3);
  const [wallThickness, setWallThickness] = useState(0.2);

  const handleImageLoad = useCallback((img) => {
    setOriginalImage(img);
    setDetectedWalls([]);
    setDetectedPoints([]);
    setCleanedBitmap(null);
    setShowingCleaned(false);
  }, []);

  const handleDetect = useCallback(async () => {
    if (!originalImage) return;
    setIsDetecting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 20));

      const offscreen = new OffscreenCanvas(originalImage.width, originalImage.height);
      const offCtx = offscreen.getContext('2d');
      offCtx.drawImage(originalImage, 0, 0);
      const imageData = offCtx.getImageData(0, 0, originalImage.width, originalImage.height);

      const result = detectWalls(imageData, {
        darkThreshold,
        minLength: minLen,
        minComponentArea,
      });

      setDetectedWalls(result.walls);
      setDetectedPoints(result.points);

      const imgData = new ImageData(
        new Uint8ClampedArray(result.cleanedData),
        result.width,
        result.height,
      );
      const bitmap = await createImageBitmap(imgData);
      setCleanedBitmap(bitmap);
    } catch (err) {
      console.error('Detection error:', err);
      alert('Detection failed: ' + err.message);
    } finally {
      setIsDetecting(false);
    }
  }, [originalImage, darkThreshold, minLen, minComponentArea]);

  const handleExport = useCallback(() => {
    if (!detectedWalls.length || !originalImage) return;

    const data = {
      imageSize: { width: originalImage.width, height: originalImage.height },
      walls: detectedWalls,
      points: detectedPoints,
      metadata: {
        wallCount: detectedWalls.length,
        pointCount: detectedPoints.length,
        darkThreshold,
        minLength: minLen,
        minComponentArea,
        exportedAt: new Date().toISOString(),
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'floorplan_walls.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [detectedWalls, detectedPoints, originalImage, darkThreshold, minLen, minComponentArea]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      <FloorplanPanel
        originalImage={originalImage}
        cleanedBitmap={cleanedBitmap}
        walls={detectedWalls}
        points={detectedPoints}
        showingCleaned={showingCleaned}
        isDetecting={isDetecting}
        darkThreshold={darkThreshold}
        minLen={minLen}
        minComponentArea={minComponentArea}
        onImageLoad={handleImageLoad}
        onDetect={handleDetect}
        onToggleCleaned={() => setShowingCleaned((v) => !v)}
        onExport={handleExport}
        onDarkThresholdChange={setDarkThreshold}
        onMinLenChange={setMinLen}
        onMinComponentAreaChange={setMinComponentArea}
      />

      <BabylonPanel
        walls={detectedWalls}
        imgWidth={originalImage?.width ?? 0}
        imgHeight={originalImage?.height ?? 0}
        wallHeight={wallHeight}
        wallThickness={wallThickness}
        onWallHeightChange={setWallHeight}
        onWallThicknessChange={setWallThickness}
      />
    </div>
  );
}
