// System Hardware Analyzer for Dortania Guide Rulesets
import { compatibilityDb } from '../compatibilityDb.js';

export function analyzeHardware(systemData) {
  if (!systemData) return null;

  const report = {
    cpu: { status: 'unknown', name: 'Unknown', notes: '', arch: '', cpuidSpoof: null },
    gpus: [],
    storage: [],
    network: [],
    ssdts: [],
    kexts: ['Lilu.kext', 'VirtualSMC.kext'],
    bootArgs: ['-v', 'keepsyms=1', 'debug=0x100'],
    overallStatus: 'compatible' // compatible, config, incompatible
  };

  const hasIntelGpu = false;
  let hasNaviGpu = false;
  let hasModernIntelCpu = false; // 12th-14th Gen
  let cpuVendor = 'unknown';

  // 1. CPU Analysis
  if (systemData.CPU) {
    const cpuName = systemData.CPU.Name || '';
    report.cpu.name = cpuName;
    
    if (systemData.CPU.Manufacturer && systemData.CPU.Manufacturer.toLowerCase().includes('intel')) {
      cpuVendor = 'intel';
      report.cpu.arch = 'Intel Core';
      
      // Detect 12th, 13th, 14th Gen Intel CPUs (Alder Lake, Raptor Lake, Raptor Lake Refresh)
      // They require CPUID spoofing and are hybrid architectures (P-cores / E-cores)
      const isModernIntel = /i[3579]-(12|13|14)\d{3}/i.test(cpuName) || /Alder\s*Lake|Raptor\s*Lake/i.test(cpuName);
      
      if (isModernIntel) {
        hasModernIntelCpu = true;
        report.cpu.status = 'config';
        report.cpu.notes = "Intel 12th/13th/14th Gen (Alder Lake/Raptor Lake) requires CPUID Spoofing (spoofing as Comet Lake) because macOS lacks native support for hybrid architectures. Note that Alder/Raptor Lake integrated Xe graphics are completely incompatible; a dedicated AMD GPU is mandatory.";
        report.cpu.cpuidSpoof = {
          data: '55060A00 00000000 00000000 00000000',
          mask: 'FFFFFFFF 00000000 00000000 00000000',
          model: 'Comet Lake (0x0A0655)'
        };
        report.ssdts.push({
          name: 'SSDT-PLUG-ALT.aml',
          desc: 'Enables proper CPU power management/scheduling for Intel hybrid core architectures (Alder/Raptor Lake).',
          required: true
        });
        report.ssdts.push({
          name: 'SSDT-AWAC.aml',
          desc: 'Fixes system RTC clock conflict (disables AWAC and enables legacy RTC). Required for Intel 300 series chipsets and newer.',
          required: true
        });
        report.ssdts.push({
          name: 'SSDT-EC-USBX.aml',
          desc: 'Creates a fake Embedded Controller (EC) and injections USB power properties for correct USB charging/mapping.',
          required: true
        });
      } else {
        // Older Intel
        report.cpu.status = 'native';
        report.cpu.notes = "Natively supported Intel CPU. High compatibility. Integrated GPU might be supported depending on model (Skylake to Comet Lake).";
        
        report.ssdts.push({
          name: 'SSDT-PLUG.aml',
          desc: 'Enables native CPU power management (XCPM) starting from Haswell and newer.',
          required: true
        });
        
        // Match chipsets/generations for AWAC
        const requiresAwac = /i[3579]-[34567]/.test(cpuName) === false; // 8th Gen+ needs SSDT-AWAC
        if (requiresAwac) {
          report.ssdts.push({
            name: 'SSDT-AWAC.aml',
            desc: 'Fixes RTC clock conflict on Intel 300+ series motherboards.',
            required: true
          });
        }
        
        report.ssdts.push({
          name: 'SSDT-EC-USBX.aml',
          desc: 'Generates a fake EC device and controls USB power delivery.',
          required: true
        });
      }
    } else if (systemData.CPU.Manufacturer && systemData.CPU.Manufacturer.toLowerCase().includes('amd')) {
      cpuVendor = 'amd';
      report.cpu.arch = 'AMD Ryzen';
      report.cpu.status = 'config';
      report.cpu.notes = "AMD Ryzen CPUs work wonderfully in macOS using AMD-Vanilla kernel patches. However, features like virtual machines (AppleHV) and Adobe software require patches/workarounds. AMD APU integrated graphics are unsupported; a discrete AMD GPU is required.";
      
      report.kexts.push('AMDRyzenCPUPowerManagement.kext');
      report.kexts.push('SMCAMDProcessor.kext');
      
      report.ssdts.push({
        name: 'SSDT-EC-USBX.aml',
        desc: 'Generates fake Embedded Controller for AMD Ryzen systems to enable boot stability and USB power routing.',
        required: true
      });
    } else {
      report.cpu.notes = "Unknown CPU vendor. Ensure you verify compatibility manually.";
    }
  }

  // 2. GPU Analysis
  if (systemData.GPU && Array.isArray(systemData.GPU)) {
    systemData.GPU.forEach(gpu => {
      const gpuReport = {
        name: gpu.Name,
        vendorId: gpu.VendorID || '',
        deviceId: gpu.DeviceID || '',
        status: 'unknown',
        notes: ''
      };

      // Identify vendor
      if (gpuReport.vendorId === '1002') {
        // AMD
        const matchedRule = compatibilityDb.gpus.amd.find(r => 
          r.devices.includes(gpuReport.deviceId) || 
          gpu.Name.toLowerCase().includes('rx 66') || 
          gpu.Name.toLowerCase().includes('rx 68') || 
          gpu.Name.toLowerCase().includes('rx 69')
        );

        if (matchedRule) {
          gpuReport.status = matchedRule.status;
          gpuReport.notes = matchedRule.note;
          if (matchedRule.status === 'native') {
            report.kexts.push('WhateverGreen.kext');
            if (gpu.Name.includes('5000') || gpu.Name.includes('6000')) {
              hasNaviGpu = true;
            }
          }
        } else {
          // Check for AMD RDNA3 fallback
          if (gpu.Name.toLowerCase().includes('rx 7') || gpu.Name.toLowerCase().includes('rdna3')) {
            gpuReport.status = 'incompatible';
            gpuReport.notes = "RDNA3 GPUs (RX 7000 series) are not supported in any version of macOS.";
          } else {
            gpuReport.status = 'native';
            gpuReport.notes = "AMD GPU detected. Most AMD cards (Polaris/Vega/Navi) are natively supported in macOS. Make sure WhateverGreen.kext is installed.";
            report.kexts.push('WhateverGreen.kext');
          }
        }
      } else if (gpuReport.vendorId === '10DE') {
        // NVIDIA
        const isKepler = /GT\s*710|GT\s*730|GTX\s*760|GTX\s*770|GTX\s*780/i.test(gpu.Name);
        if (isKepler) {
          gpuReport.status = 'config';
          gpuReport.notes = "Nvidia Kepler card detected. Natively supported up to macOS Big Sur. Requires OpenCore Legacy Patcher (OCLP) root patches to run on Monterey/Sonoma/Sequoia.";
          report.kexts.push('WhateverGreen.kext');
        } else {
          gpuReport.status = 'incompatible';
          gpuReport.notes = "NVIDIA card (Turing/Ampere/Ada Lovelace) is completely incompatible with modern macOS. No drivers exist. Disable this card in macOS config.";
        }
      } else if (gpuReport.vendorId === '8086') {
        // Intel GPU
        if (hasModernIntelCpu) {
          gpuReport.status = 'incompatible';
          gpuReport.notes = "Intel Xe Integrated Graphics (11th-14th Gen) are not supported by macOS. You must use a discrete AMD GPU.";
        } else {
          gpuReport.status = 'native';
          gpuReport.notes = "Intel integrated graphics (HD 630 / UHD 630) are natively supported. Framebuffer patching in config.plist DeviceProperties is required.";
          report.kexts.push('WhateverGreen.kext');
        }
      }

      report.gpus.push(gpuReport);
    });
  }

  // Navi GPU boot args addition
  if (hasNaviGpu) {
    if (!report.bootArgs.includes('agdpmod=pikera')) {
      report.bootArgs.push('agdpmod=pikera');
    }
  }

  // 3. Storage Analysis
  if (systemData.Storage && Array.isArray(systemData.Storage)) {
    systemData.Storage.forEach(disk => {
      const diskReport = {
        model: disk.Model,
        mediaType: disk.MediaType || 'SSD',
        size: disk.SizeGB || 0,
        status: 'native',
        notes: 'Compatible. standard NVMe storage.'
      };

      // Match against SSD compatibility database
      let matched = false;
      compatibilityDb.ssds.forEach(rule => {
        const isMatch = rule.modelMatch.some(m => disk.Model.toUpperCase().includes(m.toUpperCase()));
        if (isMatch) {
          diskReport.status = rule.status;
          diskReport.notes = rule.note;
          matched = true;

          if (rule.status === 'config' || rule.status === 'incompatible') {
            if (!report.kexts.includes('NVMeFix.kext')) {
              report.kexts.push('NVMeFix.kext');
            }
          }
        }
      });

      if (!matched && diskReport.mediaType === 'SSD') {
        diskReport.notes = "Generic SSD detected. Generally compatible. Injecting NVMeFix.kext is recommended to stabilize power states and sleep cycles.";
        if (!report.kexts.includes('NVMeFix.kext')) {
          report.kexts.push('NVMeFix.kext');
        }
      }

      report.storage.push(diskReport);
    });
  }

  // 4. Network (Ethernet, Wi-Fi, BT) Analysis
  if (systemData.Network && Array.isArray(systemData.Network)) {
    systemData.Network.forEach(net => {
      const netReport = {
        name: net.Name,
        desc: net.Description || '',
        type: net.Type || 'Ethernet',
        vendorId: net.VendorID || '',
        deviceId: net.DeviceIDAttr || '',
        status: 'unknown',
        notes: ''
      };

      if (netReport.type === 'Ethernet') {
        // Intel Ethernet
        if (netReport.vendorId === '8086') {
          // i219, i211, i225-V, i226-V
          const is25G = /i225|i226|I225-V|I226-V/i.test(netReport.desc);
          if (is25G) {
            netReport.status = 'config';
            netReport.notes = "Intel 2.5G Ethernet controller (i225/i226). Natively supported starting from macOS Big Sur but requires boot-arg: e1000=0.";
            if (!report.bootArgs.includes('e1000=0')) {
              report.bootArgs.push('e1000=0');
            }
          } else {
            netReport.status = 'native';
            netReport.notes = "Intel 1GbE Ethernet controller. Works natively using IntelMausi.kext.";
            if (!report.kexts.includes('IntelMausi.kext')) {
              report.kexts.push('IntelMausi.kext');
            }
          }
        } else if (netReport.vendorId === '10EC') {
          // Realtek Ethernet
          const is25G = /8125|2.5G/i.test(netReport.desc);
          if (is25G) {
            netReport.status = 'native';
            netReport.notes = "Realtek 2.5G Ethernet controller. Fully supported. Requires LucyRTL8125Ethernet.kext.";
            if (!report.kexts.includes('LucyRTL8125Ethernet.kext')) {
              report.kexts.push('LucyRTL8125Ethernet.kext');
            }
          } else {
            netReport.status = 'native';
            netReport.notes = "Realtek Gigabit Ethernet controller. Fully supported. Requires RealtekRTL8111.kext.";
            if (!report.kexts.includes('RealtekRTL8111.kext')) {
              report.kexts.push('RealtekRTL8111.kext');
            }
          }
        } else if (netReport.vendorId === '1D6A') {
          // Aquantia
          netReport.status = 'config';
          netReport.notes = "Aquantia 10G Ethernet controller. Requires npci=0x2000 boot-arg or specific kernel patches in config.plist.";
          if (!report.bootArgs.includes('npci=0x2000')) {
            report.bootArgs.push('npci=0x2000');
          }
        } else {
          netReport.status = 'config';
          netReport.notes = "Unsupported or generic Ethernet controller. Third-party drivers may be required.";
        }
      } else if (netReport.type === 'Wi-Fi') {
        // Intel WiFi
        if (netReport.vendorId === '8086') {
          netReport.status = 'config';
          netReport.notes = "Intel Wireless chipset detected. Supported using the OpenIntelWireless community drivers. Requires AirportItlwm.kext.";
          if (!report.kexts.includes('AirportItlwm.kext')) {
            report.kexts.push('AirportItlwm.kext');
          }
        } else if (netReport.vendorId === '14E4') {
          // Broadcom WiFi
          netReport.status = 'config';
          netReport.notes = "Broadcom Wireless chipset detected. Requires OCLP root patches on macOS Sonoma/Sequoia. Requires AirportBrcmFixup.kext.";
          if (!report.kexts.includes('AirportBrcmFixup.kext')) {
            report.kexts.push('AirportBrcmFixup.kext');
          }
        } else {
          netReport.status = 'incompatible';
          netReport.notes = "MediaTek or Realtek Wi-Fi controller detected. Completely unsupported. You must replace the Wi-Fi card or use a compatible USB dongle.";
        }
      } else if (netReport.type === 'Bluetooth') {
        // Bluetooth
        if (netReport.vendorId === '8086') {
          netReport.status = 'config';
          netReport.notes = "Intel Bluetooth controller. Supported in macOS. Requires IntelBluetoothFirmware.kext, IntelBTPatcher.kext, and BlueToolFixup.kext.";
          const btKexts = ['IntelBluetoothFirmware.kext', 'IntelBTPatcher.kext', 'BlueToolFixup.kext'];
          btKexts.forEach(k => {
            if (!report.kexts.includes(k)) report.kexts.push(k);
          });
        } else if (netReport.vendorId === '14E4') {
          netReport.status = 'config';
          netReport.notes = "Broadcom Bluetooth controller. Requires BrcmPatchRAM3.kext, BrcmFirmwareData.kext, and BlueToolFixup.kext.";
          const btKexts = ['BrcmPatchRAM3.kext', 'BrcmFirmwareData.kext', 'BlueToolFixup.kext'];
          btKexts.forEach(k => {
            if (!report.kexts.includes(k)) report.kexts.push(k);
          });
        } else {
          netReport.status = 'incompatible';
          netReport.notes = "Unsupported Bluetooth controller.";
        }
      }

      report.network.push(netReport);
    });
  }

  // 5. Evaluate Overall Status
  let hasIncompatible = false;
  let hasRequiresConfig = false;

  if (report.cpu.status === 'incompatible') hasIncompatible = true;
  if (report.cpu.status === 'config') hasRequiresConfig = true;

  report.gpus.forEach(g => {
    if (g.status === 'incompatible') hasIncompatible = true;
    if (g.status === 'config') hasRequiresConfig = true;
  });

  report.storage.forEach(s => {
    // SSD incompatibilities (PM981) can be worked around if it is not the main OS drive, but let's label config
    if (s.status === 'incompatible') hasIncompatible = true;
    if (s.status === 'config') hasRequiresConfig = true;
  });

  report.network.forEach(n => {
    // Wi-Fi or Bluetooth incompatibility doesn't brick macOS (you can just run it without WiFi),
    // but Ethernet is crucial. We will label Wi-Fi incompatibility as a warning, but doesn't make the whole system incompatible.
    // If ethernet is incompatible, we mark it as config.
    if (n.status === 'incompatible' && n.type !== 'Wi-Fi' && n.type !== 'Bluetooth') {
      hasIncompatible = true;
    }
  });

  if (hasIncompatible) {
    report.overallStatus = 'incompatible';
  } else if (hasRequiresConfig) {
    report.overallStatus = 'config';
  } else {
    report.overallStatus = 'compatible';
  }

  // Standard OpenCore generic audio/usb boot args
  report.bootArgs.push('alcid=1'); // Default audio layout ID placeholder

  return report;
}
