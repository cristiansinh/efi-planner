// Dortania Hackintosh Compatibility Ruleset Database
// Based on Wireless Buyers Guide, GPU Buyers Guide, and OpenCore Desktop Guides.

export const compatibilityDb = {
  gpus: {
    amd: [
      {
        name: "Navi 23 (RX 6600, RX 6600 XT, RX 6600M, RX 6650 XT)",
        status: "native",
        note: "Natively supported since macOS Monterey 12.1. Extremely compatible and recommended. Requires boot-arg: agdpmod=pikera.",
        devices: ["73FF", "73E3"]
      },
      {
        name: "Navi 21 (RX 6800, RX 6800 XT, RX 6900 XT, RX 6950 XT)",
        status: "native",
        note: "Natively supported since macOS Big Sur 11.4. Note: RX 6900/6950 XT might require DeviceID spoofing to 73BF depending on core variant. Requires boot-arg: agdpmod=pikera.",
        devices: ["73BF"]
      },
      {
        name: "Navi 22 (RX 6700, RX 6700 XT, RX 6750 XT)",
        status: "incompatible",
        note: "Completely unsupported in macOS. There are no drivers for Navi 22. You must use an alternative GPU or disable this GPU in macOS.",
        devices: ["73DF"]
      },
      {
        name: "RDNA3 / Navi 3x (RX 7600, RX 7700, RX 7800, RX 7900 XT/XTX)",
        status: "incompatible",
        note: "Completely unsupported. macOS Apple Silicon transition occurred before RDNA3 support was added.",
        devices: ["744C", "7440", "7441", "743C"]
      },
      {
        name: "Navi 10 (RX 5700, RX 5700 XT, RX 5600, RX 5600 XT)",
        status: "native",
        note: "Natively supported since macOS Catalina 10.15.1. Requires boot-arg: agdpmod=pikera.",
        devices: ["731F"]
      },
      {
        name: "Navi 14 (RX 5500, RX 5500 XT, RX 5300)",
        status: "native",
        note: "Natively supported since macOS Catalina 10.15.2. Requires boot-arg: agdpmod=pikera.",
        devices: ["7340"]
      },
      {
        name: "Polaris 10/20/30 (RX 470, RX 480, RX 570, RX 580, RX 590)",
        status: "native",
        note: "Natively supported. Extremely reliable. Note: Models like XFX, MSI Armor, or PowerColor might have VBIOS issues; some require flashing a standard VBIOS.",
        devices: ["67DF"]
      },
      {
        name: "Polaris 11/21 (RX 460, RX 560, RX 560D)",
        status: "native",
        note: "Natively supported. Ideal for budget/low-profile Hackintoshes.",
        devices: ["67EF"]
      },
      {
        name: "Polaris 12 (RX 550, RX 540)",
        status: "config",
        note: "Only supported if card is based on Lexa core. Requires spoofing to Baffin/Polaris 11 ID. Non-Lexa RX 550s (e.g. 640 shaders) are native but Lexa core needs configuration.",
        devices: ["699F"]
      },
      {
        name: "Vega 10/20 (Radeon RX Vega 56, Vega 64, Radeon VII)",
        status: "native",
        note: "Natively supported. High performance but power-hungry. No special boot-args needed, though Radeon VII runs best with specific power profiles.",
        devices: ["687F", "66AF"]
      }
    ],
    nvidia: [
      {
        name: "Ada Lovelace (RTX 4090, 4080, 4070, 4060, 4050)",
        status: "incompatible",
        note: "Completely unsupported. No drivers exist in any macOS version. You must use CPU integrated graphics or an AMD dGPU.",
        vendors: ["10DE"]
      },
      {
        name: "Ampere (RTX 3090, 3080, 3070, 3060, 3050)",
        status: "incompatible",
        note: "Completely unsupported. No drivers exist in any macOS version.",
        vendors: ["10DE"]
      },
      {
        name: "Turing (RTX 2080, 2070, 2060, GTX 1660, 1650)",
        status: "incompatible",
        note: "Completely unsupported. No drivers exist in any macOS version.",
        vendors: ["10DE"]
      },
      {
        name: "Pascal (GTX 1080/Ti, 1070/Ti, 1060, 1050/Ti)",
        status: "incompatible",
        note: "Only supported up to macOS High Sierra (10.13.6) using Nvidia Web Drivers. Incompatible with modern macOS (Mojave to Sequoia).",
        vendors: ["10DE"]
      },
      {
        name: "Kepler (GTX 780, 770, 760, GT 710, GT 730)",
        status: "config",
        note: "Natively supported up to macOS Big Sur. Support dropped in Monterey. Can be patched to work on macOS Monterey/Ventura/Sonoma/Sequoia using OpenCore Legacy Patcher (OCLP) Root Patches.",
        vendors: ["10DE"]
      }
    ],
    intel: [
      {
        name: "UHD 630 / HD 630 (Coffee Lake / Comet Lake - 8th-10th Gen)",
        status: "native",
        note: "Fully supported. Requires WhateverGreen.kext and proper AAPL,ig-platform-id device property injection in config.plist.",
        vendors: ["8086"]
      },
      {
        name: "Iris Plus Graphics (Ice Lake - 10th Gen Mobile)",
        status: "native",
        note: "Fully supported on mobile. Requires WhateverGreen and proper framebuffer configurations.",
        vendors: ["8086"]
      },
      {
        name: "Intel Xe Graphics (Rocket Lake / Alder Lake / Raptor Lake - 11th-14th Gen)",
        status: "incompatible",
        note: "Completely unsupported in macOS. Intel Xe architecture has no driver support. You must use a dedicated AMD GPU.",
        vendors: ["8086"]
      }
    ]
  },
  ssds: [
    {
      modelMatch: ["PM981", "PM991", "MZVLB", "MZVGW"],
      brand: "Samsung OEM",
      status: "incompatible",
      note: "Samsung PM981 and PM991 OEM NVMe drives are notorious for causing kernel panics, TRIM-induced lockups, and installation failures. Strongly recommended to replace with a WD, Crucial, or Sabrent drive, or disable using an SSDT/spoof."
    },
    {
      modelMatch: ["980"],
      brand: "Samsung Retail",
      status: "config",
      note: "Samsung 980 (Non-Pro) uses a DRAM-less controller that has known compatibility issues with macOS TRIM commands, leading to very slow boot times. Requires NVMeFix.kext or setting SetApfsTrimTimeout=0 in config.plist."
    },
    {
      modelMatch: ["970 EVO Plus", "970 EvoPlus"],
      brand: "Samsung Retail",
      status: "config",
      note: "Samsung 970 EVO Plus is highly compatible BUT requires a firmware update. Older firmware versions cause boot loops and install failures. Ensure firmware is updated via Samsung Magician before installation."
    },
    {
      modelMatch: ["Micron 2200"],
      brand: "Micron",
      status: "incompatible",
      note: "Micron 2200 NVMe drives are completely incompatible, causing frequent kernel panics and SSD write locks. Must be replaced or disabled."
    },
    {
      modelMatch: ["A2000", "A1000"],
      brand: "Kingston",
      status: "config",
      note: "Kingston NVMe SSDs generally work but are known to experience high power consumption or boot lags without NVMeFix.kext."
    },
    {
      modelMatch: ["Intel 600p", "Intel 660p"],
      brand: "Intel",
      status: "config",
      note: "Compatible but suffers from performance issues in macOS. Requires NVMeFix.kext for proper power management and sleep stability."
    },
    {
      modelMatch: ["WD Blue SN550", "WD Black SN750", "WD Black SN850", "Crucial P3", "Crucial P5 Plus", "Sabrent Rocket"],
      brand: "Recommended Brands",
      status: "native",
      note: "Highly compatible and recommended SSD models. Standard TRIM support functions properly under macOS. NVMeFix.kext recommended but not strictly required."
    }
  ],
  wireless: [
    {
      vendorId: "14E4", // Broadcom
      chipsetMatch: ["BCM94360", "BCM94352", "BCM943224"],
      status: "config",
      note: "Broadcom cards were natively supported. However, Apple dropped support for Broadcom Wi-Fi in macOS Sonoma (14.0). Requires injecting IOSkywalkFamily.kext, IO80211FamilyLegacy.kext, and applying Root Patches via OpenCore Legacy Patcher (OCLP)."
    },
    {
      vendorId: "8086", // Intel
      chipsetMatch: ["AX211", "AX210", "AX201", "AX200", "AC9560", "AC9260", "AC8265", "AC7265", "AC3168"],
      status: "config",
      note: "Supported via OpenIntelWireless community drivers. Requires AirportItlwm.kext (Wi-Fi) and IntelBluetoothFirmware.kext + IntelBTPatcher.kext + BlueToolFixup.kext (Bluetooth). Highly stable on Ventura/Sonoma."
    },
    {
      vendorId: "14C3", // MediaTek
      chipsetMatch: ["MT7921", "MT7922"],
      status: "incompatible",
      note: "MediaTek Wi-Fi/Bluetooth chipsets have no stable or complete driver support in macOS. You will need to replace the Wi-Fi card with an Intel or Broadcom model, or use an external USB dongle."
    },
    {
      vendorId: "10EC", // Realtek
      chipsetMatch: ["RTL8821", "RTL8822", "RTL8723"],
      status: "incompatible",
      note: "Realtek PCI Wi-Fi chips are unsupported in macOS. Realtek Ethernet works, but Wi-Fi/Bluetooth does not. Replace with an Intel or Broadcom PCIe card."
    }
  ],
  ethernet: [
    {
      vendorId: "8086", // Intel
      deviceMatch: ["1539", "15B8", "15F3", "125C"], // i211, i219, i225, i226
      status: "config",
      note: "Intel controllers are highly compatible. i219 requires IntelMausi.kext. i225-V/i226-V (2.5G) require AppleIntelI210Ethernet.kext injection on older macOS, or boot-arg 'e1000=0' on Big Sur/Monterey/Ventura."
    },
    {
      vendorId: "10EC", // Realtek
      deviceMatch: ["8168", "8111", "8125"],
      status: "native",
      note: "Realtek controllers are fully supported. 1GbE (RTL8111) requires RealtekRTL8111.kext. 2.5GbE (RTL8125) requires LucyRTL8125Ethernet.kext."
    },
    {
      vendorId: "1D6A", // Aquantia
      deviceMatch: ["D107", "07B1"], // AQC107, AQC113
      status: "config",
      note: "Aquantia 10GbE controllers are supported. AQC107 is natively supported since Mojave (may need npci=0x2000 boot-arg). AQC113 requires patches in config.plist on Big Sur/Monterey/Ventura."
    }
  ]
};
