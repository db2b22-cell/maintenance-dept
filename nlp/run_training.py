"""
Thai Leave Classifier — PyThaiNLP + TF-IDF + SVM
- ใช้ PyThaiNLP ตัด token ภาษาไทย (Thai NLP library)
- TF-IDF vectorize
- LinearSVC classify
- เทรนเร็ว น้ำหนักเบา deploy ง่าย
"""
import os, json, pickle
from pythainlp.tokenize import word_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report
import numpy as np

SAVE_DIR = "/tmp/thai_leave_classifier"
os.makedirs(SAVE_DIR, exist_ok=True)

# ─── Training data ─────────────────────────────────────────────────────────
TRAIN_DATA = [
    # ลาป่วย
    ("วันนี้ไม่สบาย ขอลาป่วยนะครับ", 1),
    ("ป่วยอยู่ ไม่ได้มาทำงานครับ", 1),
    ("ลาป่วย 1 วันครับ", 1),
    ("ไม่สบายตัว ขอลาวันนี้นะ", 1),
    ("หัวร้อนไข้ขึ้น คงมาไม่ได้ครับ", 1),
    ("ป่วยหนักเลย ลาป่วยนะครับพี่", 1),
    ("ท้องเสียมาตั้งแต่เช้า ขอลาป่วยครับ", 1),
    ("ไม่สบาย ลาครึ่งวันบ่ายนะครับ", 1),
    ("ป่วยลาป่วยครับ", 1),
    ("วันนี้ไม่สบาย ขอหยุดสักวันนะ", 1),
    ("เป็นหวัด มาไม่ได้ครับ", 1),
    ("ปวดหัวมาก ขอลาป่วยวันนี้", 1),
    ("ป่วยอยู่บ้าน ขอลาครับ", 1),
    ("ไข้ขึ้น ลาป่วยนะ", 1),
    ("ร่างกายไม่ดี ขอพักครับ", 1),
    # ลากิจ
    ("มีธุระด่วน ขอลากิจวันนี้ครับ", 1),
    ("ติดธุระส่วนตัว ลาวันนี้ 1 วันครับ", 1),
    ("วันนี้ขอลากิจนะครับ มีเรื่องด่วน", 1),
    ("ลากิจครับ ไม่ได้มา", 1),
    ("มีธุระต้องไปทำ ขอลาวันนี้ด้วยนะครับ", 1),
    ("ติดธุระธนาคาร ขอลาครึ่งวันเช้าครับ", 1),
    ("ต้องไปต่อทะเบียนรถ ขอลากิจครึ่งวันนะครับ", 1),
    ("วันนี้ไม่ว่างมา ขอลาครับ", 1),
    ("มีธุระที่บ้าน ลากิจวันนี้ครับ", 1),
    ("ธุระด่วนครับ ขอลา", 1),
    # หาหมอ
    ("วันนี้มีนัดหมอ ขอลาครึ่งวันบ่ายนะครับ", 1),
    ("ต้องไปหาหมอ ลาวันนี้ครับ", 1),
    ("มีนัดพบแพทย์วันนี้ ขอลาครับ", 1),
    ("ไปโรงพยาบาล ลาป่วยวันนี้นะครับ", 1),
    ("นัดแพทย์เช้านี้ ขอลาครึ่งวันเช้าครับ", 1),
    ("ต้องพาแม่ไปหาหมอ ลากิจวันนี้ครับ", 1),
    ("มีนัดตรวจสุขภาพ ขอลาบ่ายนะ", 1),
    ("นัดหมอครับ ลา", 1),
    # ลาล่วงหน้า
    ("พรุ่งนี้ขอลาครับ", 1),
    ("วันที่ 15 ขอลาครับ", 1),
    ("อาทิตย์หน้าจะลา 2 วันครับ วันที่ 20-21", 1),
    ("แจ้งลาล่วงหน้าครับ วันที่ 10 ลาครับ", 1),
    ("มะรืนนี้ขอลากิจครับ", 1),
    ("สัปดาห์หน้าขอลาพักร้อน 3 วันครับ วันที่ 18-20", 1),
    ("ขอลาล่วงหน้าวันที่ 5 เดือนหน้าครับ", 1),
    ("พรุ่งนี้ไม่มานะครับ มีธุระ", 1),
    ("วันที่ 22 จะไม่มาครับ ลาไว้ก่อนนะ", 1),
    ("ขอลาพักร้อน 5 วัน ตั้งแต่วันที่ 1-5 เดือนหน้าครับ", 1),
    ("แจ้งลาพรุ่งนี้ครับ", 1),
    # ลาหลายวัน
    ("ลา 3 วันครับ ตั้งแต่วันนี้เลย", 1),
    ("ขอลา 2 วันนะครับ วันนี้กับพรุ่งนี้", 1),
    ("ไม่สบายหนัก ขอลาสักอาทิตย์นึงได้ไหมครับ", 1),
    ("ลาพักร้อน 7 วันครับ วันที่ 1-7", 1),
    # ยกเลิกลา
    ("มาแล้วนะครับ ยกเลิกลา", 1),
    ("หายป่วยแล้ว มาทำงานได้วันนี้ครับ", 1),
    ("ยกเลิกลาครับ มาได้ตามปกติ", 1),
    ("มาแล้วครับ ไม่ต้องลาแล้ว", 1),
    ("ดีขึ้นแล้ว เดี๋ยวมานะครับ", 1),
    ("มาได้แล้วครับ ยกเลิก", 1),
    # ลาพิเศษ
    ("ลาคลอดครับ จะหยุดตั้งแต่อาทิตย์หน้า", 1),
    ("ภรรยาคลอด ขอลากิจครับ", 1),
    ("ลาไปบวช 15 วันครับ", 1),
    ("ขอลาพักร้อนประจำปีครับ", 1),
    # ไม่มาสั้นๆ
    ("ไม่มาครับ", 1),
    ("วันนี้ไม่ได้มานะ", 1),
    ("ขาดงานวันนี้นะครับ", 1),
    ("ไม่มาวันนี้ครับ ขอโทษด้วยนะ", 1),
    ("มาไม่ได้ครับวันนี้", 1),
    ("ไม่ได้มาทำงานวันนี้นะครับ", 1),
    ("วันนี้หยุดครับ", 1),
    ("ไม่มาครับพี่", 1),
    # ─── label 0: ไม่เกี่ยวกับการลา ───────────────────────────────
    ("ดีครับพี่", 0),
    ("ขอบคุณครับ", 0),
    ("โอเคครับ", 0),
    ("รับทราบครับ", 0),
    ("เช็คงานให้หน่อยได้ไหมครับ", 0),
    ("อุปกรณ์ชำรุดครับ ต้องซ่อม", 0),
    ("ส่งงานเสร็จแล้วครับ", 0),
    ("ประชุมกี่โมงครับ", 0),
    ("วันนี้มีงานด่วนไหมครับ", 0),
    ("เครื่องจักรมีปัญหา แจ้งด่วนครับ", 0),
    ("สวัสดีครับทุกท่าน", 0),
    ("วันนี้อากาศร้อนมากเลย", 0),
    ("กินข้าวกันยัง", 0),
    ("ประชุมที่ห้องประชุมนะครับ", 0),
    ("งานเสร็จแล้วครับ", 0),
    ("ขอรายงานตัวครับ", 0),
    ("เข้าแถวได้เลยนะครับ", 0),
    ("ช่วยงานผมหน่อยได้ไหม", 0),
    ("อุปกรณ์ครบแล้วครับ", 0),
    ("ส่งเอกสารให้แล้วนะ", 0),
    ("555 ฮาเลย", 0),
    ("แอร์เสียชั้น 3 ครับ", 0),
    ("น้ำท่วมลานจอดรถ", 0),
    ("เจอกันเย็นนี้นะ", 0),
    ("งานพรุ่งนี้เสร็จแน่นอนครับ", 0),
    ("ระบบไฟฟ้าขัดข้อง", 0),
    ("ขอแจ้งว่าทำงานล่วงเวลาครับ", 0),
    ("โอทีวันนี้ครับ", 0),
    ("งานด่วนครับ ช่วยด้วย", 0),
    ("เดี๋ยวมาเช็คให้นะครับ", 0),
    ("ระบบเน็ตช้ามากเลยครับ", 0),
    ("ประตูโรงงานเปิดไม่ได้ครับ", 0),
    ("ของมาแล้วครับ เซ็นรับได้เลย", 0),
    ("ลืมบัตรไว้ที่บ้าน", 0),
    ("มาถึงแล้วครับ", 0),
    ("กำลังเดินทางมาครับ", 0),
    ("ช้าหน่อยนะครับ ติดรถ", 0),
    ("มาสายนิดหน่อยครับ", 0),
    ("ทำโอทีถึงดึกครับ", 0),
    ("เปิดไฟโรงงานด้วยนะครับ", 0),
    ("งานซ่อมเสร็จแล้วครับ", 0),
]

