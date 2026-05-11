#!/usr/bin/env python3
"""
สคริปต์สำหรับดาวน์โหลดรูปและไฟล์จาก OneDrive มาเก็บในเครื่อง
แล้วลบออกจาก OneDrive เพื่อประหยัดพื้นที่
"""
import os
import sys
import requests
import json
from pathlib import Path
from datetime import datetime

# ตั้งค่า
MATON_API_KEY = os.environ.get('MATON_API_KEY', '')  # ต้องตั้งค่าใน environment variable
ONEDRIVE_CONNECTION_ID = '5ede5238-487d-44f2-b146-3de025335451'
ONEDRIVE_MEDIA_PATH = '/Apps/remotely-save/Makatoon/LINE-Media'
LOCAL_OBSIDIAN_PATH = r'C:\Users\YourUsername\Documents\Obsidian\Makatoon\LINE-Media'  # แก้ไขเป็น path จริง

# นามสกุลไฟล์ที่ไม่ต้องการดาวน์โหลด (วิดีโอ)
SKIP_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.flv', '.webm']

# นามสกุลไฟล์ที่ต้องการดาวน์โหลด (รูป + ไฟล์)
DOWNLOAD_EXTENSIONS = [
    # รูปภาพ
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
    # เอกสาร
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt',
    # อื่นๆ
    '.zip', '.rar', '.7z',
]

def get_headers():
    """สร้าง headers สำหรับ Maton API"""
    return {
        'Authorization': f'Bearer {MATON_API_KEY}',
        'Maton-Connection': ONEDRIVE_CONNECTION_ID,
    }

def list_onedrive_items(path):
    """ดึงรายการไฟล์จาก OneDrive ในโฟลเดอร์ที่กำหนด"""
    url = f'https://api.maton.ai/one-drive/v1.0/me/drive/root:{path}:/children'
    try:
        response = requests.get(url, headers=get_headers())
        if response.status_code == 404:
            print(f"โฟลเดอร์ {path} ไม่มีอยู่")
            return []
        response.raise_for_status()
        data = response.json()
        return data.get('value', [])
    except Exception as e:
        print(f"Error listing items: {e}")
        return []

def list_all_media_files():
    """ค้นหาไฟล์ทั้งหมดในโฟลเดอร์ LINE-Media รวมทั้ง subfolder"""
    all_files = []

    # ดึงรายการโฟลเดอร์วันที่
    date_folders = list_onedrive_items(ONEDRIVE_MEDIA_PATH)

    for folder in date_folders:
        if folder.get('folder'):
            folder_name = folder['name']
            folder_path = f"{ONEDRIVE_MEDIA_PATH}/{folder_name}"
            print(f"กำลังตรวจสอบโฟลเดอร์: {folder_name}")

            # ดึงไฟล์ในโฟลเดอร์วันที่
            files = list_onedrive_items(folder_path)
            for file in files:
                if file.get('file'):
                    file['parentPath'] = folder_path
                    file['dateFolder'] = folder_name
                    all_files.append(file)

    return all_files

def should_download_file(filename):
    """ตรวจสอบว่าควรดาวน์โหลดไฟล์นี้หรือไม่"""
    name_lower = filename.lower()

    # ข้าม video files
    for ext in SKIP_EXTENSIONS:
        if name_lower.endswith(ext):
            return False

    return True

