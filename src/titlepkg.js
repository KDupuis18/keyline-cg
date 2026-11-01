/* Reads vMix title packages (.gtzip zip, or loose .gtxml/.xaml with images beside it). */
'use strict';
const fs = require('fs');
const path = require('path');

const IMG_EXT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
async function readTitlePackage(file) {
  const name = path.basename(file).replace(/\.[^.]+$/, '');
  const buf = fs.readFileSync(file);
  const entries = [];
  if (buf[0] === 0x50 && buf[1] === 0x4b) { // zip (.gtzip)
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(buf);
    for (const [p, f] of Object.entries(zip.files)) {
      if (f.dir) continue;
      const ext = path.extname(p).toLowerCase();
      if (IMG_EXT[ext]) entries.push({ path: p, dataUri: `data:${IMG_EXT[ext]};base64,` + (await f.async('base64')) });
      else if (/\.(gtxml|xaml|xml|json|txt)$/i.test(p)) entries.push({ path: p, text: await f.async('string') });
    }
  } else {
    entries.push({ path: path.basename(file), text: buf.toString('utf8') });
    // loose XAML titles reference images next to the file
    const dir = path.dirname(file);
    try {
      for (const f of fs.readdirSync(dir)) {
        const ext = path.extname(f).toLowerCase();
        if (IMG_EXT[ext] && fs.statSync(path.join(dir, f)).size < 15e6) entries.push({ path: f, dataUri: `data:${IMG_EXT[ext]};base64,` + fs.readFileSync(path.join(dir, f)).toString('base64') });
      }
    } catch (e) { /* folder not readable */ }
  }
  return { name, file, entries };
}

module.exports = { readTitlePackage };
