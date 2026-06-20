const { contextBridge, ipcRenderer } = require('electron');

// Safe bridge exposure of desktop APIs to the React client
contextBridge.exposeInMainWorld('electronAPI', {
  scanHardware: () => ipcRenderer.invoke('scan-hardware'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  buildEfi: (config) => ipcRenderer.invoke('build-efi', config),
  onEfiBuildLog: (callback) => {
    const subscription = (event, value) => callback(value);
    ipcRenderer.on('efi-build-log', subscription);
    return () => {
      ipcRenderer.removeListener('efi-build-log', subscription);
    };
  },
  downloadRecovery: (params) => ipcRenderer.invoke('download-recovery', params),
  onDownloadLog: (callback) => {
    const subscription = (event, value) => callback(value);
    ipcRenderer.on('download-log', subscription);
    return () => {
      ipcRenderer.removeListener('download-log', subscription);
    };
  },
  onDownloadProgress: (callback) => {
    const subscription = (event, value) => callback(value);
    ipcRenderer.on('download-progress', subscription);
    return () => {
      ipcRenderer.removeListener('download-progress', subscription);
    };
  },
  previewPlist: (params) => ipcRenderer.invoke('preview-plist', params),
});
