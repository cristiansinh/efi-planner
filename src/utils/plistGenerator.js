// OpenCore config.plist XML Generator
// Assembles a complete, hardware-tailored OpenCore config.plist
// All quirks, framebuffers, CPUID spoofs, SMBIOS and boot-args are
// injected dynamically based on the analyzed hardware report.

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function hexToBase64(hexString) {
  if (!hexString) return '';
  const cleanHex = hexString.replace(/[^A-Fa-f0-9]/g, '');
  const bytes = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes.push(parseInt(cleanHex.substr(i, 2), 16));
  }
  return Buffer.from(bytes).toString('base64');
}

// Convert a 32-bit LE number to base64 (used for framebuffer IDs)
function uint32LEBase64(hexStr) {
  if (!hexStr) return '';
  const clean = hexStr.replace(/^0x/i, '').padStart(8, '0');
  // Reverse byte order (little-endian)
  const le = clean.match(/../g).reverse().join('');
  return hexToBase64(le);
}

// ──────────────────────────────────────────────────────────────────────────────
// Hardware-aware quirk computation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Computes the correct Booter Quirks based on CPU architecture.
 * Reference: https://dortania.github.io/OpenCore-Install-Guide/
 */
function computeBooterQuirks(cpuArch) {
  // Defaults (Intel modern)
  const defaults = {
    AllowRelocationBlock: false,
    AvoidRuntimeDefrag: true,
    DevirtualiseMmio: true,
    DisableSingleUser: false,
    DisableVariableWrite: false,
    DiscardHibernateMap: false,
    EnableSafeModeSlide: true,
    EnableWriteUnprotector: false,  // false for Haswell+ with OpenRuntime
    ForceBooterSignature: false,
    ForceExitBootServices: false,
    ProtectMemoryRegions: false,
    ProtectSecureBoot: false,
    ProtectUefiServices: true,     // Required for Z390/B460+
    ProvideCustomSlide: true,
    ProvideMaxSlide: 0,
    RebuildAppleMemoryMap: true,
    ResizeAppleGpuBars: -1,
    SetupVirtualMap: true,
    SignalAppleOS: false,
    SyncRuntimePermissions: true,
  };

  if (cpuArch === 'amd') {
    return {
      ...defaults,
      DevirtualiseMmio: true,       // Required for AMD
      ProtectUefiServices: false,   // Not needed for AMD
      SetupVirtualMap: true,        // Generally needed
      RebuildAppleMemoryMap: true,
    };
  }

  if (cpuArch === 'intel_legacy') { // Sandy/Ivy Bridge era
    return {
      ...defaults,
      DevirtualiseMmio: false,
      ProtectUefiServices: false,
      EnableWriteUnprotector: true,
      SyncRuntimePermissions: false,
    };
  }

  return defaults;
}

/**
 * Computes the correct Kernel Quirks based on CPU architecture.
 */
function computeKernelQuirks(cpuArch, hasNvme) {
  const defaults = {
    AppleCpuPmCfgLock: false,
    AppleXcpmCfgLock: true,        // Required if CFG Lock can't be disabled in BIOS
    AppleXcpmExtraMsrs: false,
    AppleXcpmForceBoost: false,
    CustomSMBIOSGuid: false,
    DisableIoMapper: true,          // Required if VT-D enabled in BIOS
    DisableIoMapperMapping: false,
    DisableLinkeditJettison: true,
    DisableRtcChecksum: false,
    ExtendBTFeatureFlags: false,
    ForceAquantiaEthernet: false,
    ForceSecureBootScheme: false,
    LapicKernelPanic: false,
    LegacyCommpage: false,
    PanicNoKextDump: true,
    PowerTimeoutKernelPanic: true,
    ProvideCurrentCpuInfo: true,    // Required for Alder/Raptor Lake
    SetApfsTrimTimeout: hasNvme ? 999999 : -1,
    ThirdPartyDrives: false,
    XhciPortLimit: false,
  };

  if (cpuArch === 'amd') {
    return {
      ...defaults,
      AppleXcpmCfgLock: false,     // AMD doesn't use Intel XCPM
      AppleXcpmExtraMsrs: false,
      ProvideCurrentCpuInfo: false, // Intel-only
      PanicNoKextDump: true,
      PowerTimeoutKernelPanic: true,
    };
  }

  if (cpuArch === 'intel_legacy') {
    return {
      ...defaults,
      AppleCpuPmCfgLock: true,     // Sandy/Ivy Bridge need this
      AppleXcpmCfgLock: false,
      ProvideCurrentCpuInfo: false,
    };
  }

  return defaults;
}

