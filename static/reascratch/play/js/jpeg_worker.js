// ReaScratch Web — turns picture frames into small JPEGs off the main thread (several of these run side by side).
// crop = [x, y, w, h] of the source to keep as parts (0-1) of the frame (a tab's video area), or null for all of it
let cv = null, g = null;
self.onmessage = async (e) => {
  const { i, frame, w, h, q, crop } = e.data;
  try {
    if (!cv || cv.width !== w || cv.height !== h) { cv = new OffscreenCanvas(w, h); g = cv.getContext('2d'); }
    if (crop) {   // parts of the frame (a tab's crop), so a frame of another size is cut at the same place
      const fw = frame.displayWidth || frame.width, fh = frame.displayHeight || frame.height;
      g.drawImage(frame, crop[0] * fw, crop[1] * fh, crop[2] * fw, crop[3] * fh, 0, 0, w, h);
    }
    else g.drawImage(frame, 0, 0, w, h);
    frame.close();
    const blob = await cv.convertToBlob({ type: 'image/jpeg', quality: q });
    self.postMessage({ i, blob });
  } catch (err) { self.postMessage({ i, err: String(err && err.message || err) }); }   // (shown by ?diag=1)
};
