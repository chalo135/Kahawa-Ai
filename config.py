import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv


load_dotenv()


# Groq API key — read from the environment, never hardcoded. Paste your
# key into the GROQ_API_KEY line in .env (see console.groq.com).
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Session settings. These live here (not in auth_routes) so they are read
# AFTER load_dotenv() above has run — reading them at import time in another
# module would silently miss the .env values and fall back to a random key.
JWT_SECRET = os.getenv("JWT_SECRET")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"


def _get_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _get_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


# Origins allowed to call the API from a browser. Comma-separated in .env,
# e.g. ALLOWED_ORIGINS=https://kahawa.example.com
# Defaults cover local development (python -m http.server / Live Server).
_DEFAULT_ORIGINS = (
    "http://localhost:8000,http://127.0.0.1:8000,"
    "http://localhost:5500,http://127.0.0.1:5500,"
    "http://localhost:3000,http://127.0.0.1:3000"
)


@dataclass(frozen=True)
class Settings:
    model_path: str = os.getenv("MODEL_PATH", "coffee_rust_model.h5")

    allowed_origins: str = os.getenv("ALLOWED_ORIGINS", _DEFAULT_ORIGINS)

    # Rate limiting (per client IP, sliding one-minute window).
    # /chat is strictest: every request occupies the local LLM.
    chat_rate_limit: int = _get_int("CHAT_RATE_LIMIT_PER_MIN", 10)
    predict_rate_limit: int = _get_int("PREDICT_RATE_LIMIT_PER_MIN", 20)

    # ── Groq (cloud LLM that powers the AI advisor chat) ──
    # 70B model for quality; automatic fallback if the primary is
    # unavailable on the free tier. Both overridable via .env.
    # llama-3.1-70b-versatile and llama3-70b-8192 were decommissioned by Groq.
    # llama-3.3-70b-versatile is the current 70B; llama-3.1-8b-instant is a
    # fast, live fallback.
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    groq_fallback_model: str = os.getenv("GROQ_FALLBACK_MODEL", "llama-3.1-8b-instant")
    # Cap reply length: ~350 tokens keeps answers thorough but not overwhelming
    # on a small phone screen (roughly 200-260 words).
    groq_max_tokens: int = _get_int("GROQ_MAX_TOKENS", 350)

    # ── Ollama (LOCAL FALLBACK — kept for offline use, see main.py) ──
    ollama_url: str = os.getenv(
        "OLLAMA_URL",
        "http://localhost:11434/api/chat",
    )
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
    ollama_keep_alive: str = os.getenv("OLLAMA_KEEP_ALIVE", "30m")
    ollama_timeout: float = _get_float("OLLAMA_TIMEOUT", 60.0)
    ollama_warmup_timeout: float = _get_float("OLLAMA_WARMUP_TIMEOUT", 15.0)

    temperature: float = _get_float("OLLAMA_TEMPERATURE", 0.4)
    top_p: float = _get_float("OLLAMA_TOP_P", 0.9)
    repeat_penalty: float = _get_float("OLLAMA_REPEAT_PENALTY", 1.1)
    num_predict: int = _get_int("OLLAMA_NUM_PREDICT", 300)

    chat_history_limit: int = _get_int("CHAT_HISTORY_LIMIT", 8)

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def ollama_options(self) -> dict[str, float | int]:
        return {
            "temperature": self.temperature,
            "top_p": self.top_p,
            "repeat_penalty": self.repeat_penalty,
            "num_predict": self.num_predict,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
