import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import { generateOpenCorePlist } from './src/utils/plistGenerator.js';
import { fetchRecoveryUrls, downloadFile } from './src/utils/macrecovery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 720,
    title: "Dortania Hardware Checker & EFI Planner",
    backgroundColor: '#000000',
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setBackgroundColor('#000000');

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 1. IPC Handler: Scan Hardware
ipcMain.handle('scan-hardware', async () => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'detect_hardware.ps1');
    const cmd = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;
    
    exec(cmd, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Execution error: ${error}`);
        return reject({ error: true, message: error.message, stderr });
      }
      try {
        const cleanStdout = stdout.trim();
        const parsedData = JSON.parse(cleanStdout);
        resolve(parsedData);
      } catch (parseError) {
        console.error(`Parsing error: ${parseError}`);
        reject({ 
          error: true, 
          message: 'Failed to parse diagnostic data.', 
          raw: stdout,
          parseError: parseError.message 
        });
      }
    });
  });
});

// 2. IPC Handler: Select Folder Dialog
ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecciona la carpeta donde guardar la carpeta EFI',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// 3a. IPC Handler: Preview config.plist (no file write)
ipcMain.handle('preview-plist', async (event, { ssdts, kexts, bootArgs, cpuidSpoof, smbios, report }) => {
  try {
    const plistContent = generateOpenCorePlist(ssdts, kexts, bootArgs, cpuidSpoof, smbios, report);
    return { success: true, content: plistContent };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 3b. IPC Handler: Build EFI Structure & config.plist
ipcMain.handle('build-efi', async (event, { targetFolder, ssdts, kexts, bootArgs, cpuidSpoof, smbios, report }) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'build_efi.ps1');
    
    // Stringify JSON params for the PowerShell call
    const ssdtsJson = JSON.stringify(ssdts);
    const kextsJson = JSON.stringify(kexts);
    
    // Spawn powershell to capture stdout in real-time
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-TargetFolder', targetFolder,
      '-SsdtsJson', ssdtsJson,
      '-KextsJson', kextsJson
    ]);

    let logBuffer = '';

    const processData = (data) => {
      logBuffer += data.toString();
      const lines = logBuffer.split(/\r?\n/);
      
      // Process all complete lines except the last incomplete chunk
      logBuffer = lines.pop(); 
      
      lines.forEach(line => {
        if (line.trim()) {
          // Send log line back to frontend
          if (mainWindow) {
            mainWindow.webContents.send('efi-build-log', line);
          }
        }
      });
    };

    ps.stdout.on('data', processData);
    ps.stderr.on('data', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('efi-build-log', `[ERROR] [stderr] ${data.toString().trim()}`);
      }
    });

    ps.on('close', (code) => {
      // Process remaining buffer
      if (logBuffer.trim() && mainWindow) {
        mainWindow.webContents.send('efi-build-log', logBuffer);
      }

      if (code !== 0) {
        return reject({ error: true, message: `PowerShell script exited with code ${code}` });
      }

      // If PS completed successfully, write the config.plist
      try {
        if (mainWindow) {
          mainWindow.webContents.send('efi-build-log', '[system] [INFO] Generando archivo config.plist personalizado...');
        }
        
        const plistContent = generateOpenCorePlist(ssdts, kexts, bootArgs, cpuidSpoof, smbios, report);
        const plistPath = path.join(targetFolder, 'EFI', 'OC', 'config.plist');
        
        fs.writeFileSync(plistPath, plistContent, 'utf-8');
        
        if (mainWindow) {
          mainWindow.webContents.send('efi-build-log', '[success] [INFO] ¡Archivo config.plist generado correctamente!');
          mainWindow.webContents.send('efi-build-log', '[success] [INFO] Proceso de construcción de EFI completado.');
        }
        
        resolve({ success: true, targetPath: path.join(targetFolder, 'EFI') });
      } catch (writeErr) {
        console.error(writeErr);
        if (mainWindow) {
          mainWindow.webContents.send('efi-build-log', `[error] [INFO] Error escribiendo config.plist: ${writeErr.message}`);
        }
        reject({ error: true, message: `Failed to write config.plist: ${writeErr.message}` });
      }
    });
  });
});

// 4. IPC Handler: Download macOS Recovery Files
ipcMain.handle('download-recovery', async (event, { boardId, mlb, targetFolder }) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!mainWindow) return reject(new Error('Browser window not active.'));
      
      mainWindow.webContents.send('download-log', `[system] Consultando servidores de Apple para la placa ${boardId}...`);
      
      const info = await fetchRecoveryUrls(boardId, mlb);
      mainWindow.webContents.send('download-log', `[system] Encontrado: ${info.productName}`);
      mainWindow.webContents.send('download-log', `[system] URL DMG: ${info.dmgUrl}`);
      mainWindow.webContents.send('download-log', `[system] URL Chunklist: ${info.chunklistUrl}`);
      
      const recoveryFolder = path.join(targetFolder, 'com.apple.recovery.boot');
      if (!fs.existsSync(recoveryFolder)) {
        fs.mkdirSync(recoveryFolder, { recursive: true });
      }
      
      // 1. Descargar chunklist
      const chunklistPath = path.join(recoveryFolder, 'BaseSystem.chunklist');
      mainWindow.webContents.send('download-log', `[system] Descargando BaseSystem.chunklist...`);
      await downloadFile(info.chunklistUrl, info.chunklistToken, chunklistPath, (downloaded, total) => {
        const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
        mainWindow.webContents.send('download-progress', {
          file: 'BaseSystem.chunklist',
          downloaded,
          total,
          percent
        });
      });
      mainWindow.webContents.send('download-log', `[success] BaseSystem.chunklist descargado con éxito.`);
      
      // 2. Descargar DMG
      const dmgPath = path.join(recoveryFolder, 'BaseSystem.dmg');
      mainWindow.webContents.send('download-log', `[system] Descargando BaseSystem.dmg (~500-600MB)...`);
      await downloadFile(info.dmgUrl, info.dmgToken, dmgPath, (downloaded, total) => {
        const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
        mainWindow.webContents.send('download-progress', {
          file: 'BaseSystem.dmg',
          downloaded,
          total,
          percent
        });
      });
      mainWindow.webContents.send('download-log', `[success] BaseSystem.dmg descargado con éxito.`);
      mainWindow.webContents.send('download-log', `[success] Descarga completa. Los archivos se guardaron en: ${recoveryFolder}`);
      
      resolve({ success: true, path: recoveryFolder });
    } catch (err) {
      console.error(err);
      if (mainWindow) {
        mainWindow.webContents.send('download-log', `[error] Error de descarga: ${err.message}`);
      }
      reject(err);
    }
  });
});
