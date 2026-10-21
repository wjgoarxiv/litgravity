function regionKey(x, y, width, height) {
  const gridX = Math.min(7, Math.floor((x * 8) / width));
  const gridY = Math.min(7, Math.floor((y * 8) / height));
  return `${gridX}:${gridY}`;
}

export function diffImages(reference, actual) {
  const dimensionsMatch = reference.width === actual.width && reference.height === actual.height;
  if (!dimensionsMatch) {
    return {
      command: "image-diff",
      dimensionsMatch: false,
      reference: { width: reference.width, height: reference.height },
      actual: { width: actual.width, height: actual.height },
      totalPixels: 0,
      diffPixels: 0,
      diffRatio: 1,
      alphaDiffPixels: 0,
      exactMatchRatio: null,
      meanAbsoluteRgbaDifference: null,
      maxChannelDelta: null,
      similarityScore: null,
      alphaChannelIntact: false,
      hotspots: [],
      summary: "dimensions differ; similarity is not computed.",
    };
  }
  const totalPixels = reference.width * reference.height;
  const regions = new Map();
  let diffPixels = 0;
  let alphaDiffPixels = 0;
  let alphaChannelIntact = true;
  let absoluteDelta = 0;
  let maxChannelDelta = 0;
  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    const offset = pixel * 4;
    let differs = false;
    for (const channel of [0, 1, 2, 3]) {
      const delta = Math.abs(reference.rgba[offset + channel] - actual.rgba[offset + channel]);
      absoluteDelta += delta;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      if (delta > 0) differs = true;
    }
    if (!differs) continue;
    diffPixels += 1;
    if (reference.rgba[offset + 3] !== actual.rgba[offset + 3]) {
      alphaChannelIntact = false;
      alphaDiffPixels += 1;
    }
    const x = pixel % reference.width;
    const y = Math.floor(pixel / reference.width);
    const key = regionKey(x, y, reference.width, reference.height);
    regions.set(key, (regions.get(key) ?? 0) + 1);
  }
  const diffRatio = totalPixels === 0 ? 0 : diffPixels / totalPixels;
  const hotspots = [...regions.entries()]
    .map(([key, count]) => {
      const [gridX, gridY] = key.split(":").map(Number);
      const x = Math.floor((gridX * reference.width) / 8);
      const y = Math.floor((gridY * reference.height) / 8);
      const width = Math.ceil(reference.width / 8);
      const height = Math.ceil(reference.height / 8);
      return { gridX, gridY, x, y, width, height, diffRatio: count / (width * height) };
    })
    .sort((left, right) => right.diffRatio - left.diffRatio)
    .slice(0, 8);
  const similarityScore = Number(((1 - diffRatio) * 100).toFixed(4));
  const exactMatchRatio = totalPixels === 0 ? 1 : (totalPixels - diffPixels) / totalPixels;
  const meanAbsoluteRgbaDifference = totalPixels === 0
    ? 0
    : Number((absoluteDelta / (totalPixels * 4)).toFixed(8));
  return {
    command: "image-diff",
    dimensionsMatch: true,
    reference: { width: reference.width, height: reference.height },
    actual: { width: actual.width, height: actual.height },
    totalPixels,
    diffPixels,
    alphaDiffPixels,
    diffRatio,
    exactMatchRatio,
    meanAbsoluteRgbaDifference,
    maxChannelDelta,
    similarityScore,
    alphaChannelIntact,
    hotspots,
    summary: `${similarityScore}/100 advisory similarity; ${hotspots.length} hotspot(s).`,
  };
}
