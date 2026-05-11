# sync_onedrive.ps1 - Download files from OneDrive to local folder

$MATON_API_KEY = $env:MATON_API_KEY   # <-- Or replace with your key: "mk_xxx..."
$ONEDRIVE_CONNECTION_ID = "5ede5238-487d-44f2-b146-3de025335451"
$ONEDRIVE_MEDIA_PATH = "/Apps/remotely-save/Makatoon/LINE-Media"
$LOCAL_SAVE_PATH = "C:\script\LINE-Media"   # <-- Change this path

$SKIP_EXT = @(".mp4",".mov",".avi",".mkv",".m4v",".wmv",".flv",".webm")

$headers = @{
    "Authorization" = "Bearer $MATON_API_KEY"
    "Maton-Connection" = $ONEDRIVE_CONNECTION_ID
}

function Get-Items($path) {
    $url = "https://api.maton.ai/one-drive/v1.0/me/drive/root:" + $path + ":/children"
    try {
        $res = Invoke-RestMethod -Uri $url -Headers $headers -Method GET
        return $res.value
    } catch {
        return @()
    }
}

Write-Host "============================================"
Write-Host "  OneDrive Sync - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "============================================"

if (-not $MATON_API_KEY) {
    Write-Host "ERROR: MATON_API_KEY not set" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

New-Item -ItemType Directory -Force -Path $LOCAL_SAVE_PATH | Out-Null

Write-Host "Searching files..."
$dateFolders = Get-Items $ONEDRIVE_MEDIA_PATH
$downloaded = 0
$deleted = 0
$skipped = 0

foreach ($folder in $dateFolders) {
    if (-not $folder.folder) { continue }

    $folderName = $folder.name
    $folderPath = $ONEDRIVE_MEDIA_PATH + "/" + $folderName
    Write-Host "Folder: $folderName"

    $files = Get-Items $folderPath
    foreach ($file in $files) {
        if (-not $file.file) { continue }

        $filename = $file.name
        $fileId = $file.id
        $ext = [System.IO.Path]::GetExtension($filename).ToLower()

        if ($SKIP_EXT -contains $ext) {
            Write-Host "  [SKIP] $filename (video)" -ForegroundColor Gray
            $skipped++
            continue
        }

        $localDir = Join-Path $LOCAL_SAVE_PATH $folderName
        New-Item -ItemType Directory -Force -Path $localDir | Out-Null
        $localFile = Join-Path $localDir $filename

        if (Test-Path $localFile) {
            Write-Host "  [EXISTS] $filename" -ForegroundColor Gray
            $skipped++
            continue
        }

        Write-Host "  [DOWNLOAD] $filename" -ForegroundColor Yellow
        try {
            $dlUrl = "https://api.maton.ai/one-drive/v1.0/me/drive/items/" + $fileId + "/content"
            Invoke-WebRequest -Uri $dlUrl -Headers $headers -OutFile $localFile
            $size = [math]::Round((Get-Item $localFile).Length / 1KB, 1)
            Write-Host "  [OK] $filename ($size KB)" -ForegroundColor Green
            $downloaded++

            $delUrl = "https://api.maton.ai/one-drive/v1.0/me/drive/items/" + $fileId
            Invoke-RestMethod -Uri $delUrl -Headers $headers -Method DELETE | Out-Null
            Write-Host "  [DELETED from OneDrive] $filename" -ForegroundColor Magenta
            $deleted++

        } catch {
            Write-Host "  [ERROR] $filename" -ForegroundColor Red
        }
    }
}

Write-Host "============================================"
Write-Host "Downloaded : $downloaded files" -ForegroundColor Green
Write-Host "Deleted    : $deleted files" -ForegroundColor Magenta
Write-Host "Skipped    : $skipped files" -ForegroundColor Gray
Write-Host "============================================"
Read-Host "Press Enter to close"
