import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Cpu, 
  Search, 
  Info,
  Layers,
  Download,
  CheckCircle2,
  Circle,
  ChevronRight,
  FolderOpen,
  Loader2
} from 'lucide-react';
import Dashboard from './components/Dashboard.jsx';
import EfiPlanner from './components/EfiPlanner.jsx';
import HardwareDetails from './components/HardwareDetails.jsx';
import CompatibilityLookup from './components/CompatibilityLookup.jsx';
import { analyzeHardware } from './utils/analyzer.js';

// Realistic mock data for fallback
const mockSystemData = {
  CPU: {
    Name: "Intel(R) Core(TM) i7-13700K CPU @ 3.40GHz",
    Manufacturer: "GenuineIntel",
    Cores: 16,
    Threads: 24
  },
  GPU: [
    {
      Name: "AMD Radeon RX 6600 XT",
      PNPDeviceID: "PCI\\VEN_1002&DEV_73FF&SUBSYS_E441148C&REV_C1\\6&14C4F4E&0&00000008",
      VendorID: "1002",
      DeviceID: "73FF",
      DriverVersion: "31.0.21029.1005"
    },
    {
      Name: "Intel(R) UHD Graphics 770",
      PNPDeviceID: "PCI\\VEN_8086&DEV_4680&SUBSYS_88821043&REV_0C\\3&11583659&0&10",
      VendorID: "8086",
      DeviceID: "4680",
      DriverVersion: "31.0.101.4575"
    }
  ],
  Motherboard: {
    Manufacturer: "ASUSTeK COMPUTER INC.",
    Product: "ROG STRIX B760-I GAMING WIFI"
  },
  Storage: [
    {
      Model: "Samsung SSD 980 PRO 1TB",
      MediaType: "SSD",
      FriendlyName: "Samsung SSD 980 PRO 1TB",
      SizeGB: 931.51
    },
    {
      Model: "SAMSUNG MZVLB1T0HALR-00000 (PM981)",
      MediaType: "SSD",
      FriendlyName: "SAMSUNG MZVLB1T0HALR-00000",
      SizeGB: 953.87
    }
  ],
  Network: [
    {
      Name: "Wi-Fi",
      Description: "Intel(R) Wi-Fi 6E AX211 160MHz",
      DeviceID: "1",
      PNPDeviceID: "PCI\\VEN_8086&DEV_51F0&SUBSYS_00908086&REV_01\\3&11583659&0&A8",
      VendorID: "8086",
      DeviceIDAttr: "51F0",
      Type: "Wi-Fi"
    },
    {
      Name: "Ethernet",
      Description: "Intel(R) Ethernet Controller I225-V",
      DeviceID: "2",
      PNPDeviceID: "PCI\\VEN_8086&DEV_15F3&SUBSYS_88821043&REV_03\\3&11583659&0&C8",
      VendorID: "8086",
      DeviceIDAttr: "15F3",
      Type: "Ethernet"
    },
    {
      Name: "Bluetooth",
      Description: "Intel(R) Wireless Bluetooth(R)",
      DeviceID: "",
      PNPDeviceID: "USB\\VID_8087&PID_0033\\5&1C4A50E&0&10",
      VendorID: "8087",
      DeviceIDAttr: "0033",
      Type: "Bluetooth"
    }
  ]
};

