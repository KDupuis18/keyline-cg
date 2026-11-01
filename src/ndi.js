/* NDI sender over FFI (koffi). Requires the free NDI Runtime (installed with NDI Tools) on the machine.
   No native compile step: koffi ships prebuilt for Windows x64/arm64 and macOS x64/arm64. */
'use strict';
const fs = require('fs');
const path = require('path');

const FOURCC_BGRA = 0x41524742; // 'B','G','R','A'
const FORMAT_PROGRESSIVE = 1;
const TIMECODE_SYNTH = 9223372036854775807n; // INT64_MAX: let NDI synthesize timecode

function candidates(override) {
  const list = [];
  if (override) list.push(override);
  if (process.env.KEYLINE_NDI_LIB) list.push(process.env.KEYLINE_NDI_LIB);
  if (process.platform === 'win32') {
    const dll = process.arch === 'arm64' ? 'Processing.NDI.Lib.arm64.dll' : 'Processing.NDI.Lib.x64.dll';
    for (const v of ['NDI_RUNTIME_DIR_V6', 'NDI_RUNTIME_DIR_V5', 'NDI_RUNTIME_DIR_V4']) if (process.env[v]) list.push(path.join(process.env[v], dll));
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    list.push(path.join(pf, 'NDI', 'NDI 6 Runtime', 'v6', dll), path.join(pf, 'NDI', 'NDI 5 Runtime', 'v5', dll), path.join(pf, 'NDI', 'NDI 6 Tools', 'Runtime', dll), path.join(pf, 'NDI', 'NDI 5 Tools', 'Runtime', dll), dll);
  } else if (process.platform === 'darwin') {
    list.push('/usr/local/lib/libndi.dylib', '/Library/NDI SDK for Apple/lib/macOS/libndi.dylib', '/Library/NDI 6 SDK/lib/macOS/libndi.dylib', '/Applications/NDI Video Monitor.app/Contents/Frameworks/libndi.dylib', 'libndi.dylib');
  } else {
    list.push('libndi.so.6', 'libndi.so.5', '/usr/lib/libndi.so', '/usr/local/lib/libndi.so', 'libndi.so');
  }
  return list;
}

class NdiSender {
  constructor(libOverride) {
    const koffi = require('koffi');
    let lib = null, used = null, errors = [];
    for (const p of candidates(libOverride)) {
      if (path.isAbsolute(p) && !fs.existsSync(p)) continue;
      try { lib = koffi.load(p); used = p; break; } catch (e) { errors.push(p + ': ' + e.message); }
    }
    if (!lib) {
      const hint = process.platform === 'darwin'
        ? 'Install NDI Tools for Mac (it includes the NDI runtime at /usr/local/lib/libndi.dylib), or set the library path in Output settings.'
        : 'Install NDI Tools (it includes the NDI 6 Runtime), or set the library path in Output settings.';
      throw new Error('NDI runtime not found. ' + hint);
    }
    this.libPath = used;
    // koffi type registry is global; only declare the structs once per process
    if (!NdiSender._types) {
      NdiSender._types = {
        create: koffi.struct('NDIlib_send_create_t', { p_ndi_name: 'const char *', p_groups: 'const char *', clock_video: 'bool', clock_audio: 'bool' }),
        video: koffi.struct('NDIlib_video_frame_v2_t', {
          xres: 'int', yres: 'int', FourCC: 'int', frame_rate_N: 'int', frame_rate_D: 'int',
          picture_aspect_ratio: 'float', frame_format_type: 'int', timecode: 'int64_t',
          p_data: 'uint8_t *', line_stride_in_bytes: 'int', p_metadata: 'const char *', timestamp: 'int64_t'
        })
      };
    }
    this.fn = {
      initialize: lib.func('bool NDIlib_initialize()'),
      create: lib.func('void *NDIlib_send_create(const NDIlib_send_create_t *p_create_settings)'),
      sendVideo: lib.func('void NDIlib_send_send_video_v2(void *p_instance, const NDIlib_video_frame_v2_t *p_video_data)'),
      destroy: lib.func('void NDIlib_send_destroy(void *p_instance)'),
      connections: lib.func('int NDIlib_send_get_no_connections(void *p_instance, uint32_t timeout_in_ms)')
    };
    this.inst = null;
  }
  start(name, groups) {
    if (!this.fn.initialize()) throw new Error('NDI could not initialize. This CPU may be unsupported, or the NDI runtime install is damaged.');
    this.inst = this.fn.create({ p_ndi_name: name || 'Keyline CG', p_groups: groups || null, clock_video: false, clock_audio: false });
    if (!this.inst) throw new Error('NDI could not create the sender "' + name + '". Another source may already use that name.');
  }
  sendFrame(buf, w, h, fpsN, fpsD) {
    if (!this.inst) return;
    this.fn.sendVideo(this.inst, {
      xres: w, yres: h, FourCC: FOURCC_BGRA, frame_rate_N: fpsN, frame_rate_D: fpsD,
      picture_aspect_ratio: w / h, frame_format_type: FORMAT_PROGRESSIVE, timecode: TIMECODE_SYNTH,
      p_data: buf, line_stride_in_bytes: w * 4, p_metadata: null, timestamp: 0n
    });
  }
  connections() { return this.inst ? this.fn.connections(this.inst, 0) : 0; }
  stop() { if (this.inst) { try { this.fn.destroy(this.inst); } catch (e) { /* ignore */ } this.inst = null; } }
}

/* Chromium hands us premultiplied BGRA; NDI expects straight alpha for clean key edges. */
function unpremultiply(buf) {
  for (let i = 0, n = buf.length; i < n; i += 4) {
    const a = buf[i + 3];
    if (a === 0 || a === 255) continue;
    const k = 255 / a;
    buf[i] = Math.min(255, buf[i] * k + 0.5);
    buf[i + 1] = Math.min(255, buf[i + 1] * k + 0.5);
    buf[i + 2] = Math.min(255, buf[i + 2] * k + 0.5);
  }
  return buf;
}

/* Fit a BGRA frame into the output raster: exact 2x (Retina) frames are box-downsampled, anything else is cropped/padded. */
function fitFrame(src, sw, sh, tw, th) {
  const out = Buffer.alloc(tw * th * 4);
  if (sw === tw * 2 && sh === th * 2) {
    for (let y = 0; y < th; y++) {
      const r0 = (y * 2) * sw * 4, r1 = r0 + sw * 4, o = y * tw * 4;
      for (let x = 0; x < tw; x++) {
        const a = r0 + x * 8, b = r1 + x * 8, d = o + x * 4;
        for (let c = 0; c < 4; c++) out[d + c] = (src[a + c] + src[a + 4 + c] + src[b + c] + src[b + 4 + c] + 2) >> 2;
      }
    }
    return out;
  }
  const cw = Math.min(sw, tw) * 4, ch = Math.min(sh, th);
  for (let y = 0; y < ch; y++) src.copy(out, y * tw * 4, y * sw * 4, y * sw * 4 + cw);
  return out;
}

const FRAME_RATES = { '23.98': [24000, 1001], '24': [24, 1], '25': [25, 1], '29.97': [30000, 1001], '30': [30, 1], '50': [50, 1], '59.94': [60000, 1001], '60': [60, 1] };

module.exports = { NdiSender, unpremultiply, fitFrame, FRAME_RATES, candidates };
