# Dortania Hardware Checker Diagnostic Script
# Runs secure, read-only WMI / CIM queries to extract exact specifications for Hackintosh analysis.
# Outputs structured JSON.

$output = @{
    CPU = $null
    GPU = @()
    Motherboard = $null
    Storage = @()
    Network = @()
}

# 1. CPU Detection
try {
    $cpuRaw = Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1 Name, Manufacturer, NumberOfCores, NumberOfLogicalProcessors
    if ($cpuRaw) {
        $output.CPU = @{
            Name = $cpuRaw.Name.Trim()
            Manufacturer = $cpuRaw.Manufacturer
            Cores = $cpuRaw.NumberOfCores
            Threads = $cpuRaw.NumberOfLogicalProcessors
        }
    } else {
        $output.CPU = @{ Name = "Unknown CPU" }
    }
} catch {
    $output.CPU = @{ Name = "Unknown CPU"; Error = $_.Exception.Message }
}

# 2. GPU Detection
try {
    $gpus = Get-CimInstance -ClassName Win32_VideoController | Select-Object Name, PNPDeviceID, DriverVersion
    foreach ($gpu in $gpus) {
        $ven = ""
        $dev = ""
        # Parse PNPDeviceID (e.g. PCI\VEN_1002&DEV_73FF&...)
        if ($gpu.PNPDeviceID -match "VEN_([0-9A-Fa-f]{4})") { $ven = $Matches[1].ToUpper() }
        if ($gpu.PNPDeviceID -match "DEV_([0-9A-Fa-f]{4})") { $dev = $Matches[1].ToUpper() }
        
        $output.GPU += @{
            Name = $gpu.Name
            PNPDeviceID = $gpu.PNPDeviceID
            VendorID = $ven
            DeviceID = $dev
            DriverVersion = $gpu.DriverVersion
        }
    }
} catch {
    # Fallback to empty list
}

# 3. Motherboard Detection
try {
    $board = Get-CimInstance -ClassName Win32_BaseBoard | Select-Object Manufacturer, Product
    if ($board) {
        $output.Motherboard = @{
            Manufacturer = $board.Manufacturer.Trim()
            Product = $board.Product.Trim()
        }
    } else {
        $output.Motherboard = @{
            Manufacturer = "Unknown"
            Product = "Unknown Motherboard"
        }
    }
} catch {
    $output.Motherboard = @{ Manufacturer = "Unknown"; Product = "Unknown Motherboard"; Error = $_.Exception.Message }
}

# 4. Storage Detection
try {
    # Try using Get-PhysicalDisk (standard on modern Win8/10/11)
    $disks = Get-PhysicalDisk | Select-Object DeviceId, Model, MediaType, FriendlyName, Size
    foreach ($disk in $disks) {
        $mediaType = "SSD"
        if ($disk.MediaType -eq "HDD") { $mediaType = "HDD" }
        elseif ($disk.MediaType -eq "Unspecified") {
            # Try to guess from name
            if ($disk.Model -like "*SSD*" -or $disk.Model -like "*NVMe*" -or $disk.Model -like "*Flash*") {
                $mediaType = "SSD"
            } else {
                $mediaType = "Unspecified"
            }
        } else {
            $mediaType = $disk.MediaType
        }

        $output.Storage += @{
            Model = $disk.Model.Trim()
            MediaType = $mediaType
            FriendlyName = $disk.FriendlyName.Trim()
            SizeGB = [Math]::Round($disk.Size / 1GB, 2)
        }
    }
} catch {
    # Fallback to Win32_DiskDrive
    try {
        $disksObj = Get-CimInstance -ClassName Win32_DiskDrive | Select-Object Model, Size, InterfaceType
        foreach ($disk in $disksObj) {
            $mediaType = "HDD"
            if ($disk.Model -like "*SSD*" -or $disk.Model -like "*NVMe*" -or $disk.InterfaceType -eq "SCSI") {
                $mediaType = "SSD"
            }
            $output.Storage += @{
                Model = $disk.Model.Trim()
                MediaType = $mediaType
                FriendlyName = $disk.Model.Trim()
                SizeGB = [Math]::Round($disk.Size / 1GB, 2)
            }
        }
    } catch {}
}