print(f"Total samples: {len(TRAIN_DATA)}")
print(f"  Leave (1): {sum(1 for _,l in TRAIN_DATA if l==1)}")
print(f"  Other (0): {sum(1 for _,l in TRAIN_DATA if l==0)}")

# ─── Thai tokenizer ─────────────────────────────────────────────────────────
def thai_tokenize(text):
    """ตัดคำภาษาไทยด้วย PyThaiNLP แล้วรวม token ด้วย space"""
    tokens = word_tokenize(text, engine="newmm", keep_whitespace=False)
    return " ".join(tokens)

print("\nTokenizing ...")
texts  = [thai_tokenize(t) for t,_ in TRAIN_DATA]
labels = [l for _,l in TRAIN_DATA]

# ─── TF-IDF + SVM ───────────────────────────────────────────────────────────
tr_texts, ev_texts, tr_labels, ev_labels = train_test_split(
    texts, labels, test_size=0.2, random_state=42, stratify=labels)

vectorizer = TfidfVectorizer(
    ngram_range=(1, 2),   # unigram + bigram
    min_df=1,
    sublinear_tf=True,
)
X_train = vectorizer.fit_transform(tr_texts)
X_eval  = vectorizer.transform(ev_texts)

# CalibratedClassifierCV เพื่อให้ได้ probability score
base_clf = LinearSVC(C=1.0, max_iter=5000)
clf = CalibratedClassifierCV(base_clf, cv=3)
clf.fit(X_train, tr_labels)

