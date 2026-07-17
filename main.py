import io
import os
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

# Suppress TensorFlow log noise before importing TensorFlow.
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import numpy as np
import scraper
import rag
import tensorflow as tf
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image, UnidentifiedImageError
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

import db
from auth_routes import router as auth_router
from config import get_settings, GROQ_API_KEY
from groq_client import GroqClient, GroqClientError
from prompts import build_system_prompt, detect_user_language, greeting_reply

# ── LOCAL FALLBACK — uncomment to use Ollama instead of Groq ──
# from ollama_client import OllamaClient, OllamaClientError


settings = get_settings()

# Groq now powers the AI advisor chat (replaces the local Ollama 3B model).
# Warn loudly at startup if the key is missing so it's obvious immediately.
if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY is not set in .env — AI advisor will not work until you add it")
groq_client = GroqClient(settings, GROQ_API_KEY)

# ── LOCAL FALLBACK — uncomment to use Ollama instead of Groq ──
# ollama_client = OllamaClient(settings)

model: tf.keras.Model | None = None
IMG_SIZE = 224
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_CHAT_ROLES = {"user", "assistant"}


# Length caps bound how much text one request can push into the LLM —
# without them a single 10 MB "message" would pass validation.
class Message(BaseModel):
    role: str = Field(max_length=20)
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(max_length=50)
    context: str = Field(default="", max_length=1000)


# ── RATE LIMITING ─────────────────────────────────────────
# Minimal in-memory sliding-window limiter. Protects the LLM/server from a
# request flood — accidental or deliberate. No extra dependency; state resets
# on restart, which is fine at this scale.
#
# TRUST_PROXY: set to true in production when the app sits behind a reverse
# proxy (nginx on the VPS). Then the real client IP is read from the first hop
# of X-Forwarded-For instead of request.client.host — otherwise every user
# shares the proxy's single IP and one bucket throttles the whole site.
TRUST_PROXY = os.getenv("TRUST_PROXY", "false").lower() == "true"

_request_log: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_rate_lock = threading.Lock()


def _client_ip(request: Request) -> str:
    if TRUST_PROXY:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(request: Request, limit_per_minute: int, bucket: str) -> None:
    # Key on (ip, bucket) so /chat and /predict have INDEPENDENT limits —
    # running leaf scans must not use up a farmer's chat allowance.
    key = (_client_ip(request), bucket)
    now = time.monotonic()
    with _rate_lock:
        window = _request_log[key]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= limit_per_minute:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a minute and try again.",
            )
        window.append(now)

        # Keep memory bounded: drop buckets that have gone empty (an idle IP
        # would otherwise leave a dict entry forever on a public server).
        if len(_request_log) > 2048:
            for k in [k for k, w in _request_log.items() if not w]:
                del _request_log[k]


def _scraper_loop() -> None:
    if scraper.is_stale():
        scraper.run()
    while True:
        time.sleep(24 * 60 * 60)
        scraper.run()


# ── LOCAL FALLBACK — uncomment to use Ollama instead of Groq ──
# Groq is a hosted API and needs no warm-up, so this is disabled.
# def _warm_up_ollama() -> None:
#     try:
#         ollama_client.warm_up()
#         print(f"Ollama model warmed: {settings.ollama_model}")
#     except OllamaClientError as exc:
#         print(f"WARNING: Ollama warm-up failed: {exc.detail}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    if os.path.exists(settings.model_path):
        model = tf.keras.models.load_model(settings.model_path)
        print(f"Model loaded from {settings.model_path}")
    else:
        print(
            f"WARNING: {settings.model_path} not found. "
            "Run: python train_model.py"
        )

    db.init_db()
    rag.load_index()
    threading.Thread(target=_scraper_loop, daemon=True).start()
    # ── LOCAL FALLBACK — uncomment to warm up Ollama instead of Groq ──
    # threading.Thread(target=_warm_up_ollama, daemon=True).start()
    yield


app = FastAPI(
    title="Kahawa Smart API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS is restricted to an explicit allowlist (set ALLOWED_ORIGINS in .env).
# A wildcard would let any website a user visits call this API from their
# browser; an allowlist means only our own frontend origins can.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,   # required so the session cookie is sent/accepted
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# Auth routes (/api/signup, /api/login, /api/logout, /api/me,
# /api/reset-password) live in their own router, separate from chat.
app.include_router(auth_router)


def preprocess_image(file_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))
    arr = np.array(img, dtype=np.float32)
    arr = np.expand_dims(arr, axis=0)
    return preprocess_input(arr)


