'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const on = (ch, cb) => ipcRenderer.on(ch, (e, ...a) => cb(...a));

contextBridge.exposeInMainWorld('kl', {
  isDesktop: true,
  platform: process.platform,
  // files + media
  openProject: () => ipcRenderer.invoke('file:open'),
  saveProject: (text, path, saveAs, name) => ipcRenderer.invoke('file:save', { text, path, saveAs, name }),
  saveText: (text, defaultName, filters) => ipcRenderer.invoke('file:saveText', { text, defaultName, filters }),
  autosave: text => ipcRenderer.invoke('file:autosave', text),
  loadAutosave: () => ipcRenderer.invoke('file:loadAutosave'),
  importMedia: kind => ipcRenderer.invoke('media:import', kind),
  storeDataUri: uri => ipcRenderer.invoke('media:storeData', uri),
  importGT: () => ipcRenderer.invoke('gt:import'),
  // DataLinq
  fetchText: url => ipcRenderer.invoke('dl:fetch', url),
  fetchBinary: url => ipcRenderer.invoke('dl:fetchBinary', url),
  pickDataFile: kind => ipcRenderer.invoke('dl:pickFile', kind),
  // program outputs
  output: msg => ipcRenderer.send('out:send', msg),
  outputTo: (id, msg) => ipcRenderer.send('out:sendTo', { id, msg }),
  onOutputHello: cb => on('out:hello', cb),
  onOutput: cb => on('out:msg', cb),
  outputReady: ch => ipcRenderer.send('out:ready', ch),
  ndiStart: opts => ipcRenderer.invoke('ndi:start', opts),
  ndiStop: id => ipcRenderer.invoke('ndi:stop', id),
  ndiStatus: () => ipcRenderer.invoke('ndi:status'),
  listDisplays: () => ipcRenderer.invoke('screen:list'),
  openScreen: (displayId, ch, mode) => ipcRenderer.invoke('screen:open', { displayId, ch, mode }),
  closeScreen: () => ipcRenderer.invoke('screen:close'),
  // RossTalk / HTTP control
  controlConfig: cfg => ipcRenderer.invoke('control:config', cfg),
  onControl: handler => ipcRenderer.on('control:cmd', async (e, { id, cmd }) => {
    let result;
    try { result = await handler(cmd); } catch (err) { result = { ok: false, error: err.message }; }
    ipcRenderer.send('control:reply', { id, result });
  }),
  onControlLog: cb => on('control:log', cb),
  // app
  onMenu: cb => on('menu', cb),
  setTitle: t => ipcRenderer.send('win:title', t),
  onBeforeClose: cb => on('app:beforeClose', () => { ipcRenderer.send('app:closeAck'); cb(); }),
  closeNow: () => ipcRenderer.send('app:closeNow')
});