# 5. Network Adapters (Ethernet & Wi-Fi)
try {
    $adapters = Get-NetAdapter -Physical | Select-Object Name, InterfaceDescription, DeviceID, Speed
    foreach ($adapter in $adapters) {
        $pnpId = ""
        $ven = ""
        $dev = ""
        try {
            $netClass = Get-CimInstance -ClassName Win32_NetworkAdapter | Where-Object { $_.DeviceID -eq $adapter.DeviceID } | Select-Object -First 1 PNPDeviceID
            if ($netClass) {
                $pnpId = $netClass.PNPDeviceID
                if ($pnpId -match "VEN_([0-9A-Fa-f]{4})") { $ven = $Matches[1].ToUpper() }
                if ($pnpId -match "DEV_([0-9A-Fa-f]{4})") { $dev = $Matches[1].ToUpper() }
            }
        } catch {}

        $type = "Ethernet"
        if ($adapter.InterfaceDescription -like "*Wireless*" -or $adapter.InterfaceDescription -like "*Wi-Fi*" -or $adapter.InterfaceDescription -like "*802.11*" -or $adapter.InterfaceDescription -like "*WLAN*") {
            $type = "Wi-Fi"
        }

        $output.Network += @{
            Name = $adapter.Name
            Description = $adapter.InterfaceDescription
            DeviceID = $adapter.DeviceID
            PNPDeviceID = $pnpId
            VendorID = $ven
            DeviceIDAttr = $dev
            Type = $type
        }
    }
} catch {
    # Fallback to WMI if Get-NetAdapter is unavailable
    try {
        $adaptersObj = Get-CimInstance -ClassName Win32_NetworkAdapter | Where-Object { $_.PhysicalAdapter -eq $true } | Select-Object Name, Description, DeviceID, PNPDeviceID
        foreach ($adapter in $adaptersObj) {
            $ven = ""
            $dev = ""
            if ($adapter.PNPDeviceID -match "VEN_([0-9A-Fa-f]{4})") { $ven = $Matches[1].ToUpper() }
            if ($adapter.PNPDeviceID -match "DEV_([0-9A-Fa-f]{4})") { $dev = $Matches[1].ToUpper() }

            $type = "Ethernet"
            if ($adapter.Description -like "*Wireless*" -or $adapter.Description -like "*Wi-Fi*" -or $adapter.Description -like "*802.11*" -or $adapter.Description -like "*WLAN*") {
                $type = "Wi-Fi"
            }

            $output.Network += @{
                Name = $adapter.Name
                Description = $adapter.Description
                DeviceID = $adapter.DeviceID
                PNPDeviceID = $adapter.PNPDeviceID
                VendorID = $ven
                DeviceIDAttr = $dev
                Type = $type
            }
        }
    } catch {}
}

# 6. Bluetooth Detection
try {
    # Bluetooth controllers typically map in Win32_PnPEntity under the Bluetooth device class
    $btDevices = Get-CimInstance -ClassName Win32_PnPEntity | Where-Object { $_.PNPClass -eq "Bluetooth" -or $_.Name -like "*Bluetooth*" } | Select-Object Name, PNPDeviceID, Manufacturer
    foreach ($bt in $btDevices) {
        # Exclude software enumerators and virtual interfaces
        if ($bt.Name -like "*Enumerator*" -or $bt.Name -like "*LE*" -or $bt.Name -like "*Device*" -or $bt.Name -like "*Virtual*") { continue }
        
        $ven = ""
        $dev = ""
        if ($bt.PNPDeviceID -match "VEN_([0-9A-Fa-f]{4})") { $ven = $Matches[1].ToUpper() }
        if ($bt.PNPDeviceID -match "DEV_([0-9A-Fa-f]{4})") { $dev = $Matches[1].ToUpper() }

        $output.Network += @{
            Name = $bt.Name
            Description = $bt.Name
            DeviceID = ""
            PNPDeviceID = $bt.PNPDeviceID
            VendorID = $ven
            DeviceIDAttr = $dev
            Type = "Bluetooth"
        }
    }
} catch {}

$output | ConvertTo-Json -Depth 5
