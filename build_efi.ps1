# Dortania EFI Folder Builder & Downloader Script
# Natively downloads OpenCorePkg base, SSDTs, and Kexts on Windows using PowerShell.

Param(
    [Parameter(Mandatory=$true)]
    [string]$TargetFolder,
    [Parameter(Mandatory=$true)]
    [string]$SsdtsJson, # JSON array of SSDT names, e.g. '["SSDT-AWAC.aml","SSDT-EC-USBX.aml"]'
    [Parameter(Mandatory=$true)]
    [string]$KextsJson  # JSON array of Kext names, e.g. '["Lilu.kext","VirtualSMC.kext"]'
)

$ErrorActionPreference = "Stop"

# Helper for logging to stdout
function Log-Status($message, $type="default") {
    $time = Get-Date -Format "HH:mm:ss"
    Write-Output "[$type] [$time] $message"
}

try {
    # 1. Parse inputs
    $selectedSsdts = $SsdtsJson | ConvertFrom-Json
    $selectedKexts = $KextsJson | ConvertFrom-Json

    Log-Status "Iniciando la construcción de estructura EFI en: $TargetFolder" "system"

    # 2. Establish directory hierarchy
    $efiPath = Join-Path $TargetFolder "EFI"
    $bootPath = Join-Path $efiPath "BOOT"
    $ocPath = Join-Path $efiPath "OC"
    $acpiPath = Join-Path $ocPath "ACPI"
    $driversPath = Join-Path $ocPath "Drivers"
    $kextsPath = Join-Path $ocPath "Kexts"
    $resourcesPath = Join-Path $ocPath "Resources"
    
    $tempPath = Join-Path $env:TEMP "DortaniaEfiBuilder"
    if (Test-Path $tempPath) { Remove-Item -Path $tempPath -Recururse -Force -ErrorAction SilentlyContinue }
    New-Item -Path $tempPath -ItemType Directory -Force | Out-Null

    # Create target directories
    $folders = @($efiPath, $bootPath, $ocPath, $acpiPath, $driversPath, $kextsPath, $resourcesPath)
    foreach ($folder in $folders) {
        if (-not (Test-Path $folder)) {
            New-Item -Path $folder -ItemType Directory -Force | Out-Null
        }
    }

    Log-Status "Carpetas de estructura base creadas con éxito." "default"

    # 3. Download OpenCore base files (BOOTx64.efi, OpenCore.efi, OpenRuntime.efi, OpenCanopy.efi)
    $ocVersion = "1.0.3"
    $ocUrl = "https://github.com/acidanthera/OpenCorePkg/releases/download/$ocVersion/OpenCore-$ocVersion-RELEASE.zip"
    $ocZip = Join-Path $tempPath "OpenCore.zip"
    $ocExtract = Join-Path $tempPath "OpenCore"

    Log-Status "Descargando base de OpenCore v$ocVersion..." "default"
    try {
        Invoke-WebRequest -Uri $ocUrl -OutFile $ocZip -TimeoutSec 30
        Log-Status "Extrayendo base de OpenCore..." "default"
        Expand-Archive -Path $ocZip -DestinationPath $ocExtract -Force
        
        # Copy base files
        Copy-Item -Path (Join-Path $ocExtract "X64/EFI/BOOT/BOOTx64.efi") -Destination $bootPath -Force
        Copy-Item -Path (Join-Path $ocExtract "X64/EFI/OC/OpenCore.efi") -Destination $ocPath -Force
        Copy-Item -Path (Join-Path $ocExtract "X64/EFI/OC/Drivers/OpenRuntime.efi") -Destination $driversPath -Force
        Copy-Item -Path (Join-Path $ocExtract "X64/EFI/OC/Drivers/OpenCanopy.efi") -Destination $driversPath -Force
        Log-Status "Archivos base de OpenCore copiados." "success"
    } catch {
        Log-Status "ADVERTENCIA: No se pudo descargar OpenCorePkg. Creando placeholders." "warning"
        # Create placeholders
        New-Item -Path (Join-Path $bootPath "BOOTx64.efi") -ItemType File -Force | Out-Null
        New-Item -Path (Join-Path $ocPath "OpenCore.efi") -ItemType File -Force | Out-Null
        New-Item -Path (Join-Path $driversPath "OpenRuntime.efi") -ItemType File -Force | Out-Null
        New-Item -Path (Join-Path $driversPath "OpenCanopy.efi") -ItemType File -Force | Out-Null
        
        $readmeText = "No se pudieron descargar los binarios de OpenCorePkg debido a problemas de red.`nPor favor descarga la v$ocVersion RELEASE desde https://github.com/acidanthera/OpenCorePkg/releases y copia:`n- BOOTx64.efi a EFI/BOOT/`n- OpenCore.efi a EFI/OC/`n- OpenRuntime.efi y OpenCanopy.efi a EFI/OC/Drivers/"
        $readmeText | Out-File -FilePath (Join-Path $TargetFolder "LEEME_OPENCORE.txt") -Force
    }

    # Download HfsPlus.efi
    $hfsUrl = "https://github.com/acidanthera/OcBinaryData/raw/master/Drivers/HfsPlus.efi"
    $hfsDest = Join-Path $driversPath "HfsPlus.efi"
    Log-Status "Descargando controlador de archivos HfsPlus.efi..." "default"
    try {
        Invoke-WebRequest -Uri $hfsUrl -OutFile $hfsDest -TimeoutSec 15
        Log-Status "HfsPlus.efi instalado." "success"
    } catch {
        Log-Status "ADVERTENCIA: No se pudo descargar HfsPlus.efi. Creando placeholder." "warning"
        New-Item -Path $hfsDest -ItemType File -Force | Out-Null
    }

    # 4. Download selected SSDTs
    $ssdtSources = @{
        "SSDT-PLUG-ALT.aml" = "https://github.com/dortania/Getting-Started-With-ACPI/raw/master/extra-files/compiled/SSDT-PLUG-ALT.aml"
        "SSDT-AWAC.aml"     = "https://github.com/dortania/Getting-Started-With-ACPI/raw/master/extra-files/compiled/SSDT-AWAC.aml"
        "SSDT-EC-USBX.aml"  = "https://github.com/dortania/Getting-Started-With-ACPI/raw/master/extra-files/compiled/SSDT-EC-USBX-desktop.aml"
        "SSDT-PLUG.aml"     = "https://github.com/dortania/Getting-Started-With-ACPI/raw/master/extra-files/compiled/SSDT-PLUG-DRG.aml"
    }

    foreach ($ssdtName in $selectedSsdts) {
        $destFile = Join-Path $acpiPath $ssdtName
        if ($ssdtSources.ContainsKey($ssdtName)) {
            $url = $ssdtSources[$ssdtName]
            Log-Status "Descargando ACPI: $ssdtName..." "default"
            try {
                Invoke-WebRequest -Uri $url -OutFile $destFile -TimeoutSec 15
                Log-Status "ACPI $ssdtName copiado." "success"
            } catch {
                Log-Status "ADVERTENCIA: Falló la descarga de $ssdtName. Creando archivo vacío." "warning"
                New-Item -Path $destFile -ItemType File -Force | Out-Null
                "Falló la descarga. Descarga de $url y reemplaza este archivo." | Out-File -FilePath (Join-Path $acpiPath "$ssdtName.DESCARGAR.txt") -Force
            }
        } else {
            Log-Status "Creando placeholder para SSDT personalizado: $ssdtName..." "warning"
            New-Item -Path $destFile -ItemType File -Force | Out-Null
        }
    }

    # 5. Download and extract selected Kexts
    $kextSources = @{
        "Lilu.kext"             = "https://github.com/acidanthera/Lilu/releases/download/1.6.9/Lilu-1.6.9-RELEASE.zip"
        "VirtualSMC.kext"       = "https://github.com/acidanthera/VirtualSMC/releases/download/1.3.4/VirtualSMC-1.3.4-RELEASE.zip"
        "WhateverGreen.kext"    = "https://github.com/acidanthera/WhateverGreen/releases/download/1.6.8/WhateverGreen-1.6.8-RELEASE.zip"
        "AppleALC.kext"         = "https://github.com/acidanthera/AppleALC/releases/download/1.9.3/AppleALC-1.9.3-RELEASE.zip"
        "NVMeFix.kext"          = "https://github.com/acidanthera/NVMeFix/releases/download/1.1.2/NVMeFix-1.1.2-RELEASE.zip"
        "IntelMausi.kext"       = "https://github.com/acidanthera/IntelMausi/releases/download/1.0.8/IntelMausi-1.0.8-RELEASE.zip"
        "LucyRTL8125Ethernet.kext" = "https://github.com/Mieze/LucyRTL8125Ethernet/releases/download/1.2.0/LucyRTL8125Ethernet-v1.2.0.zip"
        "RealtekRTL8111.kext"   = "https://github.com/Mieze/RTL8111_driver_for_OS_X/releases/download/2.4.2/RealtekRTL8111-V2.4.2.zip"
        "AirportItlwm.kext"     = "https://github.com/OpenIntelWireless/itlwm/releases/download/v2.3.0/AirportItlwm-Sonoma-v2.3.0.zip"
        "IntelBluetoothFirmware.kext" = "https://github.com/OpenIntelWireless/IntelBluetoothFirmware/releases/download/v2.4.0/IntelBluetoothFirmware-v2.4.0.zip"
        "IntelBTPatcher.kext"   = "https://github.com/OpenIntelWireless/IntelBluetoothFirmware/releases/download/v2.4.0/IntelBluetoothFirmware-v2.4.0.zip"
        "BlueToolFixup.kext"    = "https://github.com/acidanthera/BrcmPatchRAM/releases/download/2.6.9/BrcmPatchRAM-2.6.9-RELEASE.zip"
        "BrcmPatchRAM3.kext"    = "https://github.com/acidanthera/BrcmPatchRAM/releases/download/2.6.9/BrcmPatchRAM-2.6.9-RELEASE.zip"
        "BrcmFirmwareData.kext"  = "https://github.com/acidanthera/BrcmPatchRAM/releases/download/2.6.9/BrcmPatchRAM-2.6.9-RELEASE.zip"
        "AirportBrcmFixup.kext" = "https://github.com/acidanthera/AirportBrcmFixup/releases/download/1.1.1/AirportBrcmFixup-1.1.1-RELEASE.zip"
        "AMDRyzenCPUPowerManagement.kext" = "https://github.com/trulyspinach/SMCAMDProcessor/releases/download/0.7.5/SMCAMDProcessor-0.7.5.zip"
        "SMCAMDProcessor.kext"  = "https://github.com/trulyspinach/SMCAMDProcessor/releases/download/0.7.5/SMCAMDProcessor-0.7.5.zip"
    }

    # Keep track of already downloaded URLs to avoid duplicate downloads (e.g. IntelBT and IntelBTPatcher are in the same zip)
    $downloadedZips = @{}

    foreach ($kextName in $selectedKexts) {
        $destKext = Join-Path $kextsPath $kextName
        
        if ($kextSources.ContainsKey($kextName)) {
            $url = $kextSources[$kextName]
            $zipName = [System.IO.Path]::GetFileName($url)
            $localZipPath = Join-Path $tempPath $zipName
            $extractFolder = Join-Path $tempPath ([System.IO.Path]::GetFileNameWithoutExtension($zipName))

            # Download if not already downloaded
            if (-not $downloadedZips.ContainsKey($url)) {
                Log-Status "Descargando Kext bundle de: $kextName..." "default"
                try {
                    Invoke-WebRequest -Uri $url -OutFile $localZipPath -TimeoutSec 30
                    $downloadedZips[$url] = $extractFolder
                    Log-Status "Extrayendo Kext bundle de $kextName..." "default"
                    Expand-Archive -Path $localZipPath -DestinationPath $extractFolder -Force
                } catch {
                    Log-Status "ADVERTENCIA: Falló la descarga de $kextName." "warning"
                    New-Item -Path $destKext -ItemType Directory -Force | Out-Null
                    "Descarga fallida de $url. Reemplaza esta carpeta con el kext real." | Out-File -FilePath (Join-Path $destKext "DESCARGAR.txt") -Force
                    continue
                }
            }

            # Locate and copy the Kext from the extracted directory
            $extractedFolder = $downloadedZips[$url]
            
            # Find the kext directory recursively
            $kextInExtract = Get-ChildItem -Path $extractedFolder -Filter $kextName -Recurse | Select-Object -First 1
            
            if ($kextInExtract) {
                Log-Status "Instalando Kext: $kextName..." "success"
                Copy-Item -Path $kextInExtract.FullName -Destination $kextsPath -Recurse -Force
            } else {
                Log-Status "ADVERTENCIA: No se pudo localizar $kextName en el archivo descargado. Creando placeholder." "warning"
                New-Item -Path $destKext -ItemType Directory -Force | Out-Null
            }

        } else {
            Log-Status "Creando placeholder para Kext personalizado: $kextName..." "warning"
            New-Item -Path $destKext -ItemType Directory -Force | Out-Null
        }
    }

    # Clean up temp files
    Remove-Item -Path $tempPath -Recurse -Force -ErrorAction SilentlyContinue

    Log-Status "Estructura de archivos EFI creada y descargada correctamente." "success"
    Log-Status "BUILD_COMPLETE_SUCCESS" "system"

} catch {
    Log-Status "ERROR CRÍTICO: $_" "error"
    Log-Status "BUILD_COMPLETE_FAILED" "system"
}
