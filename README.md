# Dortania Hardware Checker & EFI Planner

A Windows desktop app that scans your hardware and builds a complete OpenCore EFI folder automatically. Built with Electron + React.

![Electron](https://img.shields.io/badge/Electron-35.0-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D4?logo=windows&logoColor=white)

---

## What it does

Queries WMI via PowerShell to identify your CPU, GPU, storage and network adapters, then cross-references those against Dortania's compatibility rules to produce a ready-to-use OpenCore EFI structure with a personalized `config.plist`.

**Hardware detection**
- CPU family, core count and hybrid architecture detection
- GPU vendor/device IDs with compatibility notes
- NVMe/SATA storage and TRIM support
- Ethernet, Wi-Fi and Bluetooth chipset identification

**EFI generation**
- Downloads OpenCore binaries, HfsPlus.efi and OpenCanopy
- Fetches the correct kexts for your hardware from GitHub releases
- Compiles and places ACPI SSDTs
- Writes a fully configured `config.plist` with hardware-specific quirks

**config.plist customization**
The generator adapts the following sections based on your actual hardware:

| Section | What changes |
|---|---|
| `ACPI -> Add` | SSDTs matched to your CPU |
| `Kernel -> Add` | Kexts in correct load order |
| `Kernel -> Emulate` | CPUID spoof (base64) for Alder/Raptor Lake |
| `Kernel -> Quirks` | Different values for AMD, Intel modern and Intel legacy |
| `Booter -> Quirks` | SetupVirtualMap, DevirtualiseMmio per chipset |
| `DeviceProperties` | Intel iGPU framebuffer by exact Device ID, headless if dGPU present |
| `NVRAM -> boot-args` | Flags detected for your GPU/CPU combo |
| `PlatformInfo` | Generated serial, MLB, UUID and Mac model |

**Other tools**
- SMBIOS generator (serial number, MLB, UUID) for iMessage/iCloud
- macOS Recovery downloader — pulls `BaseSystem.dmg` and `BaseSystem.chunklist` directly from Apple CDN
- live `config.plist` preview with syntax highlighting before writing to disk

---

## Requirements

- Node.js 20+
- Windows 10 or 11 (WMI scanning requires PowerShell)

---

## Setup

```bash
git clone https://github.com/TU_USUARIO/dortania-efi-planner.git
cd dortania-efi-planner
npm install
```

**Development**

```bash
npm run dev
```

**Production build**

```bash
npm run build
npm start
```

---

## Usage

The app guides you through four steps in order:

1. **Scan** — runs PowerShell WMI queries and builds the compatibility report
2. **Review** — shows each component with its macOS compatibility status and notes
3. **Generate EFI** — pick a destination folder, then the app downloads and assembles everything
4. **Download macOS** — fetches the recovery image for whichever macOS version you need

Download progress is preserved if you switch tabs.

---

## Project structure

```
main.js                   Electron main process, IPC handlers
preload.js                Context bridge between Electron and React
detect_hardware.ps1       WMI queries via PowerShell
build_efi.ps1             EFI folder assembly script
src/
  App.jsx                 Root component, global state
  components/
    Dashboard.jsx         Hardware scan and compatibility overview
    EfiPlanner.jsx        4-step EFI build wizard
    HardwareDetails.jsx   Raw hardware details view
    CompatibilityLookup.jsx  Dortania database search
  utils/
    analyzer.js           Dortania compatibility ruleset engine
    plistGenerator.js     config.plist builder with dynamic quirks
    smbiosGenerator.js    Serial/MLB/UUID generation
    macrecovery.js        Apple CDN recovery downloader
```

---

## Credits

- [Dortania OpenCore Install Guide](https://dortania.github.io/OpenCore-Install-Guide/)
- [OpenCore](https://github.com/acidanthera/OpenCorePkg)
- [corpnewt/GenSMBIOS](https://github.com/corpnewt/GenSMBIOS)
- [corpnewt/gibMacOS](https://github.com/corpnewt/gibMacOS)

---

> Installing macOS on non-Apple hardware may violate Apple's Terms of Service. This project is for educational purposes.