def _latest_user_message(messages: list[Message]) -> str:
    for message in reversed(messages):
        if message.role == "user" and message.content.strip():
            return message.content.strip()
    raise HTTPException(
        status_code=400,
        detail="Chat request must include at least one user message.",
    )


def _recent_chat_messages(messages: list[Message]) -> list[dict[str, str]]:
    recent = messages[-settings.chat_history_limit :]
    formatted: list[dict[str, str]] = []

    for message in recent:
        role = message.role.strip().lower()
        content = message.content.strip()
        if not content:
            continue
        if role not in ALLOWED_CHAT_ROLES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported chat role: {message.role}",
            )
        formatted.append({"role": role, "content": content})

    return formatted


@app.get("/")
def root() -> dict[str, bool | str]:
    return {
        "status": "Kahawa Smart API running",
        "model_loaded": model is not None,
    }


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True, "model_loaded": model is not None}


@app.get("/facts")
def facts():
    data = scraper.load_facts()
    if not data:
        raise HTTPException(
            status_code=503,
            detail="Facts not yet available. Try again shortly.",
        )
    return data


@app.post("/api/chat")
def chat(body: ChatRequest, request: Request) -> dict:
    check_rate_limit(request, settings.chat_rate_limit, "chat")
    latest_message = _latest_user_message(body.messages)
    language = detect_user_language(latest_message)

    greeting = greeting_reply(latest_message, language)
    if greeting:
        return {"reply": greeting}

    # RAG: retrieve knowledge-base chunks relevant to THIS question. An empty
    # list is meaningful — it tells build_system_prompt there is no grounding,
    # so the model says it doesn't know rather than inventing findings.
    try:
        rag_chunks = rag.retrieve_relevant(latest_message)
    except Exception as exc:  # never let retrieval break the chat
        print(f"WARNING: RAG retrieval failed, answering ungrounded: {exc}")
        rag_chunks = []

    if rag_chunks:
        sources = ", ".join(
            f"{c['source']} ({c['score']:.2f})" for c in rag_chunks
        )
        print(f"[RAG] grounded on: {sources}")
    else:
        print("[RAG] no relevant knowledge-base match for this question")

    system_prompt = build_system_prompt(
        latest_message=latest_message,
        language=language,
        scan_context=body.context,
        rag_chunks=rag_chunks,
    )
    llm_messages = [{"role": "system", "content": system_prompt}]
    llm_messages.extend(_recent_chat_messages(body.messages))

    try:
        reply = groq_client.chat(llm_messages)
    except GroqClientError as exc:
        # Log the real cause server-side, but return a clean JSON error the
        # frontend can show — never a 500 crash. Covers invalid/missing key,
        # network failure, and rate limits.
        print(f"ERROR: Groq failure: {exc.message}")
        return {
            "error": True,
            "message": "The AI advisor is temporarily unavailable. Please check your connection and try again.",
        }

    # ── LOCAL FALLBACK — uncomment to use Ollama instead of Groq ──
    # try:
    #     reply = ollama_client.chat(llm_messages)
    # except OllamaClientError as exc:
    #     print(f"ERROR: Ollama failure ({exc.status_code}): {exc.detail}")
    #     raise HTTPException(
    #         status_code=exc.status_code,
    #         detail="The AI advisor is temporarily unavailable. Please try again shortly.",
    #     ) from exc

    return {"reply": reply}


@app.post("/predict")
async def predict(request: Request, file: UploadFile = File(...)):
    check_rate_limit(request, settings.predict_rate_limit, "predict")

    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run: python train_model.py first.",
        )

    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    # Read at most limit+1 bytes so an oversized upload can't fill RAM
    # before we get the chance to reject it.
    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image must be under 10 MB.")

    # The content-type header above is client-supplied and trivially faked.
    # Decoding with PIL verifies the BYTES are really an image; anything
    # else (renamed .exe, corrupt file) gets a clean 400, not a crash.
    try:
        img_array = preprocess_image(contents)
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="File is not a valid image. Please upload a JPG or PNG photo.",
        )
    raw = float(model.predict(img_array, verbose=0)[0][0])

    # raw is probability of class 1 (rust)
    rust_conf = round(raw, 4)
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
        if healthy_conf < 0.90:
            warning = (
                "Low confidence result. The leaf may have a different disease "
                "(e.g. Cercospora, CBD, leaf miner). This model detects rust "
                "only - consult an agronomist for confirmation."
            )

    return {
        "predictions": [
            {"label": top_label, "confidence": top_conf},
            {"label": second_label, "confidence": second_conf},
        ],
        "warning": warning,
    }
