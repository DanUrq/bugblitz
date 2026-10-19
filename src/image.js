// Screenshots: any image a tester drops or pastes, made small enough to keep in the browser and to
// send to the server.

const MAX_SIDE = 1400;
const MAX_FILE = 20 * 1024 * 1024;

/** An image file as a JPEG data URL, scaled to fit MAX_SIDE, on white (a PNG's transparency would turn black). */
export function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('That isn’t an image.'));
    if (file.size > MAX_FILE) return reject(new Error('That image is over 20 MB.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const g = canvas.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image couldn’t be read.'));
    };
    img.src = url;
  });
}
