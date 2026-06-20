import React, { useState } from 'react';
import { Search, Monitor, HardDrive, Wifi, ShieldAlert } from 'lucide-react';
import { compatibilityDb } from '../compatibilityDb.js';

function CompatibilityLookup() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, gpus, ssds, wireless

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

  // Build searchable array from compatibilityDb
  const lookupItems = [];

  // 1. Add GPUs
  compatibilityDb.gpus.amd.forEach(item => {
    lookupItems.push({
      id: `gpu-amd-${item.name}`,
      name: item.name,
      category: 'GPU',
      brand: 'AMD Radeon',
      status: item.status,
      note: item.note,
      details: `Dispositivos PCI compatibles: ${item.devices.map(d => `0x${d}`).join(', ')}`
    });
  });

  compatibilityDb.gpus.nvidia.forEach(item => {
    lookupItems.push({
      id: `gpu-nv-${item.name}`,
      name: item.name,
      category: 'GPU',
      brand: 'NVIDIA GeForce',
      status: item.status,
      note: item.note,
      details: 'Las tarjetas NVIDIA modernas están restringidas en macOS (Carecen de drivers Web/Nativos).'
    });
  });

  compatibilityDb.gpus.intel.forEach(item => {
    lookupItems.push({
      id: `gpu-intel-${item.name}`,
      name: item.name,
      category: 'GPU',
      brand: 'Intel Graphics',
      status: item.status,
      note: item.note,
      details: 'Los gráficos integrados móviles/escritorio (Gen 7 a Gen 10) son compatibles. Gen 11+ (Intel Xe) no.'
    });
  });

  // 2. Add SSDs
  compatibilityDb.ssds.forEach(item => {
    lookupItems.push({
      id: `ssd-${item.modelMatch.join('-')}`,
      name: `${item.brand} - Coincidencias: ${item.modelMatch.join(', ')}`,
      category: 'SSD',
      brand: item.brand,
      status: item.status,
      note: item.note,
      details: `Coincide con modelos que contienen: ${item.modelMatch.join(', ')}`
    });
  });

  // 3. Add Wireless
  compatibilityDb.wireless.forEach(item => {
    const brandName = item.vendorId === '14E4' ? 'Broadcom' : (item.vendorId === '8086' ? 'Intel' : (item.vendorId === '14C3' ? 'MediaTek' : 'Realtek'));
    lookupItems.push({
      id: `wifi-${item.chipsetMatch.join('-')}`,
      name: `${brandName} - Chipsets: ${item.chipsetMatch.join(', ')}`,
      category: 'Wireless',
      brand: brandName,
      status: item.status,
      note: item.note,
      details: `PCI Vendor ID: 0x${item.vendorId} | Chipsets soportados: ${item.chipsetMatch.join(', ')}`
    });
  });

  // Filter items based on query and category selection
  const filteredItems = lookupItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.note.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.brand.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'gpus') return matchesSearch && item.category === 'GPU';
    if (filterType === 'ssds') return matchesSearch && item.category === 'SSD';
    if (filterType === 'wireless') return matchesSearch && item.category === 'Wireless';
    
    return matchesSearch;
  });

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'GPU': return <Monitor style={{ width: '16px', height: '16px', color: 'var(--accent-blue)' }} />;
      case 'SSD': return <HardDrive style={{ width: '16px', height: '16px', color: 'var(--status-config-text)' }} />;
      case 'Wireless': return <Wifi style={{ width: '16px', height: '16px', color: 'var(--status-native-text)' }} />;
      default: return <ShieldAlert style={{ width: '16px', height: '16px' }} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Search Bar & Filters */}
      <div className="card" style={{ padding: '20px' }}>
        <div className="search-container">
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar componentes (ej. RX 6600, PM981, Intel AX211, GeForce RTX 3080)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Tab Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className={`nav-item ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
            style={{ padding: '8px 16px', fontSize: '12.5px', cursor: 'pointer' }}
          >
            Todos ({lookupItems.length})
          </button>
          <button 
            className={`nav-item ${filterType === 'gpus' ? 'active' : ''}`}
            onClick={() => setFilterType('gpus')}
            style={{ padding: '8px 16px', fontSize: '12.5px', cursor: 'pointer' }}
          >
            Tarjetas de Video ({lookupItems.filter(i => i.category === 'GPU').length})
          </button>
          <button 
            className={`nav-item ${filterType === 'ssds' ? 'active' : ''}`}
            onClick={() => setFilterType('ssds')}
            style={{ padding: '8px 16px', fontSize: '12.5px', cursor: 'pointer' }}
          >
            Almacenamiento SSD ({lookupItems.filter(i => i.category === 'SSD').length})
          </button>
          <button 
            className={`nav-item ${filterType === 'wireless' ? 'active' : ''}`}
            onClick={() => setFilterType('wireless')}
            style={{ padding: '8px 16px', fontSize: '12.5px', cursor: 'pointer' }}
          >
            Redes Inalámbricas ({lookupItems.filter(i => i.category === 'Wireless').length})
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="lookup-grid">
        {filteredItems.length > 0 ? (
          filteredItems.map(item => (
            <div className="lookup-card" key={item.id}>
              <div className="lookup-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getCategoryIcon(item.category)}
                  <span className="lookup-title">{item.name}</span>
                </div>
                {getStatusBadge(item.status)}
              </div>
              <p className="lookup-desc">{item.note}</p>
              <div 
                className="summary-spec" 
                style={{ fontSize: '11px', padding: '6px 10px', marginTop: '4px', textOverflow: 'initial', whiteSpace: 'normal' }}
              >
                {item.details}
              </div>
            </div>
          ))
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '60px', borderStyle: 'dashed' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No se encontraron componentes que coincidan con la búsqueda.</p>
          </div>
        )}
      </div>

    </div>
  );
}

export default CompatibilityLookup;