def download_file(file_item):
    """ดาวน์โหลดไฟล์จาก OneDrive"""
    try:
        file_id = file_item['id']
        filename = file_item['name']
        date_folder = file_item.get('dateFolder', 'unknown')

        if not should_download_file(filename):
            print(f"⏭️  ข้าม: {filename} (เป็นวิดีโอ)")
            return None

        # สร้างโฟลเดอร์ local ถ้ายังไม่มี
        local_date_folder = Path(LOCAL_OBSIDIAN_PATH) / date_folder
        local_date_folder.mkdir(parents=True, exist_ok=True)

        local_file_path = local_date_folder / filename

        # ถ้าไฟล์มีอยู่แล้ว ข้ามไป
        if local_file_path.exists():
            print(f"✓ มีอยู่แล้ว: {date_folder}/{filename}")
            return local_file_path

        # ดาวน์โหลดไฟล์
        download_url = f"https://api.maton.ai/one-drive/v1.0/me/drive/items/{file_id}/content"
        print(f"⬇️  กำลังดาวน์โหลด: {date_folder}/{filename}")

        response = requests.get(download_url, headers=get_headers(), stream=True)
        response.raise_for_status()

        # บันทึกไฟล์
        with open(local_file_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        file_size = local_file_path.stat().st_size
        print(f"✅ สำเร็จ: {date_folder}/{filename} ({file_size:,} bytes)")
        return local_file_path

    except Exception as e:
        print(f"❌ Error downloading {filename}: {e}")
        return None

def delete_from_onedrive(file_item):
    """ลบไฟล์จาก OneDrive"""
    try:
        file_id = file_item['id']
        filename = file_item['name']
        date_folder = file_item.get('dateFolder', 'unknown')

        delete_url = f"https://api.maton.ai/one-drive/v1.0/me/drive/items/{file_id}"
        response = requests.delete(delete_url, headers=get_headers())

        if response.status_code in [200, 204]:
            print(f"🗑️  ลบแล้ว: {date_folder}/{filename} จาก OneDrive")
            return True
        else:
            print(f"⚠️  ลบไม่สำเร็จ: {date_folder}/{filename} (status: {response.status_code})")
            return False

    except Exception as e:
        print(f"❌ Error deleting {filename}: {e}")
        return False

def main():
    """ฟังก์ชันหลัก"""
    print("=" * 70)
    print("🔄 เริ่มต้น Sync OneDrive → Obsidian")
    print(f"⏰ เวลา: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # ตรวจสอบ API Key
    if not MATON_API_KEY:
        print("❌ Error: MATON_API_KEY ไม่ได้ตั้งค่า")
        print("กรุณาตั้งค่า environment variable:")
        print('  set MATON_API_KEY=your_api_key_here')
        sys.exit(1)

    # ตรวจสอบโฟลเดอร์ local
    if 'YourUsername' in LOCAL_OBSIDIAN_PATH:
        print("❌ Error: กรุณาแก้ไข LOCAL_OBSIDIAN_PATH ในสคริปต์")
        print(f"   ปัจจุบัน: {LOCAL_OBSIDIAN_PATH}")
        sys.exit(1)

    # สร้างโฟลเดอร์ local ถ้ายังไม่มี
    Path(LOCAL_OBSIDIAN_PATH).mkdir(parents=True, exist_ok=True)

    # ดึงรายการไฟล์ทั้งหมด
    print("\n📂 กำลังค้นหาไฟล์...")
    all_files = list_all_media_files()
    print(f"   พบไฟล์ทั้งหมด: {len(all_files)} ไฟล์")

    if not all_files:
        print("✨ ไม่มีไฟล์ใหม่")
        return

    # ดาวน์โหลดและลบไฟล์
    print("\n" + "=" * 70)
    downloaded = 0
    deleted = 0
    skipped = 0

    for file_item in all_files:
        filename = file_item['name']

        # ดาวน์โหลด
        local_path = download_file(file_item)

        if local_path is None:
            skipped += 1
            continue

        downloaded += 1

        # ลบจาก OneDrive ถ้าดาวน์โหลดสำเร็จ
        if local_path.exists():
            if delete_from_onedrive(file_item):
                deleted += 1

    # สรุปผล
    print("\n" + "=" * 70)
    print("📊 สรุปผลการทำงาน:")
    print(f"   ✅ ดาวน์โหลดสำเร็จ: {downloaded} ไฟล์")
    print(f"   🗑️  ลบจาก OneDrive: {deleted} ไฟล์")
    print(f"   ⏭️  ข้าม (วิดีโอ/มีอยู่แล้ว): {skipped} ไฟล์")
    print("=" * 70)
    print(f"⏰ เสร็จสิ้น: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

if __name__ == '__main__':
    main()
