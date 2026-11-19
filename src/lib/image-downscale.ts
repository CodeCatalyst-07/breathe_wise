/**
 * Resizes an image file to a maximum dimension of 1024px via an in-memory canvas.
 * Returns base64 payload and mime type.
 */
export async function downscaleImage(
  file: File,
): Promise<{ base64: string; mimeType: "image/jpeg" | "image/png" | "image/webp" }> {
  const mimeType: "image/jpeg" | "image/png" | "image/webp" =
    file.type === "image/png" ? "image/png" : "image/jpeg";

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1024;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL(mimeType, 0.85);
      const base64 = dataUrl.split(",")[1] ?? "";
      resolve({ base64, mimeType });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image file"));
    };
    img.src = url;
  });
}
