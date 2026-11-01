/* Keep only this platform's koffi binaries in the packaged app (koffi ships builds for every OS). */
'use strict';
const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');
exports.default = async function afterPack(ctx) {
  const os = ctx.electronPlatformName; // 'darwin' | 'win32' | 'linux'
  const keepDirs = { darwin: ['darwin_x64', 'darwin_arm64'], win32: ['win32_x64', 'win32_arm64'], linux: ['linux_x64', 'linux_arm64'] }[os] || [];
  const resources = ctx.electronPlatformName === 'darwin'
    ? path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(ctx.appOutDir, 'resources');
  const dir = path.join(resources, 'app.asar.unpacked', 'node_modules', 'koffi', 'build', 'koffi');
  if (fs.existsSync(dir)) {
    for (const d of fs.readdirSync(dir)) {
      if (!keepDirs.includes(d)) fs.rmSync(path.join(dir, d), { recursive: true, force: true });
    }
  }
  // No Apple Developer ID: ad-hoc sign the whole bundle so Apple Silicon Macs will run it.
  // (Only possible when building on macOS, where codesign exists.)
  if (os === 'darwin' && process.platform === 'darwin') {
    const app = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`);
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
    execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
    console.log('  • ad-hoc signed ' + app);
  }
};
