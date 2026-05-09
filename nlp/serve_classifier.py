"""
Thai Leave Classifier — Inference Server
โหลด TF-IDF + SVM model จาก Google Drive แล้ว expose เป็น HTTP API
รันบน Google Colab → ได้ ngrok URL → ใส่ใน Vercel env var NLP_CLASSIFIER_URL

ขั้นตอน:
1. เปิด Google Colab (colab.research.google.com)
2. เปิดไฟล์นี้จาก Google Drive
3. !pip install flask pyngrok pythainlp scikit-learn
4. ใส่ ngrok authtoken แล้วรัน (ดู ngrok authtoken ได้จาก dashboard.ngrok.com)
5. copy URL ที่ได้ → ตั้งค่า NLP_CLASSIFIER_URL ใน Vercel
"""

# ─── Cell 1: Install ──────────────────────────────────────
# !pip install flask pyngrok pythainlp scikit-learn -q

# ─── Cell 2: Mount Drive และโหลด model ──────────────────
from google.colab import drive
drive.mount('/content/drive')

import pickle, json, os
from pythainlp.tokenize import word_tokenize
from flask import Flask, request, jsonify
from pyngrok import ngrok

MODEL_DIR = '/content/drive/MyDrive/thai_leave_classifier'

print("Loading model ...")
with open(f"{MODEL_DIR}/vectorizer.pkl", "rb") as f:
    vectorizer = pickle.load(f)
with open(f"{MODEL_DIR}/classifier.pkl", "rb") as f:
    clf = pickle.load(f)
with open(f"{MODEL_DIR}/model_info.json", encoding="utf-8") as f:
    model_info = json.load(f)

THRESHOLD = model_info.get("threshold", 0.65)
print(f"Model loaded. threshold={THRESHOLD}")

# ─── Cell 3: Inference ────────────────────────────────────
def thai_tokenize(text):
    tokens = word_tokenize(text, engine="newmm", keep_whitespace=False)
    return " ".join(tokens)

def predict_leave(text: str) -> dict:
    tok = thai_tokenize(text)
    vec = vectorizer.transform([tok])
    prob = float(clf.predict_proba(vec)[0][1])
    return {
        "is_leave": bool(prob >= THRESHOLD),
        "confidence": round(prob, 4),
    }

# ─── Cell 4: Flask API ────────────────────────────────────
app = Flask(__name__)

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    text = (data or {}).get("text", "").strip()
    if not text:
        return jsonify({"error": "text is required"}), 400
    return jsonify(predict_leave(text))

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "tfidf_svm_pythainlp"})

# ─── Cell 5: Start ngrok + Flask ─────────────────────────
# ใส่ ngrok authtoken ของคุณ (ฟรีที่ dashboard.ngrok.com)
# !ngrok authtoken <YOUR_NGROK_TOKEN>

public_url = ngrok.connect(5000)
nlp_url = f"{public_url}/predict"

print(f"\n{'='*55}")
print(f"  NLP Classifier URL: {nlp_url}")
print(f"{'='*55}")
print("คัดลอก URL ด้านบนไปตั้งค่าใน Vercel:")
print("  Project → Settings → Environment Variables")
print("  Name:  NLP_CLASSIFIER_URL")
print(f"  Value: {nlp_url}")
print()

app.run(port=5000)
