import React from 'react';
import { Cpu, Monitor, HardDrive, Wifi, ShieldAlert } from 'lucide-react';

function HardwareDetails({ systemData, status }) {
  if (status !== 'completed' || !systemData) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <h3 style={{ color: 'var(--text-secondary)' }}>Por favor, realice un diagnóstico de hardware en el Dashboard primero.</h3>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* 1. CPU Section */}
      {systemData.CPU && (
        <div className="card">
          <h2 className="card-title">
            <Cpu style={{ color: 'var(--accent-purple)' }} />
            Procesador (CPU)
          </h2>
          <div className="details-table-container">
            <table className="details-table">
              <thead>
                <tr>
                  <th>Propiedad</th>
                  <th>Valor Técnico</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Modelo Comercial</td>
                  <td className="mono-cell">{systemData.CPU.Name}</td>
                </tr>
                  <tr>
                  <td>Fabricante</td>
                  <td className="mono-cell">{systemData.CPU.Manufacturer}</td>
                </tr>
                <tr>
                  <td>Núcleos Físicos</td>
                  <td className="mono-cell">{systemData.CPU.Cores} Cores</td>
                </tr>
                <tr>
                  <td>Hilos Lógicos</td>
                  <td className="mono-cell">{systemData.CPU.Threads} Threads</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Motherboard Section */}
      {systemData.Motherboard && (
        <div className="card">
          <h2 className="card-title">
            <Cpu style={{ color: 'var(--accent-cyan)' }} />
            Placa Base (Motherboard)
          </h2>
          <div className="details-table-container">
            <table className="details-table">
              <thead>
                <tr>
                  <th>Propiedad</th>
                  <th>Valor Técnico</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Fabricante de Placa</td>
                  <td className="mono-cell">{systemData.Motherboard.Manufacturer}</td>
                </tr>
                <tr>
                  <td>Modelo / Producto</td>
                  <td className="mono-cell">{systemData.Motherboard.Product}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. GPU Section */}
      {systemData.GPU && systemData.GPU.length > 0 && (
        <div className="card">
          <h2 className="card-title">
            <Monitor style={{ color: 'var(--accent-blue)' }} />
            Tarjetas Gráficas (GPU / Video Controllers)
          </h2>
          <div className="details-table-container">
            <table className="details-table">
              <thead>
                <tr>
                  <th>Modelo de GPU</th>
                  <th>Vendor ID (PCI)</th>
                  <th>Device ID (PCI)</th>
                  <th>Versión del Controlador</th>
                  <th>Hardware Device Path</th>
                </tr>
              </thead>
              <tbody>
                {systemData.GPU.map((gpu, idx) => (
                  <tr key={idx}>
                    <td>{gpu.Name}</td>
                    <td className="mono-cell">0x{gpu.VendorID}</td>
                    <td className="mono-cell">0x{gpu.DeviceID}</td>
                    <td className="mono-cell">{gpu.DriverVersion || 'N/A'}</td>
                    <td className="mono-cell" style={{ fontSize: '11px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={gpu.PNPDeviceID}>
                      {gpu.PNPDeviceID}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Storage Section */}
      {systemData.Storage && systemData.Storage.length > 0 && (
        <div className="card">
          <h2 className="card-title">
            <HardDrive style={{ color: 'var(--status-config-text)' }} />
            Discos de Almacenamiento
          </h2>
          <div className="details-table-container">
            <table className="details-table">
              <thead>
                <tr>
                  <th>Modelo de Disco</th>
                  <th>Tipo de Medio</th>
                  <th>Nombre Comercial / Friendly</th>
                  <th>Capacidad (GB)</th>
                </tr>
              </thead>
              <tbody>
                {systemData.Storage.map((disk, idx) => (
                  <tr key={idx}>
                    <td className="mono-cell">{disk.Model}</td>
                    <td>
                      <span className={`badge ${disk.MediaType === 'SSD' ? 'badge-native' : 'badge-config'}`}>
                        {disk.MediaType}
                      </span>
                    </td>
                    <td>{disk.FriendlyName}</td>
                    <td className="mono-cell">{disk.SizeGB} GB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Network Section */}
      {systemData.Network && systemData.Network.length > 0 && (
        <div className="card">
          <h2 className="card-title">
            <Wifi style={{ color: 'var(--status-native-text)' }} />
            Controladoras de Red (Ethernet, Wi-Fi, Bluetooth)
          </h2>
          <div className="details-table-container">
            <table className="details-table">
              <thead>
                <tr>
                  <th>Nombre Adaptador</th>
                  <th>Descripción del Chipset</th>
                  <th>Tipo</th>
                  <th>Vendor ID</th>
                  <th>Device ID</th>
                  <th>Hardware Device Path</th>
                </tr>
              </thead>
              <tbody>
                {systemData.Network.map((net, idx) => (
                  <tr key={idx}>
                    <td>{net.Name}</td>
                    <td>{net.Description}</td>
                    <td>
                      <span className={`badge ${net.Type === 'Ethernet' ? 'badge-native' : (net.Type === 'Wi-Fi' ? 'badge-config' : 'badge-incompatible')}`}>
                        {net.Type}
                      </span>
                    </td>
                    <td className="mono-cell">{net.VendorID ? `0x${net.VendorID}` : 'N/A'}</td>
                    <td className="mono-cell">{net.DeviceIDAttr ? `0x${net.DeviceIDAttr}` : 'N/A'}</td>
                    <td className="mono-cell" style={{ fontSize: '11px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={net.PNPDeviceID}>
                      {net.PNPDeviceID || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw output warning */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', justifyContent: 'center' }}>
        <ShieldAlert style={{ width: '14px', height: '14px' }} />
        <span>Todos los datos mostrados son leídos directamente del bus PCI y controladores WMI del host Windows.</span>
      </div>

    </div>
  );
}

export default HardwareDetails;
