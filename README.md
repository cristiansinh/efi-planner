# 🍎 Dortania Hardware Checker & EFI Planner

> Herramienta de escritorio para detectar hardware compatible con macOS y generar automáticamente la carpeta EFI de OpenCore.

![Electron](https://img.shields.io/badge/Electron-35.0-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D4?logo=windows&logoColor=white)

---

## ✨ Características

- **🔍 Escaneo de hardware automático** — Detecta CPU, GPU, almacenamiento y red usando WMI (PowerShell nativo en Windows)
- **🧠 Análisis de compatibilidad** — Compara tu hardware contra la base de datos de Dortania y te indica qué requiere configuración especial
- **📁 Generación de EFI automatizada** — Descarga OpenCore, HfsPlus, kexts y SSDTs recomendados para tu hardware
- **📄 config.plist personalizado** — Genera un `config.plist` con quirks, framebuffers, CPUID spoof y SMBIOS adaptados a tu hardware específico
- **🔢 Generador de SMBIOS** — Genera números de serie, MLB y UUID válidos para iMessage/iCloud
- **⬇️ Descargador de macOS Recovery** — Descarga `BaseSystem.dmg` y `BaseSystem.chunklist` directo desde los servidores de Apple
- **🎨 UI Liquid Glass** — Interfaz con glassmorfismo, blobs animados y tema oscuro premium
- **🧭 Flujo guiado** — La herramienta te lleva paso a paso: Escanear → Revisar → Generar EFI → Descargar macOS

---

## 🚀 Inicio Rápido

### Requisitos
- **Node.js** 20+
- **Windows 10/11** (para el escaneo WMI nativo)

### Instalación

```bash
git clone https://github.com/TU_USUARIO/dortania-efi-planner.git
cd dortania-efi-planner
npm install
```

### Desarrollo

```bash
npm run dev
```

### Producción (build)

```bash
npm run build
npm start
```

---

## 📋 Flujo de Uso

```
1. Escanear Hardware    → La app detecta automáticamente tu CPU, GPU, Red y Storage
2. Revisar Resultados   → Analiza la compatibilidad con macOS según la guía Dortania
3. Generar EFI          → Selecciona carpeta destino → La app descarga y arma todo
4. Descargar macOS      → Descarga el recovery de Apple para la versión que elijas
```

---

## 🗂️ Estructura del Proyecto

```
├── main.js                  # Proceso principal Electron (IPC, WMI, builds)
├── preload.js               # Puente seguro entre Electron y React
├── detect_hardware.ps1      # Script PowerShell para consultar WMI
├── build_efi.ps1            # Script PowerShell para construir la carpeta EFI
├── src/
│   ├── App.jsx              # Componente raíz + estado global
│   ├── components/
│   │   ├── Dashboard.jsx    # Panel de diagnóstico y compatibilidad
│   │   ├── EfiPlanner.jsx   # Wizard de generación EFI (pasos 1-4)
│   │   ├── HardwareDetails.jsx
│   │   └── CompatibilityLookup.jsx
│   └── utils/
│       ├── analyzer.js      # Motor de análisis de compatibilidad Dortania
│       ├── plistGenerator.js # Generador de config.plist con quirks dinámicos
│       ├── smbiosGenerator.js # Generador de SMBIOS (serial/MLB/UUID)
│       └── macrecovery.js   # Descargador de Apple CDN
└── package.json
```

---

## ⚙️ config.plist Automático

El generador adapta dinámicamente:

| Sección | Qué personaliza |
|---|---|
| `ACPI → Add` | SSDTs por arquitectura de CPU |
| `Kernel → Add` | Kexts en orden correcto (Lilu primero) |
| `Kernel → Emulate` | CPUID Spoof en base64 para Alder/Raptor Lake |
| `Kernel → Quirks` | `AppleXcpmCfgLock`, `ProvideCurrentCpuInfo` — distintos para AMD/Intel/Legacy |
| `Booter → Quirks` | `DevirtualiseMmio`, `SetupVirtualMap` por chipset |
| `DeviceProperties` | Framebuffer iGPU exacto según Device ID de tu Intel UHD |
| `NVRAM → boot-args` | Flags para tu GPU y CPU detectados |
| `PlatformInfo` | Serial, MLB, UUID y modelo de Mac (SMBIOS) |

---

## 📦 Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia Vite + Electron en modo desarrollo |
| `npm run build` | Build de producción (Vite) |
| `npm start` | Ejecuta Electron con el build de producción |

---

## 🙏 Créditos

- [Dortania OpenCore Install Guide](https://dortania.github.io/OpenCore-Install-Guide/)
- [OpenCore](https://github.com/acidanthera/OpenCorePkg)
- [corpnewt/GenSMBIOS](https://github.com/corpnewt/GenSMBIOS)
- [corpnewt/gibMacOS](https://github.com/corpnewt/gibMacOS)

---

> ⚠️ Este proyecto es solo para uso educativo. Instalar macOS en hardware no Apple puede violar los Términos de Servicio de Apple.