/**
 * Compute DeviceProperties for GPU/iGPU injection.
 * Returns an object with PCI path → properties mapping.
 */
function computeDeviceProperties(gpus = [], cpuName = '') {
  const deviceProps = {};

  // Common iGPU framebuffer path
  const igpuPath = 'PciRoot(0x0)/Pci(0x2,0x0)';

  // Audio HDA path (standard for most Intel boards)
  const audioPath = 'PciRoot(0x0)/Pci(0x1b,0x0)';
  deviceProps[audioPath] = {
    'layout-id': 'AQAAAA=='   // layout-id = 1 (AppleALC default)
  };

  // Check if there's an Intel iGPU in the GPU list
  const intelIgpu = gpus.find(g => g.vendorId === '8086' || (g.name || '').toLowerCase().includes('intel'));

  // Check if there's a dedicated GPU (non-Intel)
  const hasDedicatedGpu = gpus.some(g => g.vendorId !== '8086');

  if (intelIgpu && !hasDedicatedGpu) {
    // iGPU-only system → inject proper framebuffer for display output
    // Map common Intel iGPU Device IDs to framebuffers
    const igpuFramebufferMap = {
      // Alder Lake (Gen 12)
      '4680': '0300C89B',   // UHD 770
      '4692': '07009B3E',   // UHD 730
      '4628': '07009B3E',
      // Rocket Lake (Gen 11)
      '4C8A': '07009B3E',
      '4C8B': '07009B3E',
      // Comet Lake (Gen 10)
      '9BC8': '07009B3E',   // UHD 630 (CML)
      '9BC5': '00009B3E',
      '9BCA': '07009B3E',
      // Coffee Lake (Gen 8/9)
      '3E9B': '07009B3E',   // UHD 630
      '3E92': '07009B3E',
      '3E98': '07009B3E',
      // Kaby Lake (Gen 7)
      '5912': '00001659',   // HD 630
      '591B': '00001659',
      // Skylake (Gen 6)
      '1912': '00000060',   // HD 530
      '191B': '00000060',
    };

    const deviceId = (intelIgpu.deviceId || '').toUpperCase();
    const framebuffer = igpuFramebufferMap[deviceId] || '07009B3E';

    deviceProps[igpuPath] = {
      'AAPL,ig-platform-id': uint32LEBase64(framebuffer),
    };
  } else if (intelIgpu && hasDedicatedGpu) {
    // Headless iGPU (compute only, no display) — used with dedicated GPU
    // Inject headless framebuffer so iGPU still provides hardware encode/decode
    const headlessMap = {
      '4680': '03006000',   // UHD 770 headless
      '9BC8': '0300C89B',   // UHD 630 headless
      '3E9B': '0300913E',   // UHD 630 headless
      '3E92': '0300913E',
    };
    const deviceId = (intelIgpu.deviceId || '').toUpperCase();
    const headless = headlessMap[deviceId] || '03001C6B';

    deviceProps[igpuPath] = {
      'AAPL,ig-platform-id': uint32LEBase64(headless),
    };
  }

  return deviceProps;
}

// ──────────────────────────────────────────────────────────────────────────────
// Plist serializers
// ──────────────────────────────────────────────────────────────────────────────

function boolTag(value) {
  return value ? '<true/>' : '<false/>';
}

function serializeQuirksDict(quirks, indent = '\t\t\t') {
  return Object.entries(quirks).map(([key, value]) => {
    if (typeof value === 'boolean') {
      return `${indent}<key>${key}</key>\n${indent}${boolTag(value)}`;
    }
    return `${indent}<key>${key}</key>\n${indent}<integer>${value}</integer>`;
  }).join('\n');
}

