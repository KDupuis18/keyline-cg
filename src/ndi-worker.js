/* One NDI sender per worker thread: frame fitting, alpha un-premultiply and the native send
   all happen here, so the app's main process (UI, IPC, RossTalk) never stalls on 8 MB frames. */
'use strict';
const { parentPort, workerData } = require('worker_threads');
const { NdiSender, unpremultiply, fitFrame } = require('./ndi');

const { libPath, name, fpsN, fpsD, width, height, unpremul } = workerData;
let sender = null, latest = null, frames = 0, timer = null;

try {
  sender = new NdiSender(libPath || null);
  sender.start(name);
  parentPort.postMessage({ type: 'started', lib: sender.libPath });
} catch (e) {
  parentPort.postMessage({ type: 'error', error: e.message });
}

parentPort.on('message', m => {
  if (m.type === 'frame') {
    let buf = Buffer.from(m.buf);
    if (buf.length !== m.w * m.h * 4) return;
    if (m.w !== width || m.h !== height) buf = fitFrame(buf, m.w, m.h, width, height);
    if (unpremul) unpremultiply(buf);
    latest = buf;
  } else if (m.type === 'status') {
    parentPort.postMessage({ type: 'status', frames, connections: sender ? safe(() => sender.connections(), 0) : 0 });
  } else if (m.type === 'stop') {
    clearInterval(timer);
    if (sender) sender.stop();
    parentPort.postMessage({ type: 'stopped' });
    process.exit(0);
  }
});
const safe = (f, d) => { try { return f(); } catch (e) { return d; } };

if (sender) {
  timer = setInterval(() => {
    if (!latest || latest.length !== width * height * 4) return; // never hand the native library a short buffer
    try { sender.sendFrame(latest, width, height, fpsN, fpsD); frames++; } catch (e) { /* keep running */ }
  }, 1000 * fpsD / fpsN);
}
