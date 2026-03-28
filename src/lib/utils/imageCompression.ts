/**
 * Image Compression Utility
 * PRD requires images to be compressed/resized before upload to save bandwidth.
 * Uses HTML5 Canvas to resize images to a max dimension and compress as WebP/JPEG.
 *
 * Tier-aware compression: Free users get 1000px/0.70q, Pro gets 2500px/0.92q,
 * Studio gets 2500px/0.95q. Thumbnails are always 400px/0.60q WebP.
 */

export type UserTier = "free" | "pro" | "studio";

interface CompressionConfig {
    maxDimension: number;
    quality: number;
}

const TIER_CONFIG: Record<UserTier, CompressionConfig> = {
    free:   { maxDimension: 1000, quality: 0.70 },
    pro:    { maxDimension: 2500, quality: 0.92 },
    studio: { maxDimension: 2500, quality: 0.95 },
};

const THUMB_DIMENSION = 400;
const THUMB_QUALITY = 0.60;
const MAX_FILE_SIZE_MB = 10; // Bumped for Pro tier high-res

export async function compressImage(file: File, tier: UserTier = "free"): Promise<File> {
  // Skip if already small enough
  if (file.size < 200 * 1024) {
    return file;
  }

  const config = TIER_CONFIG[tier];

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down if larger than tier max dimension
        if (width > config.maxDimension || height > config.maxDimension) {
          if (width > height) {
            height = Math.round((height * config.maxDimension) / width);
            width = config.maxDimension;
          } else {
            width = Math.round((width * config.maxDimension) / height);
            height = config.maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file); // Fallback to original
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, ".webp"),
              {
                type: "image/webp",
                lastModified: Date.now(),
              }
            );
            resolve(compressedFile);
          },
          "image/webp",
          config.quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
  });
}

export function validateImageFile(file: File): string | null {
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!validTypes.includes(file.type)) {
    return "Please upload a JPEG, PNG, WebP, or GIF image.";
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `Image must be under ${MAX_FILE_SIZE_MB}MB.`;
  }
  return null;
}

export function createImagePreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeImagePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Generate a 400px micro-thumbnail (WebP) for grid views.
 * This runs client-side — zero server compute cost.
 */
export async function generateThumbnail(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let { width, height } = img;

                // Scale down to THUMB_DIMENSION
                if (width > height) {
                    height = Math.round((height * THUMB_DIMENSION) / width);
                    width = THUMB_DIMENSION;
                } else {
                    width = Math.round((width * THUMB_DIMENSION) / height);
                    height = THUMB_DIMENSION;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) { resolve(file); return; }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) { resolve(file); return; }
                        // Append _thumb suffix before extension
                        const thumbName = file.name.replace(/\.[^.]+$/, "_thumb.webp");
                        resolve(new File([blob], thumbName, {
                            type: "image/webp",
                            lastModified: Date.now(),
                        }));
                    },
                    "image/webp",
                    THUMB_QUALITY
                );
            };
            img.onerror = () => reject(new Error("Failed to load image for thumbnail"));
        };
        reader.onerror = () => reject(new Error("Failed to read file for thumbnail"));
    });
}

/**
 * Compress + resize an image, adding a semi-transparent watermark in the bottom-right.
 * Uses the same tier-aware config as compressImage.
 */
export async function compressImageWithWatermark(
  file: File,
  aliasName: string,
  tier: UserTier = "free"
): Promise<File> {
  const config = TIER_CONFIG[tier];

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down if larger than tier max dimension
        if (width > config.maxDimension || height > config.maxDimension) {
          if (width > height) {
            height = Math.round((height * config.maxDimension) / width);
            width = config.maxDimension;
          } else {
            width = Math.round((width * config.maxDimension) / height);
            height = config.maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }

        ctx.drawImage(img, 0, 0, width, height);

        // ── WATERMARK ──
        const text = `© @${aliasName} — ModelHorseHub`;
        const fontSize = Math.max(12, Math.floor(width * 0.02));
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";

        // Semi-transparent background pill
        const textMetrics = ctx.measureText(text);
        const padding = 6;
        const bgX = width - textMetrics.width - padding * 3;
        const bgY = height - fontSize - padding * 3;
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(bgX, bgY, textMetrics.width + padding * 2, fontSize + padding * 2);

        // White text at 70% opacity
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.fillText(text, width - padding * 2, height - padding * 2);

        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
              type: "image/webp",
              lastModified: Date.now(),
            }));
          },
          "image/webp",
          config.quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
  });
}
