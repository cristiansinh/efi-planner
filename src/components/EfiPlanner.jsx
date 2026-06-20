import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  File, 
  Copy, 
  Check, 
  FolderOpen, 
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Download,
  MapPin,
  Info,
  Eye,
  Code2,
  RefreshCw
} from 'lucide-react';
import { generateSmbios } from '../utils/smbiosGenerator.js';

// Default template report displayed as fallback/demo if no scan is loaded yet
const defaultReport = {
  cpu: {
    status: 'config',
    name: 'Intel(R) Core(TM) i7-13700K CPU @ 3.40GHz',
    notes: 'Intel 12th/13th/14th Gen (Alder Lake/Raptor Lake) requires CPUID Spoofing (spoofing as Comet Lake) because macOS lacks native support for hybrid architectures. Note that Alder/Raptor Lake integrated Xe graphics are completely incompatible; a dedicated AMD GPU is mandatory.',
    arch: 'Intel Core',
    cpuidSpoof: {
      data: '55060A00 00000000 00000000 00000000',
      mask: 'FFFFFFFF 00000000 00000000 00000000',
      model: 'Comet Lake (0x0A0655)'
    }
  },
  gpus: [
    {
      name: 'AMD Radeon RX 6600 XT',
      vendorId: '1002',
      deviceId: '73FF',
      status: 'native',
      notes: 'Natively supported since macOS Monterey 12.1. Extremely compatible and recommended. Requires boot-arg: agdpmod=pikera.'
    }
  ],
  storage: [
    {
      model: 'Samsung SSD 980 PRO 1TB',
      mediaType: 'SSD',
      size: 931.51,
      status: 'native',
      notes: 'Generic SSD detected. Generally compatible. Injecting NVMeFix.kext is recommended to stabilize power states and sleep cycles.'
    }
  ],
  network: [
    {
      name: 'Wi-Fi',
      desc: 'Intel(R) Wi-Fi 6E AX211 160MHz',
      type: 'Wi-Fi',
      vendorId: '8086',
      deviceId: '51F0',
      status: 'config',
      notes: 'Intel Wireless chipset detected. Supported using the OpenIntelWireless community drivers. Requires AirportItlwm.kext.'
    }
  ],
  ssdts: [
    {
      name: 'SSDT-PLUG-ALT.aml',
      desc: 'Enables proper CPU power management/scheduling for Intel hybrid core architectures (Alder/Raptor Lake).',
      required: true
    },
    {
      name: 'SSDT-AWAC.aml',
      desc: 'Fixes system RTC clock conflict (disables AWAC and enables legacy RTC). Required for Intel 300 series chipsets and newer.',
      required: true
    },
    {
      name: 'SSDT-EC-USBX.aml',
      desc: 'Creates a fake Embedded Controller (EC) and injections USB power properties for correct USB charging/mapping.',
      required: true
    }
  ],
  kexts: [
    'Lilu.kext',
    'VirtualSMC.kext',
    'WhateverGreen.kext',
    'NVMeFix.kext',
    'AirportItlwm.kext',
    'IntelBluetoothFirmware.kext',
    'IntelBTPatcher.kext',
    'BlueToolFixup.kext'
  ],
  bootArgs: ['-v', 'keepsyms=1', 'debug=0x100', 'agdpmod=pikera', 'alcid=1'],
  overallStatus: 'config'
};

// Recovery versions map
const recoveryVersions = [
  { name: 'macOS 15 Sequoia', boardId: 'Mac-7BA5B2D9E42DDD94', mlb: '00000000000000000' },
  { name: 'macOS 14 Sonoma', boardId: 'Mac-827FAC58A8FDFA22', mlb: '00000000000000000' },
  { name: 'macOS 13 Ventura', boardId: 'Mac-B4831CEBD52A0C4C', mlb: '00000000000000000' },
  { name: 'macOS 12 Monterey', boardId: 'Mac-E43C1C25D4880AD6', mlb: '00000000000000000' },
  { name: 'macOS 11 Big Sur', boardId: 'Mac-2BD1B31983FE1663', mlb: '00000000000000000' },
  { name: 'macOS 10.15 Catalina', boardId: 'Mac-00BE6ED71E35EB86', mlb: '00000000000000000' },
  { name: 'macOS 10.14 Mojave', boardId: 'Mac-7BA5B2DFE22DDD8C', mlb: '00000000000KXPG00' },
  { name: 'macOS 10.13 High Sierra', boardId: 'Mac-7BA5B2D9E42DDD94', mlb: '00000000000J80300' }
];