function serializeDeviceProperties(deviceProps) {
  if (!deviceProps || Object.keys(deviceProps).length === 0) {
    return `\t\t<key>Add</key>\n\t\t<dict/>\n\t\t<key>Delete</key>\n\t\t<dict/>`;
  }

  let xml = `\t\t<key>Add</key>\n\t\t<dict>\n`;
  for (const [pciPath, props] of Object.entries(deviceProps)) {
    xml += `\t\t\t<key>${pciPath}</key>\n\t\t\t<dict>\n`;
    for (const [propKey, propValue] of Object.entries(props)) {
      xml += `\t\t\t\t<key>${propKey}</key>\n\t\t\t\t<data>${propValue}</data>\n`;
    }
    xml += `\t\t\t</dict>\n`;
  }
  xml += `\t\t</dict>\n\t\t<key>Delete</key>\n\t\t<dict/>`;
  return xml;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate a fully personalized OpenCore config.plist
 * @param {string[]} ssdts    - Selected SSDT filenames
 * @param {string[]} kexts    - Selected kext names
 * @param {string}   bootArgs - Space-separated boot args string
 * @param {object}   cpuidSpoof - { data, mask, model } or null
 * @param {object}   smbios   - { model, serial, mlb, uuid } or null
 * @param {object}   report   - Full hardware analysis report (optional)
 */
export function generateOpenCorePlist(ssdts = [], kexts = [], bootArgs = '', cpuidSpoof = null, smbios = null, report = null) {

  // ── Detect CPU architecture ────────────────────────────────────────────────
  let cpuArch = 'intel_modern'; // default
  let gpus = [];

  if (report) {
    const cpuName = (report.cpu && report.cpu.name) ? report.cpu.name.toLowerCase() : '';
    const isAmd = cpuName.includes('amd') || cpuName.includes('ryzen') || cpuName.includes('threadripper');
    const isLegacy = cpuName.includes('sandy') || cpuName.includes('ivy') || cpuName.includes('i7-2') || cpuName.includes('i5-2') || cpuName.includes('i7-3') || cpuName.includes('i5-3');

    if (isAmd) cpuArch = 'amd';
    else if (isLegacy) cpuArch = 'intel_legacy';
    else cpuArch = 'intel_modern';

    gpus = report.gpus || [];
  }

  const hasNvme = report && report.storage && report.storage.some(s => (s.mediaType || '').toLowerCase().includes('nvme') || (s.model || '').toLowerCase().includes('nvme') || (s.model || '').toLowerCase().includes('980') || (s.model || '').toLowerCase().includes('970'));

  // ── Sort Kexts ─────────────────────────────────────────────────────────────
  const kextOrdering = {
    'Lilu.kext': 1,
    'VirtualSMC.kext': 2,
    'WhateverGreen.kext': 3,
    'AppleALC.kext': 4,
    'AppleALCU.kext': 5,
    'NVMeFix.kext': 6,
    'AMDRyzenCPUPowerManagement.kext': 7,
    'SMCAMDProcessor.kext': 8,
    'IntelMausi.kext': 9,
    'LucyRTL8125Ethernet.kext': 10,
    'RealtekRTL8111.kext': 11,
    'AirportItlwm.kext': 12,
    'IntelBluetoothFirmware.kext': 13,
    'IntelBTPatcher.kext': 14,
    'BlueToolFixup.kext': 15,
  };

  const sortedKexts = [...kexts].sort((a, b) => {
    const orderA = kextOrdering[a] || 100;
    const orderB = kextOrdering[b] || 100;
    return orderA - orderB;
  });

  // ── Compute hardware-specific quirks ──────────────────────────────────────
  const booterQuirks = computeBooterQuirks(cpuArch);
  const kernelQuirks = computeKernelQuirks(cpuArch, hasNvme);
  const deviceProperties = computeDeviceProperties(gpus, report && report.cpu ? report.cpu.name : '');

  // ── ACPI → Add ─────────────────────────────────────────────────────────────
  let acpiAddXml = '';
  ssdts.forEach(ssdt => {
    acpiAddXml += `\t\t\t<dict>
\t\t\t\t<key>Comment</key>
\t\t\t\t<string>Inject ${ssdt}</string>
\t\t\t\t<key>Enabled</key>
\t\t\t\t<true/>
\t\t\t\t<key>Path</key>
\t\t\t\t<string>${ssdt}</string>
\t\t\t</dict>\n`;
  });

  // ── Kernel → Add ───────────────────────────────────────────────────────────
  const codelessKexts = ['UTBMap.kext', 'USBMap.kext', 'UTBDefault.kext', 'USBPorts.kext'];
  let kernelAddXml = '';
  
  sortedKexts.forEach(kext => {
    const isCodeless = codelessKexts.includes(kext);
    const execPath = isCodeless ? '' : `Contents/MacOS/${kext.replace('.kext', '')}`;
    
    kernelAddXml += `\t\t\t<dict>
\t\t\t\t<key>Arch</key>
\t\t\t\t<string>Any</string>
\t\t\t\t<key>BundlePath</key>
\t\t\t\t<string>${kext}</string>
\t\t\t\t<key>Comment</key>
\t\t\t\t<string>${kext.replace('.kext', '')} driver</string>
\t\t\t\t<key>Enabled</key>
\t\t\t\t<true/>
\t\t\t\t<key>ExecutablePath</key>
\t\t\t\t<string>${execPath}</string>
\t\t\t\t<key>MaxKernel</key>
\t\t\t\t<string></string>
\t\t\t\t<key>MinKernel</key>
\t\t\t\t<string></string>
\t\t\t\t<key>PlistPath</key>
\t\t\t\t<string>Contents/Info.plist</string>
\t\t\t</dict>\n`;
  });

  // ── Kernel → Emulate (CPUID Spoof) ────────────────────────────────────────
  let cpuidData = '';
  let cpuidMask = '';

  if (cpuidSpoof && cpuidSpoof.data && cpuidSpoof.mask) {
    cpuidData = hexToBase64(cpuidSpoof.data);
    cpuidMask = hexToBase64(cpuidSpoof.mask);
  }

  const cpuidEmulateXml = `\t\t<key>Emulate</key>
\t\t<dict>
\t\t\t<key>Cpuid1Data</key>
\t\t\t<data>${cpuidData}</data>
\t\t\t<key>Cpuid1Mask</key>
\t\t\t<data>${cpuidMask}</data>
\t\t\t<key>DummyPowerManagement</key>
\t\t\t${cpuArch === 'amd' ? '<true/>' : '<false/>'}
\t\t\t<key>MaxKernel</key>
\t\t\t<string></string>
\t\t\t<key>MinKernel</key>
\t\t\t<string></string>
\t\t</dict>`;

  // ── SMBIOS PlatformInfo ────────────────────────────────────────────────────
  const smbiosModel = (smbios && smbios.model) || 'iMacPro1,1';
  const smbiosSerial = (smbios && smbios.serial) || 'F5KZ50ZEZ512';
  const smbiosMlb = (smbios && smbios.mlb) || 'F5K931609QXFHDD1F';
  const smbiosUuid = (smbios && smbios.uuid) || '773E92B1-4A59-4509-B2FE-41CE9297298B';

  // ── Assemble full plist ────────────────────────────────────────────────────
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- OpenCore config.plist -->
<!-- Generated by Dortania Planner on ${new Date().toISOString()} -->
<!-- Hardware Profile: CPU=${cpuArch.toUpperCase()} | SMBIOS=${smbiosModel} -->
<plist version="1.0">
<dict>
\t<key>ACPI</key>
\t<dict>
\t\t<key>Add</key>
\t\t<array>
${acpiAddXml.trimEnd()}
\t\t</array>
\t\t<key>Delete</key>
\t\t<array/>
\t\t<key>Patch</key>
\t\t<array/>
\t\t<key>Quirks</key>
\t\t<dict>
\t\t\t<key>FadtEnableAccess</key>
\t\t\t<false/>
\t\t\t<key>NormalizeHeaders</key>
\t\t\t<false/>
\t\t\t<key>RebaseRegions</key>
\t\t\t<false/>
\t\t\t<key>ResetHwSig</key>
\t\t\t<false/>
\t\t\t<key>ResetLogoStatus</key>
\t\t\t<false/>
\t\t\t<key>SyncTableIds</key>
\t\t\t<false/>
\t\t</dict>
\t</dict>
\t<key>Booter</key>
\t<dict>
\t\t<key>MmioWhitelist</key>
\t\t<array/>
\t\t<key>Patch</key>
\t\t<array/>
\t\t<key>Quirks</key>
\t\t<dict>
${serializeQuirksDict(booterQuirks)}
\t\t</dict>
\t</dict>
\t<key>DeviceProperties</key>
\t<dict>
${serializeDeviceProperties(deviceProperties)}
\t</dict>
\t<key>Kernel</key>
\t<dict>
\t\t<key>Add</key>
\t\t<array>
${kernelAddXml.trimEnd()}
\t\t</array>
\t\t<key>Block</key>
\t\t<array/>
${cpuidEmulateXml}
\t\t<key>Force</key>
\t\t<array/>
\t\t<key>Patch</key>
\t\t<array/>
\t\t<key>Quirks</key>
\t\t<dict>
${serializeQuirksDict(kernelQuirks)}
\t\t</dict>
\t\t<key>Scheme</key>
\t\t<dict>
\t\t\t<key>CustomKernel</key>
\t\t\t<false/>
\t\t\t<key>FuzzyMatch</key>
\t\t\t<true/>
\t\t\t<key>KernelArch</key>
\t\t\t<string>Auto</string>
\t\t\t<key>KernelCache</key>
\t\t\t<string>Auto</string>
\t\t</dict>
\t</dict>
\t<key>Misc</key>
\t<dict>
\t\t<key>BlessOverride</key>
\t\t<array/>
\t\t<key>Boot</key>
\t\t<dict>
\t\t\t<key>ConsoleAttributes</key>
\t\t\t<integer>0</integer>
\t\t\t<key>HibernateMode</key>
\t\t\t<string>None</string>
\t\t\t<key>HibernateSkipsPicker</key>
\t\t\t<false/>
\t\t\t<key>HideAuxiliary</key>
\t\t\t<true/>
\t\t\t<key>InstanceIdentifier</key>
\t\t\t<string></string>
\t\t\t<key>LauncherOption</key>
\t\t\t<string>Disabled</string>
\t\t\t<key>LauncherPath</key>
\t\t\t<string>Default</string>
\t\t\t<key>PickerAttributes</key>
\t\t\t<integer>17</integer>
\t\t\t<key>PickerAudioAssist</key>
\t\t\t<false/>
\t\t\t<key>PickerMode</key>
\t\t\t<string>External</string>
\t\t\t<key>PickerVariant</key>
\t\t\t<string>Acidanthera\\Syrah</string>
\t\t\t<key>PollAppleHotKeys</key>
\t\t\t<false/>
\t\t\t<key>ShowPicker</key>
\t\t\t<true/>
\t\t\t<key>TakeoffDelay</key>
\t\t\t<integer>0</integer>
\t\t\t<key>Timeout</key>
\t\t\t<integer>5</integer>
\t\t</dict>
\t\t<key>Debug</key>
\t\t<dict>
\t\t\t<key>AppleDebug</key>
\t\t\t<true/>
\t\t\t<key>ApplePanic</key>
\t\t\t<true/>
\t\t\t<key>DisableWatchDog</key>
\t\t\t<true/>
\t\t\t<key>DisplayDelay</key>
\t\t\t<integer>0</integer>
\t\t\t<key>DisplayLevel</key>
\t\t\t<integer>2147483650</integer>
\t\t\t<key>LogModules</key>
\t\t\t<string>*</string>
\t\t\t<key>SysReport</key>
\t\t\t<false/>
\t\t\t<key>Target</key>
\t\t\t<integer>3</integer>
\t\t</dict>
\t\t<key>Entries</key>
\t\t<array/>
\t\t<key>Security</key>
\t\t<dict>
\t\t\t<key>AllowSetDefault</key>
\t\t\t<true/>
\t\t\t<key>ApECID</key>
\t\t\t<integer>0</integer>
\t\t\t<key>AuthRestart</key>
\t\t\t<false/>
\t\t\t<key>BlacklistAppleUpdate</key>
\t\t\t<true/>
\t\t\t<key>DmgLoading</key>
\t\t\t<string>Signed</string>
\t\t\t<key>EnablePassword</key>
\t\t\t<false/>
\t\t\t<key>ExposeSensitiveData</key>
\t\t\t<integer>6</integer>
\t\t\t<key>HaltLevel</key>
\t\t\t<integer>2147483648</integer>
\t\t\t<key>PasswordHash</key>
\t\t\t<data></data>
\t\t\t<key>PasswordSalt</key>
\t\t\t<data></data>
\t\t\t<key>ScanPolicy</key>
\t\t\t<integer>0</integer>
\t\t\t<key>SecureBootModel</key>
\t\t\t<string>Default</string>
\t\t\t<key>Vault</key>
\t\t\t<string>Optional</string>
\t\t</dict>
\t\t<key>Tools</key>
\t\t<array>
\t\t\t<dict>
\t\t\t\t<key>Arguments</key>
\t\t\t\t<string></string>
\t\t\t\t<key>Auxiliary</key>
\t\t\t\t<true/>
\t\t\t\t<key>Comment</key>
\t\t\t\t<string>OpenCore Shell</string>
\t\t\t\t<key>Enabled</key>
\t\t\t\t<true/>
\t\t\t\t<key>Flavour</key>
\t\t\t\t<string>OpenShell:UEFI</string>
\t\t\t\t<key>FullPath</key>
\t\t\t\t<false/>
\t\t\t\t<key>Name</key>
\t\t\t\t<string>OpenShell.efi</string>
\t\t\t\t<key>Path</key>
\t\t\t\t<string>OpenShell.efi</string>
\t\t\t\t<key>RealPath</key>
\t\t\t\t<false/>
\t\t\t\t<key>TextMode</key>
\t\t\t\t<false/>
\t\t\t</dict>
\t\t</array>
\t</dict>
\t<key>NVRAM</key>
\t<dict>
\t\t<key>Add</key>
\t\t<dict>
\t\t\t<key>7C436110-AB2A-4BBB-A880-FE41995C9F82</key>
\t\t\t<dict>
\t\t\t\t<key>boot-args</key>
\t\t\t\t<string>${bootArgs}</string>
\t\t\t\t<key>csr-active-config</key>
\t\t\t\t<data>AAAAAA==</data>
\t\t\t\t<key>prev-lang:kbd</key>
\t\t\t\t<data>ZXMtRVM6OA==</data>
\t\t\t\t<key>run-efi-updater</key>
\t\t\t\t<string>No</string>
\t\t\t</dict>
\t\t</dict>
\t\t<key>Delete</key>
\t\t<dict/>
\t\t<key>LegacyOverwrite</key>
\t\t<false/>
\t\t<key>WriteFlash</key>
\t\t<true/>
\t\t<key>LegacySchema</key>
\t\t<dict/>
\t</dict>
\t<key>PlatformInfo</key>
\t<dict>
\t\t<key>Automatic</key>
\t\t<true/>
\t\t<key>CustomMemory</key>
\t\t<false/>
\t\t<key>Generic</key>
\t\t<dict>
\t\t\t<key>AdviseFeatures</key>
\t\t\t<false/>
\t\t\t<key>MaxBIOSVersion</key>
\t\t\t<false/>
\t\t\t<key>MLB</key>
\t\t\t<string>${smbiosMlb}</string>
\t\t\t<key>ProcessorType</key>
\t\t\t<integer>0</integer>
\t\t\t<key>ROM</key>
\t\t\t<data>ESIzRFVm</data>
\t\t\t<key>SpoofVendor</key>
\t\t\t<true/>
\t\t\t<key>SystemMemoryStatus</key>
\t\t\t<string>Auto</string>
\t\t\t<key>SystemProductName</key>
\t\t\t<string>${smbiosModel}</string>
\t\t\t<key>SystemSerialNumber</key>
\t\t\t<string>${smbiosSerial}</string>
\t\t\t<key>SystemUUID</key>
\t\t\t<string>${smbiosUuid}</string>
\t\t</dict>
\t\t<key>UpdateDataHub</key>
\t\t<true/>
\t\t<key>UpdateNVRAM</key>
\t\t<true/>
\t\t<key>UpdateSMBIOS</key>
\t\t<true/>
\t\t<key>UpdateSMBIOSMode</key>
\t\t<string>Create</string>
\t\t<key>UseRawUuidEncoding</key>
\t\t<false/>
\t</dict>
\t<key>UEFI</key>
\t<dict>
\t\t<key>APFS</key>
\t\t<dict>
\t\t\t<key>EnableJumpstart</key>
\t\t\t<true/>
\t\t\t<key>GlobalConnect</key>
\t\t\t<false/>
\t\t\t<key>HideVerbose</key>
\t\t\t<true/>
\t\t\t<key>JumpstartHotPlug</key>
\t\t\t<false/>
\t\t\t<key>MinDate</key>
\t\t\t<integer>0</integer>
\t\t\t<key>MinVersion</key>
\t\t\t<integer>0</integer>
\t\t</dict>
\t\t<key>AppleInput</key>
\t\t<dict>
\t\t\t<key>AppleEvent</key>
\t\t\t<string>Builtin</string>
\t\t\t<key>CustomDelays</key>
\t\t\t<false/>
\t\t\t<key>GraphicsInputMirror</key>
\t\t\t<true/>
\t\t\t<key>KeyInitialDelay</key>
\t\t\t<integer>50</integer>
\t\t\t<key>KeySubsequentDelay</key>
\t\t\t<integer>5</integer>
\t\t\t<key>PointerDwellClickTimeout</key>
\t\t\t<integer>0</integer>
\t\t\t<key>PointerDwellDoubleClickTimeout</key>
\t\t\t<integer>0</integer>
\t\t\t<key>PointerDwellClickRadius</key>
\t\t\t<integer>0</integer>
\t\t\t<key>PointerPercentPhysDouble</key>
\t\t\t<integer>5</integer>
\t\t\t<key>PointerSpeedDiv</key>
\t\t\t<integer>1</integer>
\t\t\t<key>PointerSpeedMul</key>
\t\t\t<integer>1</integer>
\t\t</dict>
\t\t<key>Audio</key>
\t\t<dict>
\t\t\t<key>AudioCodec</key>
\t\t\t<integer>0</integer>
\t\t\t<key>AudioDevice</key>
\t\t\t<string>PciRoot(0x0)/Pci(0x1b,0x0)</string>
\t\t\t<key>AudioOutMask</key>
\t\t\t<integer>1</integer>
\t\t\t<key>AudioSupport</key>
\t\t\t<false/>
\t\t\t<key>DisconnectHda</key>
\t\t\t<false/>
\t\t\t<key>MaximumGain</key>
\t\t\t<integer>-15</integer>
\t\t\t<key>MinimumAssistGain</key>
\t\t\t<integer>-30</integer>
\t\t\t<key>MinimumAudibleGain</key>
\t\t\t<integer>-55</integer>
\t\t\t<key>PlayChime</key>
\t\t\t<string>Auto</string>
\t\t\t<key>ResetTrafficClass</key>
\t\t\t<false/>
\t\t\t<key>SetupDelay</key>
\t\t\t<integer>0</integer>
\t\t</dict>
\t\t<key>ConnectDrivers</key>
\t\t<true/>
\t\t<key>Drivers</key>
\t\t<array>
\t\t\t<dict>
\t\t\t\t<key>Arguments</key>
\t\t\t\t<string></string>
\t\t\t\t<key>Comment</key>
\t\t\t\t<string>HFS+ Filesystem Driver</string>
\t\t\t\t<key>Enabled</key>
\t\t\t\t<true/>
\t\t\t\t<key>LoadEarly</key>
\t\t\t\t<false/>
\t\t\t\t<key>Path</key>
\t\t\t\t<string>HfsPlus.efi</string>
\t\t\t</dict>
\t\t\t<dict>
\t\t\t\t<key>Arguments</key>
\t\t\t\t<string></string>
\t\t\t\t<key>Comment</key>
\t\t\t\t<string>Runtime Services</string>
\t\t\t\t<key>Enabled</key>
\t\t\t\t<true/>
\t\t\t\t<key>LoadEarly</key>
\t\t\t\t<false/>
\t\t\t\t<key>Path</key>
\t\t\t\t<string>OpenRuntime.efi</string>
\t\t\t</dict>
\t\t\t<dict>
\t\t\t\t<key>Arguments</key>
\t\t\t\t<string></string>
\t\t\t\t<key>Comment</key>
\t\t\t\t<string>Graphical Boot Picker</string>
\t\t\t\t<key>Enabled</key>
\t\t\t\t<true/>
\t\t\t\t<key>LoadEarly</key>
\t\t\t\t<false/>
\t\t\t\t<key>Path</key>
\t\t\t\t<string>OpenCanopy.efi</string>
\t\t\t</dict>
\t\t</array>
\t\t<key>Input</key>
\t\t<dict>
\t\t\t<key>KeyFiltering</key>
\t\t\t<false/>
\t\t\t<key>KeyForgetThreshold</key>
\t\t\t<integer>5</integer>
\t\t\t<key>KeySupport</key>
\t\t\t<true/>
\t\t\t<key>KeySupportMode</key>
\t\t\t<string>Auto</string>
\t\t\t<key>KeySwap</key>
\t\t\t<false/>
\t\t\t<key>PointerSupport</key>
\t\t\t<false/>
\t\t\t<key>PointerSupportMode</key>
\t\t\t<string>ASUS</string>
\t\t\t<key>TimerResolution</key>
\t\t\t<integer>50000</integer>
\t\t</dict>
\t\t<key>Output</key>
\t\t<dict>
\t\t\t<key>ClearScreenOnModeSwitch</key>
\t\t\t<false/>
\t\t\t<key>ConsoleFont</key>
\t\t\t<string></string>
\t\t\t<key>ConsoleMode</key>
\t\t\t<string></string>
\t\t\t<key>DirectGopRendering</key>
\t\t\t<false/>
\t\t\t<key>ForceResolution</key>
\t\t\t<false/>
\t\t\t<key>GopBurstMode</key>
\t\t\t<false/>
\t\t\t<key>GopPassThrough</key>
\t\t\t<string>Disabled</string>
\t\t\t<key>IgnoreTextInGraphics</key>
\t\t\t<false/>
\t\t\t<key>InitialMode</key>
\t\t\t<string>Auto</string>
\t\t\t<key>ProvideConsoleGop</key>
\t\t\t<true/>
\t\t\t<key>ReconnectGraphicsOnConnect</key>
\t\t\t<false/>
\t\t\t<key>ReconnectOnResChange</key>
\t\t\t<false/>
\t\t\t<key>ReplaceTabWithSpace</key>
\t\t\t<false/>
\t\t\t<key>Resolution</key>
\t\t\t<string>Max</string>
\t\t\t<key>SanitiseClearScreen</key>
\t\t\t<false/>
\t\t\t<key>TextRenderer</key>
\t\t\t<string>BuiltinGraphics</string>
\t\t\t<key>UIScale</key>
\t\t\t<integer>-1</integer>
\t\t</dict>
\t\t<key>ProtocolOverrides</key>
\t\t<dict>
\t\t\t<key>AppleAudio</key>
\t\t\t<false/>
\t\t\t<key>AppleBootPolicy</key>
\t\t\t<false/>
\t\t\t<key>AppleDebugLog</key>
\t\t\t<false/>
\t\t\t<key>AppleEg2Info</key>
\t\t\t<false/>
\t\t\t<key>AppleFramebufferInfo</key>
\t\t\t<false/>
\t\t\t<key>AppleImageConversion</key>
\t\t\t<false/>
\t\t\t<key>AppleImg4Verification</key>
\t\t\t<false/>
\t\t\t<key>AppleKeyMap</key>
\t\t\t<false/>
\t\t\t<key>AppleRtcRam</key>
\t\t\t<false/>
\t\t\t<key>AppleSecureBoot</key>
\t\t\t<false/>
\t\t\t<key>AppleSmcIo</key>
\t\t\t<false/>
\t\t\t<key>AppleUserInterfaceTheme</key>
\t\t\t<false/>
\t\t\t<key>DataHub</key>
\t\t\t<false/>
\t\t\t<key>DeviceProperties</key>
\t\t\t<false/>
\t\t\t<key>FirmwareVolume</key>
\t\t\t<true/>
\t\t\t<key>HashServices</key>
\t\t\t<false/>
\t\t\t<key>OSInfo</key>
\t\t\t<false/>
\t\t\t<key>PciIo</key>
\t\t\t<false/>
\t\t\t<key>UnicodeCollation</key>
\t\t\t<false/>
\t\t</dict>
\t\t<key>Quirks</key>
\t\t<dict>
\t\t\t<key>ActivateHpetSupport</key>
\t\t\t<false/>
\t\t\t<key>DisableSecurityPolicy</key>
\t\t\t<false/>
\t\t\t<key>EnableVectorAcceleration</key>
\t\t\t<true/>
\t\t\t<key>EnableVmx</key>
\t\t\t<false/>
\t\t\t<key>ExitBootServicesDelay</key>
\t\t\t<integer>0</integer>
\t\t\t<key>ForceOcWriteFlash</key>
\t\t\t<false/>
\t\t\t<key>ForgeUefiSupport</key>
\t\t\t<false/>
\t\t\t<key>IgnoreInvalidFlexRatio</key>
\t\t\t<false/>
\t\t\t<key>ReleaseUsbOwnership</key>
\t\t\t<false/>
\t\t\t<key>ReloadOptionRoms</key>
\t\t\t<false/>
\t\t\t<key>RequestBootVarRouting</key>
\t\t\t<true/>
\t\t\t<key>ResizeGpuBars</key>
\t\t\t<integer>-1</integer>
\t\t\t<key>TscSyncTimeout</key>
\t\t\t<integer>0</integer>
\t\t\t<key>UnblockFsConnect</key>
\t\t\t<false/>
\t\t</dict>
\t\t<key>ReservedMemory</key>
\t\t<array/>
\t</dict>
</dict>
</plist>`;
}