// ──────────────────────────────────────────
// Workflow Steps definition (guides the user)
// ──────────────────────────────────────────
const WORKFLOW_STEPS = [
  { id: 'dashboard',          label: 'Escanear Hardware',    icon: LayoutDashboard, desc: 'Detectar componentes' },
  { id: 'hardware_details',   label: 'Revisar Resultados',   icon: Info,            desc: 'Ver detalles y compatibilidad' },
  { id: 'efi_planner',        label: 'Generar EFI',          icon: Cpu,             desc: 'Kexts, SSDTs y config.plist' },
  { id: 'recovery_download',  label: 'Descargar macOS',      icon: Download,        desc: 'Recovery desde Apple CDN' },
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [scanningStatus, setScanningStatus] = useState('idle');
  const [systemData, setSystemData] = useState(null);
  const [analyzedReport, setAnalyzedReport] = useState(null);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [isFallback, setIsFallback] = useState(false);

  // ── Global EFI/Download state (persists across tab changes) ──────────────
  const [buildFolder, setBuildFolder] = useState('');
  const [buildStatus, setBuildStatus] = useState('idle');
  const [buildLogs, setBuildLogs] = useState([]);

  const [downloadStatus, setDownloadStatus] = useState('idle');
  const [downloadLogs, setDownloadLogs] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState({ file: '', percent: 0, downloaded: 0, total: 0 });
  const [selectedRecoveryVer, setSelectedRecoveryVer] = useState('macOS 14 Sonoma');
  // ─────────────────────────────────────────────────────────────────────────

  const addLog = (text, type = 'default') => {
    const time = new Date().toLocaleTimeString();
    setConsoleLogs(prev => [...prev, { time, text, type }]);
  };

  const triggerScan = async () => {
    setScanningStatus('scanning');
    setConsoleLogs([]);
    setSystemData(null);
    setAnalyzedReport(null);

    addLog('Initializing WMI diagnostic kernel...', 'system');
    
    setTimeout(async () => {
      addLog('Querying processor core architectures via CIM cmdlets...', 'default');
      
      setTimeout(async () => {
        addLog('Parsing graphics controllers & PCI Vendor/Device IDs...', 'default');
        
        setTimeout(async () => {
          addLog('Checking physical disk media controllers & TRIM properties...', 'default');
          
          setTimeout(async () => {
            addLog('Scanning physical network bus (Ethernet, Wi-Fi, BT)...', 'default');
            
            setTimeout(async () => {
              addLog('Executing Dortania buyer guide ruleset engine...', 'warning');

              try {
                let data = null;
                if (window.electronAPI && typeof window.electronAPI.scanHardware === 'function') {
                  data = await window.electronAPI.scanHardware();
                  setIsFallback(false);
                } else {
                  console.warn('Electron API not found. Running with mock system details.');
                  data = mockSystemData;
                  setIsFallback(true);
                }

                const report = analyzeHardware(data);
                
                setTimeout(() => {
                  setSystemData(data);
                  setAnalyzedReport(report);
                  setScanningStatus('completed');
                  addLog('Diagnostics complete. Hardware analysis report built successfully.', 'success');
                }, 800);

              } catch (err) {
                console.error(err);
                setScanningStatus('error');
                addLog(`CRITICAL: Diagnostic engine failed: ${err.message || err}`, 'error');
              }

            }, 700);
          }, 600);
        }, 650);
      }, 500);
    }, 400);
  };

  // Run automatically on first launch
  useEffect(() => {
    triggerScan();
  }, []);

  // Compute the "furthest completed step" to drive the stepper UI
  const getWorkflowProgress = () => {
    if (downloadStatus === 'success') return 4;
    if (downloadStatus === 'downloading') return 3;
    if (buildStatus === 'success' || buildStatus === 'building' || buildFolder) return 3;
    if (scanningStatus === 'completed') return 2;
    if (scanningStatus === 'scanning') return 1;
    return 0;
  };

  const workflowProgress = getWorkflowProgress();

  // Map the 4-step workflow tab id → nav tab id
  const handleWorkflowStepClick = (stepId) => {
    if (stepId === 'recovery_download') {
      setActiveTab('efi_planner');
    } else {
      setActiveTab(stepId);
    }
  };

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            status={scanningStatus}
            onScan={triggerScan}
            report={analyzedReport}
            logs={consoleLogs}
            isFallback={isFallback}
            onGoToPlanner={() => setActiveTab('efi_planner')}
          />
        );
      case 'efi_planner':
        return (
          <EfiPlanner 
            report={analyzedReport}
            status={scanningStatus}
            // Lift state down as props so it persists
            buildFolder={buildFolder}
            setBuildFolder={setBuildFolder}
            buildStatus={buildStatus}
            setBuildStatus={setBuildStatus}
            buildLogs={buildLogs}
            setBuildLogs={setBuildLogs}
            downloadStatus={downloadStatus}
            setDownloadStatus={setDownloadStatus}
            downloadLogs={downloadLogs}
            setDownloadLogs={setDownloadLogs}
            downloadProgress={downloadProgress}
            setDownloadProgress={setDownloadProgress}
            selectedRecoveryVer={selectedRecoveryVer}
            setSelectedRecoveryVer={setSelectedRecoveryVer}
          />
        );
      case 'hardware_details':
        return (
          <HardwareDetails 
            systemData={systemData}
            status={scanningStatus}
          />
        );
      case 'compatibility_lookup':
        return <CompatibilityLookup />;
      default:
        return <Dashboard status={scanningStatus} onScan={triggerScan} report={analyzedReport} logs={consoleLogs} />;
    }
  };

  const getPageTitle = () => {
    switch(activeTab) {
      case 'dashboard': return { main: 'System Overview', sub: 'Diagnostic dashboard and native compatibility checklist.' };
      case 'efi_planner': return { main: 'EFI Planner Workspace', sub: 'Dynamic ACPI/SSDT injection, Kext checklist, and OpenCore configs.' };
      case 'hardware_details': return { main: 'Advanced Hardware Details', sub: 'Detailed system component bus specs, PCI IDs, and interface mappings.' };
      case 'compatibility_lookup': return { main: 'Dortania Guides Database', sub: 'Lookup chipsets and components against Dortania wireless & GPU compatibility rules.' };
      default: return { main: 'Dashboard', sub: '' };
    }
  };

  const title = getPageTitle();

  return (
    <>
      {/* Background Liquid Glass Blobs */}
      <div className="blobs-container">
        <div className="bg-blob blob-purple"></div>
        <div className="bg-blob blob-cyan"></div>
        <div className="bg-blob blob-blue"></div>
      </div>

      <div className="app-container">
        {/* Sidebar */}
        <aside className="sidebar">
          <div>
            <div className="logo-section">
              <Layers className="logo-icon" />
              <span className="logo-text">Dortania Planner</span>
            </div>

            {/* ── Guided Workflow Stepper ─────────────────── */}
            <div className="workflow-stepper">
              <span className="stepper-label">FLUJO DE TRABAJO</span>
              {WORKFLOW_STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const stepNum = index + 1;
                const isCompleted = workflowProgress >= stepNum;
                const isActive = workflowProgress === index || (workflowProgress === stepNum && index === stepNum - 1);
                const isCurrent = activeTab === step.id || (step.id === 'recovery_download' && activeTab === 'efi_planner' && index === 3);

                return (
                  <div
                    key={step.id}
                    className={`workflow-step ${isCompleted ? 'step-completed' : ''} ${isCurrent ? 'step-current' : ''}`}
                    onClick={() => handleWorkflowStepClick(step.id)}
                  >
                    <div className="step-indicator">
                      {isCompleted ? (
                        <CheckCircle2 className="step-icon-done" />
                      ) : (
                        <div className={`step-number ${isCurrent ? 'step-number-active' : ''}`}>
                          {stepNum}
                        </div>
                      )}
                      {index < WORKFLOW_STEPS.length - 1 && (
                        <div className={`step-connector ${workflowProgress > stepNum ? 'connector-done' : ''}`} />
                      )}
                    </div>
                    <div className="step-content">
                      <span className="step-name">{step.label}</span>
                      <span className="step-desc">{step.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Standard Nav Links ──────────────────────── */}
            <div className="nav-divider">
              <span>NAVEGACIÓN</span>
            </div>
            <nav className="nav-links">
              <div 
                className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <LayoutDashboard className="nav-item-icon" />
                <span>Dashboard</span>
              </div>

              <div 
                className={`nav-item ${activeTab === 'efi_planner' ? 'active' : ''}`}
                onClick={() => setActiveTab('efi_planner')}
              >
                <Cpu className="nav-item-icon" />
                <span>EFI Planner</span>
                {/* Active download badge */}
                {downloadStatus === 'downloading' && (
                  <span className="nav-badge-downloading">
                    <Loader2 style={{ width: '10px', height: '10px', animation: 'spin 1s linear infinite' }} />
                  </span>
                )}
                {downloadStatus === 'success' && buildStatus !== 'building' && (
                  <span className="nav-badge-done">✓</span>
                )}
              </div>

              <div 
                className={`nav-item ${activeTab === 'hardware_details' ? 'active' : ''}`}
                onClick={() => setActiveTab('hardware_details')}
              >
                <Info className="nav-item-icon" />
                <span>Hardware Details</span>
              </div>

              <div 
                className={`nav-item ${activeTab === 'compatibility_lookup' ? 'active' : ''}`}
                onClick={() => setActiveTab('compatibility_lookup')}
              >
                <Search className="nav-item-icon" />
                <span>Guides Lookup</span>
              </div>
            </nav>
          </div>

          {/* Persistent download indicator in sidebar */}
          {(downloadStatus === 'downloading' || buildStatus === 'building') && (
            <div className="sidebar-activity-bar">
              <Loader2 style={{ width: '14px', height: '14px', flexShrink: 0, animation: 'spin 1s linear infinite', color: 'var(--accent-purple)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {buildStatus === 'building' ? 'Construyendo EFI...' : `Descargando ${selectedRecoveryVer}...`}
                </span>
                {downloadStatus === 'downloading' && (
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{downloadProgress.file || 'Consultando...'}</span>
                      <span>{downloadProgress.percent}%</span>
                    </div>
                    <div style={{ height: '3px', borderRadius: '2px', backgroundColor: 'rgba(255,255,255,0.1)' }}>
                      <div style={{ height: '100%', borderRadius: '2px', backgroundColor: 'var(--accent-purple)', width: `${downloadProgress.percent}%`, transition: 'width 0.2s ease-out' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="sidebar-footer">
            <span>v1.0.0 Stable</span>
            <span style={{ color: isFallback ? '#e0a82e' : '#10b981' }}>
              {isFallback ? 'BROWSER_DEMO' : 'NATIVE_WMI'}
            </span>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          <header className="page-header">
            <div className="page-title">
              <h1>{title.main}</h1>
              <p>{title.sub}</p>
            </div>
            {scanningStatus === 'completed' && analyzedReport && (
              <div className={`badge badge-${analyzedReport.overallStatus}`}>
                {analyzedReport.overallStatus === 'compatible' && 'Compatible Nativo'}
                {analyzedReport.overallStatus === 'config' && 'Requiere Config'}
                {analyzedReport.overallStatus === 'incompatible' && 'Incompatible'}
              </div>
            )}
          </header>

          <div className="page-body">
            {renderContent()}
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
