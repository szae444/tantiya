// Shrinks photos in the browser before upload. Phone photos are often 4000 px wide; the model
// only needs about 1000 px, so this saves upload time and AI time without any native library.
const MAX_SIDE = 1024;

export async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  // Already small JPEGs are sent untouched: re-encoding changes the pixels slightly, and the model
  // should see exactly the same image the evaluation measured.
  if (file.type === 'image/jpeg' && Math.max(bitmap.width, bitmap.height) <= MAX_SIDE) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
}

export const isImage = (f: File) => /^image\/(jpeg|png|webp|heic|heif)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);