# ─── Evaluate ────────────────────────────────────────────────────────────────
y_pred = clf.predict(X_eval)
print("\n─── Evaluation ───")
print(classification_report(ev_labels, y_pred, target_names=["other", "leave"]))

cv_scores = cross_val_score(
    CalibratedClassifierCV(LinearSVC(C=1.0, max_iter=5000), cv=3),
    vectorizer.transform(texts), labels, cv=5, scoring="f1"
)
print(f"5-fold CV F1 (leave): {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

# ─── Save model ──────────────────────────────────────────────────────────────
with open(f"{SAVE_DIR}/vectorizer.pkl", "wb") as f:
    pickle.dump(vectorizer, f)
with open(f"{SAVE_DIR}/classifier.pkl", "wb") as f:
    pickle.dump(clf, f)
with open(f"{SAVE_DIR}/model_info.json", "w", encoding="utf-8") as f:
    json.dump({
        "type": "tfidf_svm",
        "nlp_engine": "pythainlp_newmm",
        "ngram_range": [1, 2],
        "labels": {"0": "other", "1": "leave"},
        "threshold": 0.65
    }, f, ensure_ascii=False, indent=2)

print(f"\nModel saved → {SAVE_DIR}")
print(f"  vectorizer.pkl  ({os.path.getsize(f'{SAVE_DIR}/vectorizer.pkl')/1024:.1f} KB)")
print(f"  classifier.pkl  ({os.path.getsize(f'{SAVE_DIR}/classifier.pkl')/1024:.1f} KB)")

# ─── Quick test ──────────────────────────────────────────────────────────────
def predict(text, threshold=0.65):
    tok = thai_tokenize(text)
    vec = vectorizer.transform([tok])
    prob = clf.predict_proba(vec)[0][1]
    return {"is_leave": bool(prob >= threshold), "confidence": round(float(prob), 4)}

tests = [
    ("วันนี้ไม่สบาย ขอลาป่วยนะครับ",        True),
    ("พรุ่งนี้ขอลากิจครับ",                  True),
    ("ลา 3 วัน ตั้งแต่วันที่ 10-12",         True),
    ("มาแล้วครับ ยกเลิกลา",                  True),
    ("ไม่มาวันนี้ครับ",                       True),
    ("หาหมอครับ ขอลาบ่าย",                   True),
    ("อุปกรณ์ชำรุดครับ ต้องซ่อม",            False),
    ("สวัสดีครับ",                             False),
    ("โอทีวันนี้ครับ",                         False),
    ("ประชุมกี่โมงครับ",                       False),
    ("ช้าหน่อยนะครับ ติดรถ",                 False),
]

print("\n─── Test Results ───")
passed = 0
for text, expected in tests:
    r = predict(text)
    ok = r["is_leave"] == expected
    if ok: passed += 1
    status = "✓" if ok else "✗"
    flag = "LEAVE" if r["is_leave"] else "other"
    print(f"  {status} [{flag}] ({r['confidence']:.2f}) {text}")

print(f"\nAccuracy: {passed}/{len(tests)} ({passed/len(tests)*100:.0f}%)")
