/**
 * Client-Side Background Removal & Studio Standardization
 * Analyzes peripheral background pixels (e.g. bedsheet, floor, rug)
 * and isolates the foreground garment with edge feathering and a clean studio backdrop.
 */

export interface StudioProcessOptions {
  featherRadius?: number;
  sensitivity?: number; // 0 - 100
  studioBackground?: 'transparent' | 'studio-white' | 'studio-dark';
}

export async function processStudioCutout(
  base64Src: string,
  options: StudioProcessOptions = {}
): Promise<string> {
  const {
    sensitivity = 35,
    studioBackground = 'transparent',
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error('Failed to load image for background processing'));
    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // 1. Sample perimeter border pixels to identify background color profile
        const samplePoints: [number, number][] = [];
        const stepX = Math.max(1, Math.floor(width / 20));
        const stepY = Math.max(1, Math.floor(height / 20));

        // Top and bottom borders
        for (let x = 0; x < width; x += stepX) {
          samplePoints.push([x, 2], [x, 5], [x, height - 3], [x, height - 6]);
        }
        // Left and right borders
        for (let y = 0; y < height; y += stepY) {
          samplePoints.push([2, y], [5, y], [width - 3, y], [width - 6, y]);
        }

        let bgR = 0, bgG = 0, bgB = 0;
        let validSamples = 0;

        for (const [sx, sy] of samplePoints) {
          const idx = (sy * width + sx) * 4;
          bgR += data[idx];
          bgG += data[idx + 1];
          bgB += data[idx + 2];
          validSamples++;
        }

        bgR = Math.round(bgR / validSamples);
        bgG = Math.round(bgG / validSamples);
        bgB = Math.round(bgB / validSamples);

        const thresholdSq = Math.pow((sensitivity / 100) * 180, 2);

        // 2. Compute color distance map and soft alpha mask
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Euclidean distance squared in RGB
          const distSq =
            (r - bgR) * (r - bgR) +
            (g - bgG) * (g - bgG) +
            (b - bgB) * (b - bgB);

          if (distSq < thresholdSq) {
            // Close to background: calculate smooth falloff
            const ratio = distSq / thresholdSq;
            if (ratio < 0.6) {
              data[i + 3] = 0; // Fully transparent background
            } else {
              data[i + 3] = Math.round(((ratio - 0.6) / 0.4) * 255);
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // 3. Render onto requested studio backdrop
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx) {
          resolve(canvas.toDataURL('image/png'));
          return;
        }

        if (studioBackground === 'studio-white') {
          finalCtx.fillStyle = '#f8fafc';
          finalCtx.fillRect(0, 0, width, height);
          // Subtle soft studio spotlight
          const grad = finalCtx.createRadialGradient(
            width / 2, height / 2, width * 0.1,
            width / 2, height / 2, width * 0.7
          );
          grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
          grad.addColorStop(1, 'rgba(241, 245, 249, 1)');
          finalCtx.fillStyle = grad;
          finalCtx.fillRect(0, 0, width, height);
        } else if (studioBackground === 'studio-dark') {
          finalCtx.fillStyle = '#18181b';
          finalCtx.fillRect(0, 0, width, height);
        }

        finalCtx.drawImage(canvas, 0, 0);
        resolve(finalCanvas.toDataURL(studioBackground === 'transparent' ? 'image/png' : 'image/jpeg', 0.88));
      } catch (err) {
        reject(err);
      }
    };
    img.src = base64Src;
  });
}
