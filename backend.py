"""
Kahawa Smart — FastAPI Backend
Serves the trained MobileNetV2 coffee leaf rust classifier + Groq chat proxy.
Run: uvicorn backend:app --reload --port 8000
Set env var: GROQ_API_KEY=your_key_here
"""

import io
import os
import numpy as np
import requests as req_lib
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

# ── SUPPRESS TF LOG NOISE ────────────────────────────────────────────────────
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

app = FastAPI(title="Kahawa Smart API", version="1.0.0")

# ── GROQ CONFIG ──────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = (
    "You are Kahawa Smart AI, an expert agricultural advisor specializing in coffee "
    "farming and coffee leaf diseases, particularly coffee leaf rust (Hemileia vastatrix). "
    "You help farmers in East Africa, especially Kenya, identify and manage coffee leaf diseases.\n\n"
    "Your personality:\n"
    "- Friendly, warm, and encouraging\n"
    "- Practical and actionable — always give specific advice\n"
    "- Respond in the same language the farmer uses (English or Swahili)\n"
    "- Keep responses concise and clear — farmers need quick, useful answers\n"
    "- Use simple language — avoid technical jargon unless explaining it\n\n"
    "Your expertise covers:\n"
    "- Coffee leaf rust identification and management\n"
    "- Fungicide recommendations and application timing\n"
    "- Organic and chemical treatment options\n"
    "- Preventive measures and good farming practices\n"
    "- Coffee plant nutrition and care\n"
    "- When to call an agricultural extension officer\n\n"
    "When a leaf scan result is available in the conversation, reference it in your advice. "
    "Always end responses with one practical next step the farmer can take today."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # frontend may be served from file:// or localhost
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── LOAD MODEL AT STARTUP ────────────────────────────────────────────────────
MODEL_PATH = "coffee_rust_model.h5"
model = None

@app.on_event("startup")
def load_model():
    global model
    if not os.path.exists(MODEL_PATH):
        print(f"WARNING: {MODEL_PATH} not found. Train the model first with: python train_model.py")
        return
    model = tf.keras.models.load_model(MODEL_PATH)
    print(f"Model loaded from {MODEL_PATH}")

# ── HELPERS ──────────────────────────────────────────────────────────────────
IMG_SIZE = 224

def preprocess_image(file_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))
    arr = np.array(img, dtype=np.float32)
    arr = np.expand_dims(arr, axis=0)
    return preprocess_input(arr)

# ── ROUTES ───────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "Kahawa Smart API running", "model_loaded": model is not None}

@app.get("/health")
def health():
    return {"ok": True, "model_loaded": model is not None}

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]
    context: str = ""

@app.post("/chat")
def chat(body: ChatRequest):
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Chat not configured. Set the GROQ_API_KEY environment variable.",
        )

    system = SYSTEM_PROMPT
    if body.context:
        system += f"\n\nCurrent scan context: {body.context}"

    groq_messages = [{"role": "system", "content": system}] + [
        {"role": m.role, "content": m.content} for m in body.messages
    ]

    try:
        resp = req_lib.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": GROQ_MODEL, "messages": groq_messages, "max_tokens": 1000},
            timeout=30,
        )
        resp.raise_for_status()
    except req_lib.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {e}")

    reply = resp.json()["choices"][0]["message"]["content"]
    return {"reply": reply}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run: python train_model.py first.",
        )

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 10 MB.")

    img_array = preprocess_image(contents)
    raw = float(model.predict(img_array, verbose=0)[0][0])

    # raw is probability of class 1 (rust)
    rust_conf    = round(raw, 4)
    healthy_conf = round(1.0 - raw, 4)

    warning = None

    if rust_conf >= 0.5:
        top_label = "coffee_leaf_rust"
        second_label = "healthy_coffee_leaf"
        top_conf, second_conf = rust_conf, healthy_conf
    else:
        top_label = "healthy_coffee_leaf"
        second_label = "coffee_leaf_rust"
        top_conf, second_conf = healthy_conf, rust_conf
        # If healthy confidence is not high, the leaf may have a different disease
        if healthy_conf < 0.90:
            warning = "Low confidence result. The leaf may have a different disease (e.g. Cercospora, CBD, leaf miner). This model detects rust only — consult an agronomist for confirmation."

    return {
        "predictions": [
            {"label": top_label,    "confidence": top_conf},
            {"label": second_label, "confidence": second_conf},
        ],
        "warning": warning,
    }
