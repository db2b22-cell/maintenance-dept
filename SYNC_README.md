# คู่มือการใช้งาน OneDrive to Obsidian Sync

สคริปต์นี้ใช้สำหรับดาวน์โหลดรูปภาพและไฟล์จาก OneDrive มาเก็บในเครื่อง (Obsidian) และลบออกจาก OneDrive อัตโนมัติเพื่อประหยัดพื้นที่

## ความต้องการ

1. **Python 3.7+** - [ดาวน์โหลด](https://www.python.org/downloads/)
   - ติดตั้งแล้วต้องเลือก "Add Python to PATH"
2. **Maton API Key** - หาได้จาก [https://maton.ai/settings](https://maton.ai/settings)
3. **OneDrive Connection** - ต้องเชื่อมต่อ OneDrive กับ Maton แล้ว

## วิธีติดตั้ง

### 1. ดาวน์โหลดไฟล์

```bash
# Clone repository
git clone https://github.com/db2b22-cell/maintenance-dept.git
cd maintenance-dept
```

หรือดาวน์โหลดไฟล์ 2 ไฟล์นี้:
- `sync_onedrive_to_obsidian.py`
- `sync_onedrive.bat`

### 2. ตั้งค่า API Key

**วิธีที่ 1: ตั้งค่าถาวร (แนะนำ)**

1. กด `Win + R` แล้วพิมพ์ `sysdm.cpl` กด Enter
2. เลือกแท็บ **Advanced** → **Environment Variables**
3. ในส่วน **User variables** กด **New**
4. ตั้งค่า:
   - Variable name: `MATON_API_KEY`
   - Variable value: `your_api_key_here`
5. กด OK ทุกหน้าต่าง
6. **รีสตาร์ท Command Prompt หรือ PowerShell**

**วิธีที่ 2: ตั้งค่าชั่วคราว (ต้องตั้งทุกครั้งที่เปิด cmd ใหม่)**

```batch
set MATON_API_KEY=your_api_key_here
```

### 3. แก้ไข Path ของ Obsidian

เปิดไฟล์ `sync_onedrive_to_obsidian.py` แก้ไขบรรทัดนี้:

```python
LOCAL_OBSIDIAN_PATH = r'C:\Users\YourUsername\Documents\Obsidian\Makatoon\LINE-Media'
```

เปลี่ยนเป็น path จริงของคุณ เช่น:

```python
LOCAL_OBSIDIAN_PATH = r'C:\Users\อุดมชัย\Documents\Obsidian\Makatoon\LINE-Media'
```

## วิธีใช้งาน

### รันด้วย Batch File (ง่ายที่สุด)

ดับเบิลคลิกที่ `sync_onedrive.bat` หรือเปิด Command Prompt แล้วรัน:

```batch
sync_onedrive.bat
```

### รันด้วย Python โดยตรง

```batch
python sync_onedrive_to_obsidian.py
```

### ตั้งเวลาให้รันอัตโนมัติ (Windows Task Scheduler)

1. เปิด **Task Scheduler** (กด Win + R แล้วพิมพ์ `taskschd.msc`)
2. กด **Create Basic Task**
3. ตั้งชื่อ: "OneDrive Sync"
4. Trigger: **Daily** เวลา 15:30 (ก่อนปิดเครื่อง)
5. Action: **Start a program**
   - Program: `C:\Python39\python.exe` (path ของ Python)
   - Arguments: `sync_onedrive_to_obsidian.py`
   - Start in: `C:\path\to\maintenance-dept` (โฟลเดอร์ที่เก็บสคริปต์)
6. Finish

## การทำงานของสคริปต์

1. ✅ **ค้นหาไฟล์** - ค้นหาไฟล์ทั้งหมดใน OneDrive `/Apps/remotely-save/Makatoon/LINE-Media`
2. ⬇️ **ดาวน์โหลด** - ดาวน์โหลดรูปภาพและไฟล์ (ยกเว้นวิดีโอ)
3. 💾 **บันทึก** - เก็บในโฟลเดอร์ Obsidian บนเครื่อง
4. 🗑️ **ลบ** - ลบไฟล์ออกจาก OneDrive หลังดาวน์โหลดสำเร็จ
5. ⏭️ **ข้าม** - ข้ามไฟล์วิดีโอและไฟล์ที่มีอยู่แล้ว

## ไฟล์ที่จะดาวน์โหลด

✅ **รูปภาพ**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`, `.svg`

✅ **เอกสาร**: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.txt`

✅ **ไฟล์อื่นๆ**: `.zip`, `.rar`, `.7z`

❌ **วิดีโอ**: `.mp4`, `.mov`, `.avi`, `.mkv`, `.m4v`, `.wmv`, `.flv`, `.webm` (ไม่ดาวน์โหลด)

## ตัวอย่างผลลัพธ์

```
======================================================================
🔄 เริ่มต้น Sync OneDrive → Obsidian
⏰ เวลา: 2026-05-11 15:30:00
======================================================================

📂 กำลังค้นหาไฟล์...
กำลังตรวจสอบโฟลเดอร์: 2026-05-11
   พบไฟล์ทั้งหมด: 7 ไฟล์

======================================================================
⬇️  กำลังดาวน์โหลด: 2026-05-11/image_613457334722888055.jpg
✅ สำเร็จ: 2026-05-11/image_613457334722888055.jpg (245,832 bytes)
🗑️  ลบแล้ว: 2026-05-11/image_613457334722888055.jpg จาก OneDrive

⬇️  กำลังดาวน์โหลด: 2026-05-11/image_613457388175360171.jpg
✅ สำเร็จ: 2026-05-11/image_613457388175360171.jpg (189,456 bytes)
🗑️  ลบแล้ว: 2026-05-11/image_613457388175360171.jpg จาก OneDrive

...

======================================================================
📊 สรุปผลการทำงาน:
   ✅ ดาวน์โหลดสำเร็จ: 7 ไฟล์
   🗑️  ลบจาก OneDrive: 7 ไฟล์
   ⏭️  ข้าม (วิดีโอ/มีอยู่แล้ว): 0 ไฟล์
======================================================================
⏰ เสร็จสิ้น: 2026-05-11 15:30:45
======================================================================
```

## แก้ปัญหา

### ❌ Error: MATON_API_KEY ไม่ได้ตั้งค่า

ตรวจสอบว่าตั้งค่า Environment Variable แล้วหรือยัง (ดูวิธีที่ 1 ข้างบน)

หรือรันคำสั่งนี้ก่อน:
```batch
set MATON_API_KEY=your_api_key_here
```

### ❌ Error: กรุณาแก้ไข LOCAL_OBSIDIAN_PATH

แก้ไขบรรทัด `LOCAL_OBSIDIAN_PATH` ในไฟล์ `sync_onedrive_to_obsidian.py` ให้เป็น path จริงของคุณ

### ❌ Python ไม่ได้ติดตั้ง

ดาวน์โหลดและติดตั้ง Python จาก [python.org](https://www.python.org/downloads/)

อย่าลืมเลือก **"Add Python to PATH"** ตอนติดตั้ง

### ❌ ModuleNotFoundError: No module named 'requests'

รันคำสั่ง:
```batch
pip install requests
```

## หมายเหตุ

- สคริปต์จะ**ไม่**ลบไฟล์ที่อยู่บนเครื่องของคุณ จะลบเฉพาะบน OneDrive เท่านั้น
- ถ้าเครื่องปิดตอนกำลังดาวน์โหลด ครั้งถัดไปจะดาวน์โหลดต่อจากตรงที่ค้าง
- ไฟล์ที่ดาวน์โหลดแล้วจะถูกข้ามไปโดยอัตโนมัติ

## ติดต่อ

หากมีปัญหาหรือข้อสงสัย ติดต่อ: support@maton.ai
