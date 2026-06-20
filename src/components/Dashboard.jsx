import React, { useRef, useEffect } from 'react';
import { 
  Cpu, 
  Monitor, 
  HardDrive, 
  Wifi, 
  RefreshCw, 
  AlertOctagon, 
  CheckCircle2, 
  AlertTriangle,
  Server
} from 'lucide-react';

function Dashboard({ status, onScan, report, logs, isFallback, onGoToPlanner }) {
  const consoleEndRef = useRef(null);

  // Auto-scroll console to bottom
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'native':
        return <span className="badge badge-native">Compatible Nativo</span>;
      case 'config':
        return <span className="badge badge-config">Requiere Config</span>;
      case 'incompatible':
        return <span className="badge badge-incompatible">Incompatible</span>;
      default:
        return <span className="badge">Desconocido</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* 1. Diagnostic Console Control Center */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>
              <Server style={{ color: 'var(--accent-purple)' }} />
              Dortania Diagnostics Core
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Run system diagnostic commands to query WMI system configuration.
            </p>
          </div>
          <button 
            className={`scan-btn ${status === 'scanning' ? 'scanning' : ''}`}
            onClick={onScan}
            disabled={status === 'scanning'}
            style={{ marginLeft: 'auto' }}
          >
            <RefreshCw className={status === 'scanning' ? 'spin-icon' : ''} style={{ width: '16px', height: '16px' }} />
            {status === 'scanning' ? 'Escaneando...' : 'Re-escanear Hardware'}
          </button>
        </div>

        {status === 'scanning' || logs.length > 0 ? (
          <div className="scan-container">
            {status === 'scanning' && (
              <div className="radial-scan">
                <div className="radial-scan-ring"></div>
                <div className="radial-scan-glow"></div>
                <Cpu style={{ width: '40px', height: '40px', color: 'var(--accent-purple)' }} />
              </div>
            )}

            <div className="console-box">
              {logs.map((log, index) => (
                <div key={index} className={`console-line ${log.type}`}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>[{log.time}]</span>
                  <span>{log.text}</span>
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>
            
            {isFallback && status === 'completed' && (
              <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--status-config-text)', fontStyle: 'italic' }}>
                * Ejecutando en modo demostración del navegador (datos WMI simulados).
              </div>
            )}
          </div>
        ) : (
          <div className="scan-container" style={{ padding: '60px 20px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Presione iniciar para comenzar el diagnóstico de hardware</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '400px', marginBottom: '24px' }}>
              La aplicación ejecutará de forma segura scripts PowerShell locales para recopilar los IDs de tus dispositivos PCI y generar una estructura de EFI.
            </p>
            <button className="scan-btn" onClick={onScan}>
              Iniciar Diagnóstico
            </button>
          </div>
        )}
      </div>

      {/* 2. Overall Compatibility Box */}
      {status === 'completed' && report && (
        <div>
          {report.overallStatus === 'compatible' && (
            <div className="success-box">
              <CheckCircle2 className="alert-icon" />
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>¡Sistema Altamente Compatible!</strong>
                Todo tu hardware principal tiene controladores nativos en macOS. Puedes construir una EFI OpenCore estándar prácticamente sin parches complejos.
              </div>
            </div>
          )}
          {report.overallStatus === 'config' && (
            <div className="warning-box">
              <AlertTriangle className="alert-icon" />
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>Requiere Configuración Adicional</strong>
                El sistema funcionará, pero requiere parches de kernel, Spoofing de CPUID (para procesadores Intel de 12.ª a 14.ª gen) o kexts específicos para habilitar redes Wi-Fi/Bluetooth. Revisa la pestaña <strong>EFI Planner</strong>.
              </div>
            </div>
          )}
          {report.overallStatus === 'incompatible' && (
            <div className="alert-box">
              <AlertOctagon className="alert-icon" />
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>Hardware Incompatible Detectado</strong>
                Se ha detectado hardware que causará bloqueos o pánicos de kernel en macOS (ej. SSD PM981 o tarjeta de video Nvidia RTX/AMD RX 6700 XT). Debes desactivar estos componentes mediante SSDTs o reemplazarlos para poder instalar macOS.
              </div>
            </div>
          )}
          
          {/* ── Guided Next Step CTA ── */}
          {onGoToPlanner && (
            <div style={{ 
              marginTop: '16px',
              padding: '16px 20px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(6, 182, 212, 0.05))',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  ✅ Diagnóstico completado
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  El siguiente paso es generar la carpeta EFI con los kexts, SSDTs y config.plist específicos para tu hardware.
                </div>
              </div>
              <button
                className="scan-btn"
                style={{ 
                  padding: '10px 22px', 
                  fontSize: '13px',
                  background: 'linear-gradient(135deg, var(--accent-purple), #6d28d9)',
                  boxShadow: '0 4px 16px var(--accent-purple-glow)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                onClick={onGoToPlanner}
              >
                Ir a EFI Planner →
              </button>
            </div>
          )}
        </div>
      )}


      {/* 3. Hardware Cards Grid */}
      {status === 'completed' && report && (
        <div className="dashboard-grid">
          
          {/* CPU Card */}
          <div className="summary-card">
            <div className="summary-header">
              <div className="summary-info">
                <div className="summary-icon-box">
                  <Cpu style={{ width: '20px', height: '20px' }} />
                </div>
                <div className="summary-details">
                  <h3>Procesador (CPU)</h3>
                  <p>{report.cpu.name}</p>
                </div>
              </div>
              {getStatusBadge(report.cpu.status)}
            </div>
            {report.cpu.notes && (
              <div className="summary-spec" style={{ whiteSpace: 'normal', fontSize: '12px', lineHeight: '1.4' }}>
                {report.cpu.notes}
              </div>
            )}
          </div>

          {/* GPU Cards */}
          {report.gpus.map((gpu, index) => (
            <div className="summary-card" key={index}>
              <div className="summary-header">
                <div className="summary-info">
                  <div className="summary-icon-box">
                    <Monitor style={{ width: '20px', height: '20px' }} />
                  </div>
                  <div className="summary-details">
                    <h3>Tarjeta Gráfica (GPU)</h3>
                    <p>{gpu.name}</p>
                  </div>
                </div>
                {getStatusBadge(gpu.status)}
              </div>
              <div className="summary-spec">
                PCI ID: VEN_{gpu.vendorId} & DEV_{gpu.deviceId}
              </div>
              {gpu.notes && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {gpu.notes}
                </div>
              )}
            </div>
          ))}

          {/* Storage Cards */}
          {report.storage.map((disk, index) => (
            <div className="summary-card" key={index}>
              <div className="summary-header">
                <div className="summary-info">
                  <div className="summary-icon-box">
                    <HardDrive style={{ width: '20px', height: '20px' }} />
                  </div>
                  <div className="summary-details">
                    <h3>Almacenamiento ({disk.mediaType})</h3>
                    <p>{disk.model}</p>
                  </div>
                </div>
                {getStatusBadge(disk.status)}
              </div>
              <div className="summary-spec">
                Tamaño: {disk.size} GB | Tipo: {disk.mediaType}
              </div>
              {disk.notes && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {disk.notes}
                </div>
              )}
            </div>
          ))}

          {/* Network Cards */}
          {report.network.map((net, index) => (
            <div className="summary-card" key={index}>
              <div className="summary-header">
                <div className="summary-info">
                  <div className="summary-icon-box">
                    <Wifi style={{ width: '20px', height: '20px' }} />
                  </div>
                  <div className="summary-details">
                    <h3>Red ({net.type})</h3>
                    <p>{net.desc}</p>
                  </div>
                </div>
                {getStatusBadge(net.status)}
              </div>
              <div className="summary-spec">
                PCI ID: VEN_{net.vendorId} & DEV_{net.deviceId || 'N/A'}
              </div>
              {net.notes && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {net.notes}
                </div>
              )}
            </div>
          ))}

        </div>
      )}

      {/* Spinner animation keyframe injected locally */}
      <style>{`
        .spin-icon {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default Dashboard;
