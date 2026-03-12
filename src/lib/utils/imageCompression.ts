/**
 * Image Compression Utility
 * PRD requires images to be compressed/resized before upload to save bandwidth.
 * Uses HTML5 Canvas to resize images to a max dimension and compress as WebP/JPEG.
 */

const MAX_DIMENSION = 1000; // Max width or height in pixels
const QUALITY = 0.7;        // Compression quality (0-1)
const MAX_FILE_SIZE_MB = 5;  // Max file size in MB

export async function compressImage(file: File): Promise<File> {
  // Skip if already small enough
  if (file.size < 200 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down if larger than MAX_DIMENSION
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
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
          QUALITY
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
 * Compress + resize an image, adding a semi-transparent watermark in the bottom-right.
 * Uses the same MAX_DIMENSION / QUALITY constants as compressImage.
 */
export async function compressImageWithWatermark(
  file: File,
  aliasName: string
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down if larger than MAX_DIMENSION
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
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
          QUALITY
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
  });
}
