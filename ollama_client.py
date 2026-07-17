from typing import Any

import requests

from config import Settings


class OllamaClientError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


class OllamaClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def chat(self, messages: list[dict[str, str]]) -> str:
        payload = self._build_payload(messages)
        data = self._post(payload, timeout=self.settings.ollama_timeout)
        return self._extract_reply(data)

    def warm_up(self) -> None:
        messages = [
            {
                "role": "system",
                "content": "Reply with OK only.",
            },
            {
                "role": "user",
                "content": "OK",
            },
        ]
        payload = self._build_payload(
            messages,
            options={**self.settings.ollama_options, "num_predict": 1},
        )
        self._post(payload, timeout=self.settings.ollama_warmup_timeout)

    def _build_payload(
        self,
        messages: list[dict[str, str]],
        options: dict[str, float | int] | None = None,
    ) -> dict[str, Any]:
        return {
            "model": self.settings.ollama_model,
            "messages": messages,
            "stream": False,
            "keep_alive": self.settings.ollama_keep_alive,
            "options": options or self.settings.ollama_options,
        }

    def _post(self, payload: dict[str, Any], timeout: float) -> dict[str, Any]:
        try:
            response = requests.post(
                self.settings.ollama_url,
                json=payload,
                timeout=timeout,
            )
        except requests.exceptions.ConnectionError as exc:
            raise OllamaClientError(
                503,
                (
                    f"Cannot connect to Ollama at {self.settings.ollama_url}. "
                    "Make sure Ollama is running."
                ),
            ) from exc
        except requests.exceptions.Timeout as exc:
            raise OllamaClientError(
                504,
                (
                    f"Ollama timed out after {timeout:g} seconds while using "
                    f"'{self.settings.ollama_model}'."
                ),
            ) from exc
        except requests.RequestException as exc:
            raise OllamaClientError(
                502,
                f"Ollama API request failed: {exc}",
            ) from exc

        if response.status_code >= 400:
            detail = self._error_detail(response)
            if self._is_model_not_found(response.status_code, detail):
                raise OllamaClientError(
                    503,
                    (
                        f"Ollama model '{self.settings.ollama_model}' was not "
                        f"found. Pull it first with: ollama pull "
                        f"{self.settings.ollama_model}"
                    ),
                )
            raise OllamaClientError(
                502,
                f"Ollama returned HTTP {response.status_code}: {detail}",
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise OllamaClientError(
                502,
                "Ollama returned invalid JSON.",
            ) from exc

        if not isinstance(data, dict):
            raise OllamaClientError(
                502,
                "Ollama returned an invalid response format.",
            )

        return data

    def _extract_reply(self, data: dict[str, Any]) -> str:
        message = data.get("message")
        if not isinstance(message, dict):
            raise OllamaClientError(
                502,
                "Ollama response did not include a valid message object.",
            )

        content = message.get("content")
        if not isinstance(content, str):
            raise OllamaClientError(
                502,
                "Ollama response message did not include text content.",
            )

        reply = content.strip()
        if not reply:
            raise OllamaClientError(
                502,
                "Ollama returned an empty response.",
            )

        return reply

    @staticmethod
    def _error_detail(response: requests.Response) -> str:
        try:
            data = response.json()
        except ValueError:
            return response.text or "Unknown Ollama error."

        if isinstance(data, dict):
            error = data.get("error") or data.get("detail")
            if error:
                return str(error)
        return response.text or "Unknown Ollama error."

    def _is_model_not_found(self, status_code: int, detail: str) -> bool:
        lowered = detail.lower()
        return (
            status_code == 404
            and "model" in lowered
            and ("not found" in lowered or "pull" in lowered)
        )
