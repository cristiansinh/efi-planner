# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dortania Hardware Checker & EFI Planner** — an Electron + React desktop app for Windows that detects system hardware via WMI, analyzes Hackintosh compatibility using Dortania guidelines, and auto-generates OpenCore EFI folder structures with config.plist.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Full dev mode: starts Vite (port 5173) + Electron with hot reload
npm run build        # Production bundle (Vite → dist/)
npm start            # Launch production Electron app (loads from dist/)
npm run vite:dev     # Vite dev server only (no Electron)
npm run electron:dev # Electron only (expects Vite running separately)
```

## Architecture

The app follows a standard Electron + React IPC pattern:

- **`main.js`** — Electron main process. Registers three IPC handlers (`scan-hardware`, `select-folder`, `build-efi`) that spawn PowerShell scripts and stream stdout back to the renderer as log events.
- **`preload.js`** — Context bridge exposing `scanHardware()`, `selectFolder()`, `buildEfi()`, `onEfiBuildLog()` to the React app. Context isolation is enforced.
- **`src/App.jsx`** — Root React component. Manages global state (systemData, analysisReport, scan status) and renders a tab-based shell over four views.

### Data Flow

```
PowerShell (detect_hardware.ps1)
  → JSON via stdout
  → main.js IPC handler
  → renderer via ipcRenderer.invoke
  → App.jsx state
  → analyzer.js (compatibility rules applied)
  → analysisReport distributed to Dashboard / EfiPlanner / HardwareDetails
```

### Key Source Files

| File | Role |
|------|------|
| `src/compatibilityDb.js` | Compatibility rules for GPUs (AMD Navi/Polaris, NVIDIA, Intel iGPU), Intel CPU generations, storage, and network adapters — the core knowledge base |
| `src/utils/analyzer.js` | Applies compatibilityDb rules to detected hardware; outputs SSDT requirements, Kext list, boot-args, CPUID spoof values |
| `src/utils/plistGenerator.js` | Converts analyzer output to OpenCore XML plist; enforces Lilu-first Kext ordering and base64-encodes CPUID data |
| `detect_hardware.ps1` | WMI/CIM queries for CPU, GPU, motherboard, storage, network, Bluetooth; outputs JSON with VendorIDs/DeviceIDs |
| `build_efi.ps1` | Downloads OpenCore v1.0.3 binaries, SSDTs, and Kexts from GitHub into a target EFI folder structure |

### Components

- **`Dashboard.jsx`** — Hardware summary with status badges and real-time diagnostic console
- **`EfiPlanner.jsx`** — SSDT/Kext selection, folder picker, EFI build trigger, CPUID spoof details
- **`HardwareDetails.jsx`** — Full spec view including PCI IDs
- **`CompatibilityLookup.jsx`** — Searchable Dortania compatibility reference

## Important Constraints

- **Windows-only runtime**: `detect_hardware.ps1` and `build_efi.ps1` require Windows PowerShell with WMI/CIM access. The app falls back to mock hardware data when Electron APIs are unavailable (browser dev mode).
- **EFI build downloads ~200 MB** from GitHub (OpenCore, Kexts, SSDTs) — `build_efi.ps1` handles download failures gracefully by writing placeholder files.
- **Kext ordering matters**: `plistGenerator.js` must keep Lilu first in the Kext array; other ordering changes can break OpenCore boot.
- **IPC channels**: Any new Electron ↔ React communication must be registered in both `main.js` (handler) and `preload.js` (exposure) — direct Node/Electron API access from renderer is blocked by context isolation.

## Design System

Dark-mode UI with deep black backgrounds (`#000000`, `#09090b`), purple accent (`#a855f7`), and three semantic status colors: green (native support), amber (requires config), red (incompatible). Fonts: Inter/Outfit for UI, Fira Code for console output.
