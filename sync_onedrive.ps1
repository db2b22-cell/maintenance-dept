# sync_onedrive.ps1
# ดาวน์โหลดไฟล์จาก OneDrive มาเก็บที่เครื่อง แล้วลบออกจาก OneDrive
# ใช้ PowerShell - ไม่ต้องติดตั้งอะไรเพิ่ม

# ==================== ตั้งค่า ====================
$MATON_API_KEY = $env:MATON_API_KEY
$ONEDRIVE_CONNECTION_ID = "5ede5238-487d-44f2-b146-3de025335451"
$ONEDRIVE_MEDIA_PATH = "/Apps/remotely-save/Makatoon/LINE-Media"
$LOCAL_SAVE_PATH = "C:\Users\T.Udomchai\OneDrive\Makatoon\LINE-Media"  # <-- แก้ไขตรงนี้

# นามสกุลวิดีโอ - ข้ามไม่ดาวน์โหลด
$SKIP_EXTENSIONS = @(".mp4", ".mov", ".avi", ".mkv", ".m4v", ".wmv", ".flv", ".webm")
# =================================================

$headers = @{
    "Authorization" = "Bearer $MATON_API_KEY"
    "Maton-Connection" = $ONEDRIVE_CONNECTION_ID
}

function Get-OneDriveItems($path) {
    $url = "https://api.maton.ai/one-drive/v1.0/me/drive/root:${path}:/children"
    try {
        $res = Invoke-RestMethod -Uri $url -Headers $headers -Method GET
        return $res.value
    } catch {
        Write-Host "ไม่พบโฟลเดอร์: $path" -ForegroundColor Yellow
        return @()
    }
}

function Should-Download($filename) {
    $ext = [System.IO.Path]::GetExtension($filename).ToLower()
    return -not ($SKIP_EXTENSIONS -contains $ext)
}

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "  OneDrive -> เครื่องคอม Sync" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

if (-not $MATON_API_KEY) {
    Write-Host "ERROR: ไม่พบ MATON_API_KEY" -ForegroundColor Red
    Write-Host "กรุณาตั้งค่า Environment Variable ชื่อ MATON_API_KEY ก่อนรัน" -ForegroundColor Red
    Read-Host "กด Enter เพื่อปิด"
    exit 1
}

# สร้างโฟลเดอร์ local ถ้ายังไม่มี
New-Item -ItemType Directory -Force -Path $LOCAL_SAVE_PATH | Out-Null

Write-Host "`nกำลังค้นหาไฟล์..." -ForegroundColor Yellow
$dateFolders = Get-OneDriveItems $ONEDRIVE_MEDIA_PATH
$downloaded = 0
$deleted = 0
$skipped = 0

foreach ($folder in $dateFolders) {
    if ($folder.folder) {
        $folderName = $folder.name
        $folderPath = "$ONEDRIVE_MEDIA_PATH/$folderName"
        Write-Host "โฟลเดอร์: $folderName"

        $files = Get-OneDriveItems $folderPath
        foreach ($file in $files) {
            if (-not $file.file) { continue }

            $filename = $file.name
            $fileId = $file.id

            # ข้ามวิดีโอ
            if (-not (Should-Download $filename)) {
                Write-Host "  [ข้าม] $filename (วิดีโอ)" -ForegroundColor Gray
                $skipped++
                continue
            }

            # สร้างโฟลเดอร์วันที่
            $localDir = Join-Path $LOCAL_SAVE_PATH $folderName
            New-Item -ItemType Directory -Force -Path $localDir | Out-Null
            $localFile = Join-Path $localDir $filename

            # ข้ามถ้ามีอยู่แล้ว
            if (Test-Path $localFile) {
                Write-Host "  [มีแล้ว] $filename" -ForegroundColor Gray
                $skipped++
                continue
            }

            # ดาวน์โหลด
            Write-Host "  [โหลด] $filename" -ForegroundColor Yellow
            try {
                $downloadUrl = "https://api.maton.ai/one-drive/v1.0/me/drive/items/${fileId}/content"
                Invoke-WebRequest -Uri $downloadUrl -Headers $headers -OutFile $localFile
                $size = (Get-Item $localFile).Length
                Write-Host "  [OK] $filename ($([math]::Round($size/1KB, 1)) KB)" -ForegroundColor Green
                $downloaded++

                # ลบออกจาก OneDrive
                $deleteUrl = "https://api.maton.ai/one-drive/v1.0/me/drive/items/${fileId}"
                Invoke-RestMethod -Uri $deleteUrl -Headers $headers -Method DELETE | Out-Null
                Write-Host "  [ลบ] $filename จาก OneDrive แล้ว" -ForegroundColor Magenta
                $deleted++

            } catch {
                Write-Host "  [ERROR] $filename - $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
}

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "สรุป:" -ForegroundColor Cyan
Write-Host "  ดาวน์โหลดสำเร็จ : $downloaded ไฟล์" -ForegroundColor Green
Write-Host "  ลบจาก OneDrive : $deleted ไฟล์" -ForegroundColor Magenta
Write-Host "  ข้าม           : $skipped ไฟล์" -ForegroundColor Gray
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "เสร็จสิ้น: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan

Read-Host "`nกด Enter เพื่อปิด"
