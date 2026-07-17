"""
Groq API client for Kahawa Smart's AI advisor chat.

Deliberately mirrors the shape of ollama_client.OllamaClient — a single
.chat(messages) method that returns the reply text — so main.py needed
only a one-line provider swap and the frontend needs no changes at all.

Note: ONLY the chat generation moved to Groq. The RAG embedding pipeline
in rag.py still uses Ollama and is intentionally left untouched.
"""
from config import Settings


class GroqClientError(Exception):
    """Raised for any failure talking to the Groq API."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def _model_unavailable(exc: Exception) -> bool:
    """True if the error looks like the requested model isn't available
    (decommissioned / not found), so we can fall back to another model."""
    text = str(exc).lower()
    return "model" in text and (
        "decommission" in text
        or "not found" in text
        or "does not exist" in text
        or "unavailable" in text
    )


class GroqClient:
    def __init__(self, settings: Settings, api_key: str | None) -> None:
        self.settings = settings
        self.api_key = api_key
        # Created lazily so a missing key or missing package never crashes
        # server startup — it only surfaces as a clean error at call time.
        self._client = None

    def _client_or_raise(self):
        if self._client is None:
            if not self.api_key:
                raise GroqClientError(
                    "GROQ_API_KEY is not set. Add it to your .env file."
                )
            try:
                from groq import Groq
            except ImportError as exc:
                raise GroqClientError(
                    "The 'groq' package is not installed. Run: pip install groq"
                ) from exc
            self._client = Groq(api_key=self.api_key)
        return self._client

    def chat(self, messages: list[dict[str, str]]) -> str:
        # ============================================================
        # MODEL CALL — Groq API
        # ------------------------------------------------------------
        # Model: llama-3.3-70b-versatile  (fallback: llama-3.1-8b-instant)
        #   We use a 70B model for noticeably higher answer QUALITY than
        #   the previous local 3B model (qwen2.5:3b via Ollama) — stronger
        #   agronomy reasoning and better Swahili/English fluency, which
        #   matters for giving farmers trustworthy treatment advice.
        #
        # Free API key: create one at https://console.groq.com (free tier),
        #   then paste it into the GROQ_API_KEY line of your .env file.
        #
        # Offline / local fallback: if internet is unavailable in future,
        #   switch back to a local Ollama model (e.g. llama3.1:8b on modest
        #   hardware) by re-enabling the commented "LOCAL FALLBACK" code in
        #   main.py.
        # ============================================================
        client = self._client_or_raise()
        models = [self.settings.groq_model, self.settings.groq_fallback_model]

        last_exc: Exception | None = None
        for index, model in enumerate(models):
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=self.settings.temperature,
                    top_p=self.settings.top_p,
                    # Keep chat replies phone-screen friendly (~350 tokens).
                    max_tokens=self.settings.groq_max_tokens,
                )
            except Exception as exc:  # groq.GroqError and its subclasses
                # If the primary 70B model is unavailable on the free tier,
                # transparently retry once with the 70B fallback model.
                if index == 0 and model != models[1] and _model_unavailable(exc):
                    print(
                        f"WARNING: Groq model '{model}' unavailable — "
                        f"retrying with fallback '{models[1]}'"
                    )
                    last_exc = exc
                    continue
                raise GroqClientError(str(exc)) from exc

            reply = (response.choices[0].message.content or "").strip()
            if not reply:
                raise GroqClientError("Groq returned an empty response.")
            if index == 1:
                print(f"Groq: used fallback model '{model}'")
            return reply

        raise GroqClientError(str(last_exc) if last_exc else "Groq call failed.")
