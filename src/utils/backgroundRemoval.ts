import { removeBackground, type Config } from '@imgly/background-removal';

export interface StudioProcessOptions {
  onProgress?: (progressPercent: number, stageText: string) => void;
  studioBackground?: 'transparent' | 'studio-white';
}

/**
 * AI Neural Network Background Removal (Client-Side ONNX / Saliency Model)
 * Accurately segments clothing from complex textures (bedsheets, blankets, carpets, floors).
 */
export async function processStudioCutout(
  base64Src: string,
  options: StudioProcessOptions = {}
): Promise<string> {
  const { onProgress, studioBackground = 'studio-white' } = options;

  const config: Config = {
    model: 'small', // Fast mobile-friendly model (~20MB cached in browser)
    progress: (key: string, current: number, total: number) => {
      if (total > 0 && onProgress) {
        const percent = Math.round((current / total) * 100);
        const stage = key.includes('fetch') ? 'Loading AI Model...' : 'Segmenting Clothing...';
        onProgress(percent, stage);
      }
    },
    output: {
      format: 'image/png',
      quality: 0.85,
    },
  };

  // Run neural network segmentation
  const cutoutBlob = await removeBackground(base64Src, config);

  // Convert Blob to Base64
  const cutoutBase64 = await blobToBase64(cutoutBlob);

  if (studioBackground === 'transparent') {
    return cutoutBase64;
  }

  // Composite onto studio backdrop with gentle spotlight
  return renderOnStudioBackdrop(cutoutBase64);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read cutout blob'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function renderOnStudioBackdrop(cutoutBase64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error('Failed to load cutout image for studio canvas'));
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(cutoutBase64);
        return;
      }

      // 1. Crisp studio white-grey background
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle soft radial spotlight behind the garment
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.1,
        width / 2,
        height / 2,
        width * 0.75
      );
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(1, '#f1f5f9');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 3. Draw garment on top
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.src = cutoutBase64;
  });
}