function EfiPlanner({ 
  report, 
  status,
  // Lifted state from App.jsx (persists on tab change)
  buildFolder, setBuildFolder,
  buildStatus, setBuildStatus,
  buildLogs, setBuildLogs,
  downloadStatus, setDownloadStatus,
  downloadLogs, setDownloadLogs,
  downloadProgress, setDownloadProgress,
  selectedRecoveryVer, setSelectedRecoveryVer,
}) {
  const [plistPreview, setPlistPreview] = useState('');
  const [showPlistPreview, setShowPlistPreview] = useState(false);
  const [plistPreviewLoading, setPlistPreviewLoading] = useState(false);
  const [copiedPlist, setCopiedPlist] = useState(false);
  const activeReport = report || defaultReport;

  const [selectedSsdts, setSelectedSsdts] = useState({});
  const [selectedKexts, setSelectedKexts] = useState({});
  const [copiedBootArgs, setCopiedBootArgs] = useState(false);
  const [copiedCpuidData, setCopiedCpuidData] = useState(false);
  const [copiedCpuidMask, setCopiedCpuidMask] = useState(false);

  // SMBIOS Generator State
  const [smbiosModel, setSmbiosModel] = useState('iMacPro1,1');
  const [smbios, setSmbios] = useState({
    model: 'iMacPro1,1',
    serial: 'F5KZ50ZEZ512',
    mlb: 'F5K931609QXFHDD1F',
    uuid: '773E92B1-4A59-4509-B2FE-41CE9297298B'
  });
  const [copiedSerial, setCopiedSerial] = useState(false);
  const [copiedMlb, setCopiedMlb] = useState(false);
  const [copiedUuid, setCopiedUuid] = useState(false);

  const buildConsoleEndRef = useRef(null);
  const downloadConsoleEndRef = useRef(null);

  // Sync state with analyzed report & auto-recommend SMBIOS model
  useEffect(() => {
    const ssdtsMap = {};
    activeReport.ssdts.forEach(s => { ssdtsMap[s.name] = true; });
    setSelectedSsdts(ssdtsMap);

    const kextsMap = {};
    activeReport.kexts.forEach(k => { kextsMap[k] = true; });
    setSelectedKexts(kextsMap);

    // Auto-recommend model based on CPU/GPU
    if (activeReport.cpu) {
      const cpuName = activeReport.cpu.name || '';
      const isAmd = cpuName.toLowerCase().includes('amd') || cpuName.toLowerCase().includes('ryzen');
      
      let recommended = 'iMacPro1,1';
      if (isAmd) {
        recommended = 'iMacPro1,1';
      } else if (cpuName.includes('i7-13') || cpuName.includes('i9-13') || cpuName.includes('i7-12') || cpuName.includes('i7-14') || cpuName.includes('Raptor') || cpuName.includes('Alder')) {
        recommended = 'iMacPro1,1'; 
      } else if (cpuName.includes('i5-10') || cpuName.includes('i7-10') || cpuName.includes('i9-10')) {
        recommended = 'iMac20,1';
      } else if (cpuName.includes('i5-8') || cpuName.includes('i7-8') || cpuName.includes('i5-9') || cpuName.includes('i7-9')) {
        recommended = 'iMac19,1';
      }
      
      setSmbiosModel(recommended);
      setSmbios(generateSmbios(recommended));
    }
  }, [report]);

  // Auto-scroll consoles
  useEffect(() => {
    if (buildConsoleEndRef.current) {
      buildConsoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [buildLogs]);

  useEffect(() => {
    if (downloadConsoleEndRef.current) {
      downloadConsoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [downloadLogs]);

  const handleSsdtToggle = (name) => {
    setSelectedSsdts(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleKextToggle = (name) => {
    setSelectedKexts(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleCopyText = (text, setCopiedState) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  // Directory Picker
  const handleSelectFolder = async () => {
    if (window.electronAPI && typeof window.electronAPI.selectFolder === 'function') {
      const folder = await window.electronAPI.selectFolder();
      if (folder) setBuildFolder(folder);
    } else {
      setBuildFolder('C:\\Users\\Dortania\\Desktop\\Hackintosh-EFI');
    }
  };

  // Generate plist preview (without writing to disk)
  const handlePreviewPlist = async () => {
    setPlistPreviewLoading(true);
    setShowPlistPreview(true);

    const activeSsdts = Object.keys(selectedSsdts).filter(name => selectedSsdts[name]);
    const activeKexts = Object.keys(selectedKexts).filter(name => selectedKexts[name]);
    const bootArgsStr = activeReport.bootArgs.join(' ');

    if (window.electronAPI && typeof window.electronAPI.previewPlist === 'function') {
      try {
        const result = await window.electronAPI.previewPlist({
          ssdts: activeSsdts,
          kexts: activeKexts,
          bootArgs: bootArgsStr,
          cpuidSpoof: activeReport.cpu.cpuidSpoof,
          smbios: smbios,
          report: activeReport
        });
        if (result.success) {
          setPlistPreview(result.content);
        } else {
          setPlistPreview(`<!-- Error generando preview: ${result.error} -->`);
        }
      } catch (err) {
        setPlistPreview(`<!-- Error: ${err.message} -->`);
      }
    } else {
      // Browser demo — generate a short representative snippet
      const preview = generateBrowserPlistPreview(activeSsdts, activeKexts, bootArgsStr, activeReport, smbios);
      setPlistPreview(preview);
    }
    setPlistPreviewLoading(false);
  };

  // Browser-mode plist preview (abbreviated)
  const generateBrowserPlistPreview = (ssdts, kexts, bootArgs, rep, smbiosData) => {
    const cpuArch = (rep.cpu && (rep.cpu.name || '').toLowerCase().includes('amd')) ? 'AMD' : 'Intel';
    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- config.plist — Dortania Planner Preview -->
<!-- CPU Architecture: ${cpuArch} -->
<!-- SMBIOS: ${smbiosData.model} | Serial: ${smbiosData.serial} -->
<plist version="1.0">
<dict>
  <key>ACPI</key>
  <dict>
    <key>Add</key>
    <array>
${ssdts.map(s => `      <!-- ${s} -->`).join('\n')}
    </array>
  </dict>
  <key>Kernel</key>
  <dict>
    <key>Add</key>
    <array>
${kexts.map(k => `      <!-- ${k} -->`).join('\n')}
    </array>
    <key>Quirks</key>
    <dict>
      <!-- AppleXcpmCfgLock: ${cpuArch === 'Intel' ? 'true' : 'false'} -->
      <!-- ProvideCurrentCpuInfo: ${cpuArch === 'Intel' ? 'true' : 'false'} -->
      <!-- DisableIoMapper: true -->
    </dict>
  </dict>
  <key>NVRAM</key>
  <dict>
    <key>Add</key>
    <dict>
      <key>boot-args</key>
      <string>${bootArgs}</string>
    </dict>
  </dict>
  <key>PlatformInfo</key>
  <dict>
    <key>Generic</key>
    <dict>
      <key>SystemProductName</key><string>${smbiosData.model}</string>
      <key>SystemSerialNumber</key><string>${smbiosData.serial}</string>
      <key>MLB</key><string>${smbiosData.mlb}</string>
      <key>SystemUUID</key><string>${smbiosData.uuid}</string>
    </dict>
  </dict>
</dict>
</plist>`;
  };

  // Parser for raw powershell log line formats: `[type] [time] message`
  const parseLogLine = (logLine) => {
    const match = logLine.match(/^\[(system|success|warning|error|default)\]\s+\[(.*?)\]\s+(.*)/i);
    if (match) {
      return {
        type: match[1].toLowerCase(),
        time: match[2],
        text: match[3]
      };
    }
    if (logLine.includes('[ERROR]') || logLine.toLowerCase().includes('error')) {
      return { type: 'error', time: new Date().toLocaleTimeString(), text: logLine };
    }
    if (logLine.includes('[WARNING]') || logLine.toLowerCase().includes('warning')) {
      return { type: 'warning', time: new Date().toLocaleTimeString(), text: logLine };
    }
    return { type: 'default', time: '', text: logLine };
  };

  // Perform EFI Compilation & Asset downloads
  const handleBuildEfi = async () => {
    if (!buildFolder) return;
    setBuildStatus('building');
    setBuildLogs([]);

    const activeSsdts = Object.keys(selectedSsdts).filter(name => selectedSsdts[name]);
    const activeKexts = Object.keys(selectedKexts).filter(name => selectedKexts[name]);
    const bootArgsString = activeReport.bootArgs.join(' ');

    const addLog = (rawLine) => {
      const parsed = parseLogLine(rawLine);
      setBuildLogs(prev => [...prev, parsed]);
    };

    if (window.electronAPI && typeof window.electronAPI.buildEfi === 'function') {
      const unsubscribe = window.electronAPI.onEfiBuildLog((line) => {
        addLog(line);
      });

      try {
        const result = await window.electronAPI.buildEfi({
          targetFolder: buildFolder,
          ssdts: activeSsdts,
          kexts: activeKexts,
          bootArgs: bootArgsString,
          cpuidSpoof: activeReport.cpu.cpuidSpoof,
          smbios: smbios,
          report: activeReport
        });

        if (result.success) {
          setBuildStatus('success');
        } else {
          setBuildStatus('error');
          addLog('[error] [00:00:00] Proceso finalizado con errores.');
        }
      } catch (err) {
        setBuildStatus('error');
        addLog(`[error] [00:00:00] ERROR CRÍTICO: ${err.message || err}`);
      } finally {
        unsubscribe();
      }
    } else {
      // Simulated Browser Demo Mode
      addLog('[system] [00:00:00] Iniciando generación de EFI en modo SIMULACIÓN de navegador...');
      
      const simulateSteps = [
        () => addLog('[default] [00:00:01] Creando jerarquía de carpetas: EFI/BOOT y EFI/OC...'),
        () => addLog('[default] [00:00:02] Descargando binarios bases de OpenCore v1.0.3Pkg...'),
        () => addLog('[success] [00:00:03] Copiado BOOTx64.efi, OpenCore.efi, OpenRuntime.efi y OpenCanopy.efi.'),
        () => addLog('[default] [00:00:04] Descargando controlador de archivos HfsPlus.efi...'),
        () => addLog('[success] [00:00:04] HfsPlus.efi instalado.'),
        ...activeSsdts.map((s) => () => addLog(`[default] [00:00:05] Descargando tabla ACPI: ${s} desde repositorio Dortania...`)),
        ...activeSsdts.map((s) => () => addLog(`[success] [00:00:05] Tabla ${s} compilada y guardada en ACPI/.`)),
        ...activeKexts.map((k) => () => {
          addLog(`[default] [00:00:06] Descargando bundle Kext: ${k} desde Github...`);
          setTimeout(() => addLog(`[success] [00:00:06] Extrayendo e instalando ${k} en Kexts/.`), 300);
        }),
        () => addLog('[default] [00:00:08] Ensamblando archivo config.plist XML con los SSDTs y Kexts cargados...'),
        () => addLog('[success] [00:00:09] Convertidos valores hexadecimales de CPUID a base64.'),
        () => addLog('[success] [00:00:09] Inyectadas variables NVRAM boot-args de arranque.'),
        () => addLog('[success] [00:00:10] ¡Archivo config.plist generado y validado con éxito!'),
        () => {
          addLog('[system] [00:00:10] BUILD_COMPLETE_SUCCESS');
          setBuildStatus('success');
        }
      ];

      let delay = 0;
      simulateSteps.forEach((step) => {
        setTimeout(step, delay);
        delay += 600;
      });
    }
  };

  // Perform macOS Recovery Download
  const handleDownloadRecovery = async () => {
    if (!buildFolder) return;

    const matched = recoveryVersions.find(v => v.name === selectedRecoveryVer);
    if (!matched) return;

    setDownloadStatus('downloading');
    setDownloadLogs([]);
    setDownloadProgress({ file: '', percent: 0, downloaded: 0, total: 0 });

    const addLog = (rawLine) => {
      const parsed = parseLogLine(rawLine);
      setDownloadLogs(prev => [...prev, parsed]);
    };

    if (window.electronAPI && typeof window.electronAPI.downloadRecovery === 'function') {
      const unsubscribeLog = window.electronAPI.onDownloadLog((line) => {
        addLog(line);
      });

      const unsubscribeProgress = window.electronAPI.onDownloadProgress((prog) => {
        setDownloadProgress(prog);
      });

      try {
        const result = await window.electronAPI.downloadRecovery({
          boardId: matched.boardId,
          mlb: matched.mlb,
          targetFolder: buildFolder
        });

        if (result.success) {
          setDownloadStatus('success');
        } else {
          setDownloadStatus('error');
          addLog('[error] Falló la descarga del Recovery.');
        }
      } catch (err) {
        setDownloadStatus('error');
        addLog(`[error] ERROR DE DESCARGA: ${err.message || err}`);
      } finally {
        unsubscribeLog();
        unsubscribeProgress();
      }
    } else {
      // Simulated browser download
      addLog(`[system] Descargando recovery simulado de ${selectedRecoveryVer}...`);
      addLog('[default] Consultando servidores de Apple...');
      
      setTimeout(() => {
        addLog('[system] Encontrada imagen de recuperación.');
        addLog('[default] Descargando BaseSystem.chunklist (3.1 KB)...');
      }, 500);

      setTimeout(() => {
        addLog('[success] BaseSystem.chunklist descargado con éxito.');
        addLog('[default] Descargando BaseSystem.dmg (640.2 MB)...');
      }, 1000);

      let pct = 0;
      const interval = setInterval(() => {
        pct += 10;
        setDownloadProgress({
          file: 'BaseSystem.dmg',
          percent: pct,
          downloaded: Math.round(pct * 6.4 * 1024 * 1024),
          total: 640.2 * 1024 * 1024
        });
        
        if (pct >= 100) {
          clearInterval(interval);
          addLog('[success] BaseSystem.dmg descargado con éxito.');
          addLog('[success] Descarga simulada completada.');
          setDownloadStatus('success');
        }
      }, 300);
    }
  };

  const activeSsdts = Object.keys(selectedSsdts).filter(name => selectedSsdts[name]);
  const activeKexts = Object.keys(selectedKexts).filter(name => selectedKexts[name]);
  const bootArgsString = activeReport.bootArgs.join(' ');

  // Derived: destination path strings
  const efiFolderPath = buildFolder ? `${buildFolder}\\EFI` : null;
  const recoveryFolderPath = buildFolder ? `${buildFolder}\\com.apple.recovery.boot` : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* ── WARNING BANNER IF DIAGNOSTIC SCANS ARE NOT LOADED ──────────── */}
      {(!report || status !== 'completed') && (
        <div className="warning-box" style={{ border: '1px solid var(--status-config-border)', padding: '16px' }}>
          <ShieldAlert className="alert-icon" style={{ color: 'var(--status-config-text)' }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--status-config-text)' }}>Modo de Plantilla Activo</strong>
            No se ha cargado ningún diagnóstico de hardware aún. Se muestra una plantilla genérica para una PC moderna (Intel 13th Gen & RX 6600 XT). Para crear una EFI adaptada a tu hardware real, realiza el escaneo en el <strong>Dashboard</strong>.
          </div>
        </div>
      )}

      {/* ── STEP 1: CHOOSE OUTPUT FOLDER ──────────────────────────────────── */}
      <div className="card" style={{ border: '1px solid var(--accent-purple)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div className="step-badge">1</div>
          <h2 className="card-title" style={{ margin: 0 }}>
            <FolderOpen style={{ color: 'var(--accent-purple)' }} />
            Elegir Carpeta de Destino
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', paddingLeft: '36px' }}>
          Selecciona la carpeta donde se guardarán la estructura EFI y el Recovery de macOS. Esta carpeta se usará en todos los pasos siguientes.
        </p>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              RUTA DE DESTINO
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className="search-input" 
                style={{ padding: '8px 12px', fontSize: '13px', backgroundColor: '#020202', cursor: 'default' }}
                value={buildFolder} 
                placeholder="Haz clic en Examinar para elegir carpeta..." 
                readOnly
              />
              <button 
                className="copy-btn" 
                style={{ padding: '0 16px', whiteSpace: 'nowrap' }} 
                onClick={handleSelectFolder}
                disabled={buildStatus === 'building'}
              >
                Examinar...
              </button>
            </div>
          </div>
        </div>

        {/* Destination preview boxes */}
        {buildFolder && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="destination-preview">
              <MapPin style={{ width: '13px', height: '13px', color: 'var(--accent-purple)', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>EFI se guardará en:</span>
                <code style={{ display: 'block', fontSize: '12px', color: 'var(--text-primary)', marginTop: '2px' }}>{efiFolderPath}</code>
              </div>
            </div>
            <div className="destination-preview">
              <MapPin style={{ width: '13px', height: '13px', color: 'var(--accent-cyan)', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>Recovery se guardará en:</span>
                <code style={{ display: 'block', fontSize: '12px', color: 'var(--text-primary)', marginTop: '2px' }}>{recoveryFolderPath}</code>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── STEP 2: SMBIOS GENERATOR ──────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div className="step-badge">2</div>
          <h2 className="card-title" style={{ margin: 0 }}>
            <FolderOpen style={{ color: 'var(--accent-cyan)' }} />
            Generar SMBIOS (Identidad de Mac)
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', paddingLeft: '36px' }}>
          Genera números de serie válidos y únicos para habilitar los servicios de Apple (iMessage, iCloud) en tu Hackintosh.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              MODELO DE MAC RECOMENDADO
            </span>
            <select 
              value={smbiosModel}
              onChange={(e) => {
                const model = e.target.value;
                setSmbiosModel(model);
                setSmbios(generateSmbios(model));
              }}
              className="search-input"
              style={{ backgroundColor: '#020202', padding: '8px 12px', fontSize: '13px', border: '1px solid var(--border)', width: '100%', color: 'var(--text-primary)' }}
            >
              <option value="iMacPro1,1">iMacPro1,1 (Intel Gen 10+ / AMD Ryzen)</option>
              <option value="MacPro7,1">MacPro7,1 (PC de Escritorio HEDT)</option>
              <option value="iMac20,1">iMac20,1 (Intel Core Gen 10 c/ dGPU)</option>
              <option value="iMac20,2">iMac20,2 (Intel Core Gen 10 c/ Radeon)</option>
              <option value="iMac19,1">iMac19,1 (Intel Core Gen 8/9 c/ dGPU)</option>
              <option value="iMac19,2">iMac19,2 (Intel Core Gen 8/9 H H370)</option>
              <option value="Macmini8,1">Macmini8,1 (Intel Core Gen 8 H c/ iGPU)</option>
              <option value="MacBookPro16,1">MacBookPro16,1 (Laptop Intel Gen 9)</option>
              <option value="MacBookPro15,2">MacBookPro15,2 (Laptop Intel Gen 8)</option>
              <option value="MacBookPro15,1">MacBookPro15,1 (Laptop Intel Gen 8 H)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button 
              className="copy-btn" 
              style={{ padding: '10px 16px', width: '100%', whiteSpace: 'nowrap' }} 
              onClick={() => setSmbios(generateSmbios(smbiosModel))}
            >
              Generar Nuevos Seriales
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
              NÚMERO DE SERIE (SystemSerialNumber)
            </span>
            <div className="copy-box" style={{ padding: '8px 12px' }}>
              <span className="copy-text" style={{ fontFamily: 'monospace' }}>{smbios.serial}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="copy-btn" style={{ padding: '4px 8px' }} onClick={() => handleCopyText(smbios.serial, setCopiedSerial)}>
                  {copiedSerial ? <Check style={{ width: '12px', height: '12px' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                  {copiedSerial ? 'OK' : 'Copiar'}
                </button>
                <a 
                  href={`https://checkcoverage.apple.com/?sn=${smbios.serial}`}
                  target="_blank" 
                  rel="noreferrer"
                  className="copy-btn"
                  style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'var(--text-primary)' }}
                >
                  <ExternalLink style={{ width: '12px', height: '12px' }} /> Probar
                </a>
              </div>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              * Haz clic en "Probar" para verificar si el número de serie ya está en uso. Debe decir "We're unable to check coverage...".
            </span>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
              SERIAL DE PLACA (MLB)
            </span>
            <div className="copy-box" style={{ padding: '8px 12px' }}>
              <span className="copy-text" style={{ fontFamily: 'monospace' }}>{smbios.mlb}</span>
              <button className="copy-btn" style={{ padding: '4px 8px' }} onClick={() => handleCopyText(smbios.mlb, setCopiedMlb)}>
                {copiedMlb ? <Check style={{ width: '12px', height: '12px' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                {copiedMlb ? 'OK' : 'Copiar'}
              </button>
            </div>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
              UUID DEL SISTEMA (SystemUUID)
            </span>
            <div className="copy-box" style={{ padding: '8px 12px' }}>
              <span className="copy-text" style={{ fontFamily: 'monospace' }}>{smbios.uuid}</span>
              <button className="copy-btn" style={{ padding: '4px 8px' }} onClick={() => handleCopyText(smbios.uuid, setCopiedUuid)}>
                {copiedUuid ? <Check style={{ width: '12px', height: '12px' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                {copiedUuid ? 'OK' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── STEP 3: EFI GENERATOR ─────────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div className="step-badge">3</div>
          <h2 className="card-title" style={{ margin: 0 }}>
            <FolderOpen style={{ color: 'var(--accent-purple)' }} />
            Generar Carpeta EFI Completa
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', paddingLeft: '36px' }}>
          Descargará los binarios oficiales (OpenCore, HfsPlus, Kexts y SSDTs) y generará el <code>config.plist</code> con todos los parámetros configurados para tu hardware.
        </p>

        {!buildFolder && (
          <div className="info-box" style={{ marginBottom: '16px' }}>
            <Info style={{ width: '15px', height: '15px', flexShrink: 0, color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '13px' }}>Primero debes <strong>elegir una carpeta de destino</strong> en el Paso 1 antes de generar la EFI.</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: buildLogs.length > 0 ? '20px' : '0' }}>
          <button 
            className={`scan-btn ${buildStatus === 'building' ? 'scanning' : ''}`}
            style={{ 
              padding: '10px 28px', 
              boxShadow: buildFolder ? '0 4px 20px var(--accent-purple-glow)' : 'none',
              backgroundColor: buildFolder ? 'var(--accent-purple)' : 'var(--bg-hover)',
              color: buildFolder ? '#ffffff' : 'var(--text-muted)',
              border: buildFolder ? 'none' : '1px solid var(--border)'
            }}
            onClick={handleBuildEfi}
            disabled={!buildFolder || buildStatus === 'building'}
          >
            <Download style={{ width: '16px', height: '16px' }} />
            {buildStatus === 'building' ? 'Construyendo EFI...' : 'Generar Carpeta EFI'}
          </button>
        </div>

        {/* Builder Logs Console */}
        {(buildStatus === 'building' || buildLogs.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="console-box" style={{ height: '220px', maxWidth: '100%' }}>
              {buildLogs.map((log, index) => (
                <div key={index} className={`console-line ${log.type}`}>
                  {log.time && <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>[{log.time}]</span>}
                  <span>{log.text}</span>
                </div>
              ))}
              <div ref={buildConsoleEndRef} />
            </div>

            {buildStatus === 'success' && (
              <div className="success-box">
                <Check style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>¡Carpeta EFI construida con éxito!</strong>
                  <span style={{ fontSize: '12px' }}>Archivos guardados en: </span>
                  <code style={{ fontSize: '12px' }}>{efiFolderPath}</code>
                  <br />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Copia la carpeta <code>EFI</code> a la raíz de tu partición FAT32 de arranque USB.
                  </span>
                </div>
              </div>
            )}

            {buildStatus === 'error' && (
              <div className="alert-box">
                <ShieldAlert style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>Error al crear la estructura EFI</strong>
                  Ocurrió un fallo de red o permisos. Revisa la consola superior para más detalles.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CONFIG.PLIST PREVIEW PANEL ─────────────────────────────────────── */}
      <div className="card" style={{ border: '1px solid rgba(168, 85, 247, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Code2 style={{ width: '18px', height: '18px', color: 'var(--accent-purple)', flexShrink: 0 }} />
            <div>
              <h2 className="card-title" style={{ margin: 0, fontSize: '14px' }}>
                Preview config.plist
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Previsualiza el archivo XML que se generará con todos los parámetros de tu hardware antes de construir la EFI.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {plistPreview && (
              <button
                className="copy-btn"
                style={{ padding: '6px 14px' }}
                onClick={() => handleCopyText(plistPreview, setCopiedPlist)}
              >
                {copiedPlist ? <Check style={{ width: '12px', height: '12px' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                {copiedPlist ? 'Copiado' : 'Copiar XML'}
              </button>
            )}
            <button
              className="copy-btn"
              style={{ padding: '6px 14px', borderColor: 'rgba(168, 85, 247, 0.4)', color: 'var(--accent-purple)' }}
              onClick={handlePreviewPlist}
              disabled={plistPreviewLoading}
            >
              {plistPreviewLoading
                ? <><RefreshCw style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} /> Generando...</>
                : <><Eye style={{ width: '12px', height: '12px' }} /> {showPlistPreview ? 'Refrescar' : 'Ver Preview'}</>
              }
            </button>
          </div>
        </div>

        {showPlistPreview && (
          <div style={{ marginTop: '16px' }}>
            {/* What's personalized summary */}
            <div style={{ 
              display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px'
            }}>
              {[
                { label: 'SMBIOS', value: smbios.model, color: 'var(--accent-purple)' },
                { label: 'Serial', value: smbios.serial, color: 'var(--accent-cyan)' },
                { label: 'Kexts', value: `${activeKexts.length} inyectados`, color: 'var(--status-native-text)' },
                { label: 'SSDTs', value: `${activeSsdts.length} tablas ACPI`, color: 'var(--status-config-text)' },
                { label: 'Boot-args', value: bootArgsString.split(' ').length + ' flags', color: 'var(--text-secondary)' },
              ].map(chip => (
                <div key={chip.label} style={{
                  padding: '3px 10px', borderRadius: '99px',
                  border: `1px solid rgba(255,255,255,0.08)`,
                  fontSize: '11px', display: 'flex', gap: '5px', alignItems: 'center'
                }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>{chip.label}:</span>
                  <span style={{ color: chip.color, fontFamily: 'var(--font-mono)' }}>{chip.value}</span>
                </div>
              ))}
            </div>

            {plistPreviewLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite', color: 'var(--accent-purple)' }} />
                Generando config.plist personalizado...
              </div>
            ) : (
              <div style={{
                backgroundColor: 'rgba(0,0,0,0.7)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11.5px',
                lineHeight: '1.6',
                color: '#cdd6f4',
                overflowX: 'auto',
                overflowY: 'auto',
                maxHeight: '480px',
                whiteSpace: 'pre',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)',
              }}>
                {plistPreview.split('\n').map((line, i) => {
                  // Very lightweight XML colorizer
                  let colored = line
                    .replace(/(&lt;|<)(\/?)(\w[\w,]*)(.*?)(\/?>)/g, (m, open, slash, tag, attrs, close) => {
                      return `<span style="color:#cba6f7">${open}${slash}${tag}</span><span style="color:#89b4fa">${attrs}</span><span style="color:#cba6f7">${close}</span>`;
                    })
                    .replace(/(&lt;!--|<!--)(.*?)(-->|--&gt;)/g, '<span style="color:#6c7086;font-style:italic">$&</span>')
                    .replace(/(&gt;|>)([^<{]+?)(&lt;|<)/g, (m, gt, content, lt) => {
                      if (content.trim()) {
                        return `${gt}<span style="color:#a6e3a1">${content}</span>${lt}`;
                      }
                      return m;
                    });
                  return (
                    <div key={i} dangerouslySetInnerHTML={{ __html: colored || '&nbsp;' }} style={{ minHeight: '1.6em' }} />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── STEP 4: MACOS RECOVERY DOWNLOADER ────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div className="step-badge" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>4</div>
          <h2 className="card-title" style={{ margin: 0 }}>
            <Download style={{ color: 'var(--accent-cyan)' }} />
            Descargar macOS Recovery
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', paddingLeft: '36px' }}>
          Descarga los archivos oficiales <code>BaseSystem.dmg</code> y <code>BaseSystem.chunklist</code> directamente desde los servidores de Apple.
        </p>

        {!buildFolder && (
          <div className="info-box" style={{ marginBottom: '16px' }}>
            <Info style={{ width: '15px', height: '15px', flexShrink: 0, color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '13px' }}>Primero debes <strong>elegir una carpeta de destino</strong> en el Paso 1.</span>
          </div>
        )}

        {/* Destination reminder */}
        {buildFolder && (
          <div className="destination-preview" style={{ marginBottom: '16px', borderColor: 'rgba(6, 182, 212, 0.3)' }}>
            <MapPin style={{ width: '13px', height: '13px', color: 'var(--accent-cyan)', flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>LOS ARCHIVOS SE DESCARGARÁN EN:</span>
              <code style={{ display: 'block', fontSize: '12px', color: 'var(--accent-cyan)', marginTop: '2px' }}>{recoveryFolderPath}</code>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              VERSION DE MACOS A DESCARGAR
            </span>
            <select 
              value={selectedRecoveryVer}
              onChange={(e) => setSelectedRecoveryVer(e.target.value)}
              className="search-input"
              style={{ backgroundColor: '#020202', padding: '8px 12px', fontSize: '13px', border: '1px solid var(--border)', width: '100%', color: 'var(--text-primary)' }}
              disabled={downloadStatus === 'downloading'}
            >
              <option value="macOS 15 Sequoia">macOS 15 Sequoia (Última versión)</option>
              <option value="macOS 14 Sonoma">macOS 14 Sonoma (Estable)</option>
              <option value="macOS 13 Ventura">macOS 13 Ventura</option>
              <option value="macOS 12 Monterey">macOS 12 Monterey (Soporte GPU antiguo)</option>
              <option value="macOS 11 Big Sur">macOS 11 Big Sur</option>
              <option value="macOS 10.15 Catalina">macOS 10.15 Catalina</option>
              <option value="macOS 10.14 Mojave">macOS 10.14 Mojave</option>
              <option value="macOS 10.13 High Sierra">macOS 10.13 High Sierra</option>
            </select>
          </div>

          <button 
            className={`scan-btn ${downloadStatus === 'downloading' ? 'scanning' : ''}`}
            style={{ 
              alignSelf: 'flex-end', 
              padding: '10px 24px',
              backgroundColor: buildFolder ? 'var(--accent-cyan)' : 'var(--bg-hover)',
              color: buildFolder ? '#000000' : 'var(--text-muted)',
              border: buildFolder ? 'none' : '1px solid var(--border)',
              boxShadow: (buildFolder && downloadStatus !== 'downloading') ? '0 4px 20px rgba(6,182,212,0.4)' : 'none'
            }}
            onClick={handleDownloadRecovery}
            disabled={!buildFolder || downloadStatus === 'downloading'}
          >
            <Download style={{ width: '16px', height: '16px' }} />
            {downloadStatus === 'downloading' ? 'Descargando...' : 'Descargar Recovery'}
          </button>
        </div>

        {/* Progress Bar */}
        {downloadStatus === 'downloading' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Descargando: <strong>{downloadProgress.file || 'Conectando...'}</strong>
              </span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>
                {downloadProgress.percent}% ({(downloadProgress.downloaded / (1024 * 1024)).toFixed(1)}MB / {(downloadProgress.total / (1024 * 1024)).toFixed(1)}MB)
              </span>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--border)' }}>
              <div 
                style={{ 
                  height: '100%', 
                  borderRadius: '4px', 
                  background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))',
                  width: `${downloadProgress.percent}%`,
                  transition: 'width 0.1s ease-out'
                }} 
              />
            </div>
          </div>
        )}

        {/* Downloader Console logs */}
        {(downloadStatus === 'downloading' || downloadLogs.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="console-box" style={{ height: '150px', maxWidth: '100%' }}>
              {downloadLogs.map((log, index) => (
                <div key={index} className={`console-line ${log.type}`}>
                  {log.time && <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>[{log.time}]</span>}
                  <span>{log.text}</span>
                </div>
              ))}
              <div ref={downloadConsoleEndRef} />
            </div>

            {downloadStatus === 'success' && (
              <div className="success-box">
                <Check style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>¡Recovery de macOS descargado correctamente!</strong>
                  <span style={{ fontSize: '12px' }}>Archivos guardados en: </span>
                  <code style={{ fontSize: '12px' }}>{recoveryFolderPath}</code>
                  <br />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Para que el instalador sea detectado por OpenCore, copia la carpeta <code>com.apple.recovery.boot</code> al mismo nivel que la carpeta <code>EFI</code> en tu USB.
                  </span>
                </div>
              </div>
            )}
            
            {downloadStatus === 'error' && (
              <div className="alert-box">
                <ShieldAlert style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>Error al descargar la imagen de macOS Recovery</strong>
                  Ocurrió un fallo de conexión o de escritura. Verifica tu internet y los permisos de la ruta elegida.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SPLIT LAYOUT: SSDTs / Kexts Selector & EFI Tree ──────────────── */}
      <div className="efi-grid">
        
        {/* LEFT COLUMN: SSDTs & Kexts Selector Checklists */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* ACPI / SSDT Selector */}
          <div className="card">
            <h2 className="card-title">
              <FolderOpen style={{ color: 'var(--accent-cyan)' }} />
              Tablas ACPI Requeridas (SSDTs)
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Archivos binarios compilados que modifican tablas DSDT de la BIOS para compatibilidad con macOS.
            </p>

            <div className="checklist-container">
              {activeReport.ssdts.length > 0 ? (
                activeReport.ssdts.map((ssdt, idx) => (
                  <div className="checklist-item" key={idx}>
                    <input 
                      type="checkbox" 
                      id={`ssdt-${ssdt.name}`}
                      className="checklist-checkbox" 
                      checked={!!selectedSsdts[ssdt.name]}
                      onChange={() => handleSsdtToggle(ssdt.name)}
                    />
                    <div className="checklist-label">
                      <label htmlFor={`ssdt-${ssdt.name}`} className="checklist-name">{ssdt.name}</label>
                      <span className="checklist-desc">{ssdt.desc}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  No se requieren SSDTs específicos para la arquitectura de tu procesador.
                </div>
              )}
            </div>
          </div>

          {/* Kexts Selector */}
          <div className="card">
            <h2 className="card-title">
              <FolderOpen style={{ color: 'var(--accent-purple)' }} />
              Extensiones del Kernel (Kexts)
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Controladores necesarios para inyectar compatibilidad de hardware (Gráficos, Red, Sensores).
            </p>

            <div className="checklist-container">
              {activeReport.kexts.map((kext, idx) => (
                <div className="checklist-item" key={idx}>
                  <input 
                    type="checkbox" 
                    id={`kext-${kext}`}
                    className="checklist-checkbox" 
                    checked={!!selectedKexts[kext]}
                    onChange={() => handleKextToggle(kext)}
                  />
                  <div className="checklist-label">
                    <label htmlFor={`kext-${kext}`} className="checklist-name">{kext}</label>
                    <span className="checklist-desc">
                      {kext === 'Lilu.kext' && 'El kext más importante. Parchea procesos en macOS, requerido por otros kexts.'}
                      {kext === 'VirtualSMC.kext' && 'Emula el chip SMC de Apple. Requerido para iniciar el sistema.'}
                      {kext === 'WhateverGreen.kext' && 'Administra compatibilidad gráfica (framebuffers de iGPU, parches de dGPU).'}
                      {kext === 'NVMeFix.kext' && 'Mejora la compatibilidad, administración de energía y TRIM en SSDs NVMe de terceros.'}
                      {kext === 'IntelMausi.kext' && 'Controlador de red para tarjetas Ethernet cableadas de Intel (I219/I211).'}
                      {kext === 'LucyRTL8125Ethernet.kext' && 'Controlador de red para tarjetas Ethernet Realtek 2.5 Gbps (RTL8125).'}
                      {kext === 'RealtekRTL8111.kext' && 'Controlador de red para tarjetas Ethernet Realtek Gigabit (RTL8111/RTL8168).'}
                      {kext === 'AirportItlwm.kext' && 'Controlador Wi-Fi nativo para tarjetas inalámbricas Intel.'}
                      {kext === 'IntelBluetoothFirmware.kext' && 'Inyecta firmware para habilitar Bluetooth en chips Intel.'}
                      {kext === 'IntelBTPatcher.kext' && 'Aplica parches de subsistema de Bluetooth para compatibilidad con macOS moderno.'}
                      {kext === 'BlueToolFixup.kext' && 'Corrige los fallos del stack de Bluetooth en macOS Monterey/Sonoma/Sequoia.'}
                      {kext === 'AMDRyzenCPUPowerManagement.kext' && 'Administración de energía para procesadores AMD Ryzen.'}
                      {kext === 'SMCAMDProcessor.kext' && 'Sensores de temperatura y revoluciones de CPU para procesadores AMD Ryzen.'}
                      {!['Lilu.kext', 'VirtualSMC.kext', 'WhateverGreen.kext', 'NVMeFix.kext', 'IntelMausi.kext',
                        'LucyRTL8125Ethernet.kext', 'RealtekRTL8111.kext', 'AirportItlwm.kext',
                        'IntelBluetoothFirmware.kext', 'IntelBTPatcher.kext', 'BlueToolFixup.kext',
                        'AMDRyzenCPUPowerManagement.kext', 'SMCAMDProcessor.kext'
                      ].includes(kext) && 'Extensión de kernel detectada recomendada para tu hardware específico.'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: EFI Structure & Boot configs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Interactive EFI Tree View */}
          <div className="card">
            <h2 className="card-title">
              <Folder style={{ color: 'var(--status-config-text)' }} />
              Estructura de Carpeta EFI Recomendada
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Ubicación recomendada de tus archivos en la partición EFI de tu disco de arranque (OpenCore).
            </p>

            <div className="tree-view">
              <div className="tree-folder"><Folder style={{ width: '14px', height: '14px' }} /> EFI</div>
              <div className="tree-folder" style={{ paddingLeft: '16px' }}><Folder style={{ width: '14px', height: '14px' }} /> BOOT</div>
              <div className="tree-file" style={{ paddingLeft: '32px' }}><File style={{ width: '12px', height: '12px' }} /> BOOTx64.efi</div>
              
              <div className="tree-folder" style={{ paddingLeft: '16px', marginTop: '4px' }}><FolderOpen style={{ width: '14px', height: '14px' }} /> OC</div>
                
                {/* ACPI FOLDER */}
                <div className="tree-folder" style={{ paddingLeft: '32px' }}><FolderOpen style={{ width: '14px', height: '14px' }} /> ACPI</div>
                {activeSsdts.map(name => (
                  <div className="tree-active-file" style={{ paddingLeft: '48px' }} key={name}>
                    <ChevronRight style={{ width: '10px', height: '10px' }} /> {name}
                  </div>
                ))}
                {activeSsdts.length === 0 && (
                  <div style={{ paddingLeft: '48px', color: 'var(--text-muted)', fontStyle: 'italic' }}>(Vacío)</div>
                )}

                {/* DRIVERS FOLDER */}
                <div className="tree-folder" style={{ paddingLeft: '32px', marginTop: '4px' }}><FolderOpen style={{ width: '14px', height: '14px' }} /> Drivers</div>
                <div className="tree-file" style={{ paddingLeft: '48px' }}><File style={{ width: '12px', height: '12px' }} /> HfsPlus.efi</div>
                <div className="tree-file" style={{ paddingLeft: '48px' }}><File style={{ width: '12px', height: '12px' }} /> OpenRuntime.efi</div>
                <div className="tree-file" style={{ paddingLeft: '48px' }}><File style={{ width: '12px', height: '12px' }} /> OpenCanopy.efi</div>

                {/* KEXTS FOLDER */}
                <div className="tree-folder" style={{ paddingLeft: '32px', marginTop: '4px' }}><FolderOpen style={{ width: '14px', height: '14px' }} /> Kexts</div>
                {activeKexts.map(name => (
                  <div className="tree-active-file" style={{ paddingLeft: '48px' }} key={name}>
                    <ChevronRight style={{ width: '10px', height: '10px' }} /> {name}
                  </div>
                ))}
                {activeKexts.length === 0 && (
                  <div style={{ paddingLeft: '48px', color: 'var(--text-muted)', fontStyle: 'italic' }}>(Vacío)</div>
                )}

                {/* RESOURCES FOLDER */}
                <div className="tree-folder" style={{ paddingLeft: '32px', marginTop: '4px' }}><Folder style={{ width: '14px', height: '14px' }} /> Resources</div>
                
                {/* CONFIG.PLIST */}
                <div className="tree-active-file" style={{ paddingLeft: '32px', marginTop: '4px', color: '#ff79c6' }}>
                  <File style={{ width: '12px', height: '12px', color: '#ff79c6' }} /> config.plist
                </div>
            </div>
          </div>

          {/* config.plist variables */}
          <div className="card">
            <h2 className="card-title">
              <FolderOpen style={{ color: 'var(--accent-purple)' }} />
              Parámetros Clave para config.plist
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
              
              {/* Boot-args */}
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>BOOT-ARGS RECOMENDADOS</span>
                <div className="copy-box">
                  <span className="copy-text">{bootArgsString}</span>
                  <button className="copy-btn" onClick={() => handleCopyText(bootArgsString, setCopiedBootArgs)}>
                    {copiedBootArgs ? <Check style={{ width: '12px', height: '12px' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                    {copiedBootArgs ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* CPUID Spoofing (Alder / Raptor Lake only) */}
              {activeReport.cpu.cpuidSpoof && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--status-config-text)' }}>
                    <ShieldAlert style={{ width: '14px', height: '14px' }} />
                    <span style={{ fontSize: '12px', fontWeight: '700' }}>CPUID SPOOF REQUERIDO (Alder/Raptor Lake)</span>
                  </div>
                  
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.4' }}>
                    Aplica estos valores en la sección <code>Kernel -&gt; Emulate</code> de tu config.plist para que macOS reconozca tu procesador de {activeReport.cpu.cpuidSpoof.model}.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cpuid1Data (Hex):</span>
                      <div className="copy-box" style={{ padding: '8px 12px' }}>
                        <span className="copy-text" style={{ fontSize: '12px' }}>{activeReport.cpu.cpuidSpoof.data}</span>
                        <button className="copy-btn" onClick={() => handleCopyText(activeReport.cpu.cpuidSpoof.data, setCopiedCpuidData)}>
                          {copiedCpuidData ? 'OK' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cpuid1Mask (Hex):</span>
                      <div className="copy-box" style={{ padding: '8px 12px' }}>
                        <span className="copy-text" style={{ fontSize: '12px' }}>{activeReport.cpu.cpuidSpoof.mask}</span>
                        <button className="copy-btn" onClick={() => handleCopyText(activeReport.cpu.cpuidSpoof.mask, setCopiedCpuidMask)}>
                          {copiedCpuidMask ? 'OK' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick guide redirect */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Guía de Instalación Oficial:</span>
                <a 
                  href="https://dortania.github.io/OpenCore-Install-Guide/" 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--accent-purple)', textDecoration: 'none' }}
                >
                  Dortania OpenCore Guide
                  <ExternalLink style={{ width: '12px', height: '12px' }} />
                </a>
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

export default EfiPlanner;
