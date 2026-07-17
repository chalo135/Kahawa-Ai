import re

from langdetect import DetectorFactory, LangDetectException, detect


DetectorFactory.seed = 0

SYSTEM_PROMPT = """You are Kahawa AI, a friendly and knowledgeable coffee farming advisor for smallholder farmers in Kenya. You speak clearly and warmly, like a trusted agronomist who knows the farmer personally and wants their farm to succeed.

How you talk:
- Write plain, conversational text only. This is a chat, not a document. Never use markdown or symbols like **, ##, -, or backticks, and never write bullet lists. Just talk naturally.
- Use short paragraphs. Keep your whole reply to at most four short paragraphs, unless the question truly needs more.
- Use simple words a farmer with basic schooling understands. If you must mention a scientific or Latin name (like Hemileia vastatrix), explain it right away in plain words, for example "the rust fungus". Never leave jargon unexplained.
- Sound warm and human, like a neighbour who happens to be an expert. Never sound like a textbook or a warning label.
- Always finish with one clear, specific next step the farmer can do today.

What you talk about:
- If the farmer only greets you (hello, hi, habari, mambo), reply warmly and briefly, then ask what they need help with. Do not bring up diseases, chemicals, or scans until they ask.
- If they ask about something outside coffee farming (weather, politics, general chat), be warm but gently bring it back: "I'm best at helping with your coffee farm — what's happening with your plants?"
- When a leaf scan result is provided, explain in plain words what it means, what likely caused it, what to do about it, and when to call the local agricultural officer.

Staying accurate:
- Reply only in the language of the farmer's latest message. If they write English, reply in English. If Swahili, reply in Swahili. If they mix the two, mirror that naturally. Do not switch languages on your own.
- Never invent diagnoses, chemical names, dosages, prices, weather, or laws. If you are not sure, say so honestly. The image model, not you, identifies the leaf disease."""

ENGLISH_MARKERS = {
    "advice",
    "coffee",
    "disease",
    "farm",
    "farming",
    "hello",
    "help",
    "hi",
    "leaf",
    "leaves",
    "plant",
    "rust",
    "scan",
    "treatment",
}

SWAHILI_MARKERS = {
    "asante",
    "habari",
    "jambo",
    "kahawa",
    "karibu",
    "kutu",
    "majani",
    "mambo",
    "mmea",
    "naomba",
    "naweza",
    "nisaidie",
    "shamba",
    "tafadhali",
    "ugonjwa",
    "vipi",
}

COFFEE_TERMS = {
    "coffee",
    "kahawa",
    "leaf",
    "leaves",
    "majani",
    "rust",
    "kutu",
    "fungicide",
    "disease",
    "ugonjwa",
    "scan",
    "prediction",
    "plant",
    "mmea",
    "farm",
    "shamba",
}

ENGLISH_GREETINGS = {
    "good afternoon",
    "good evening",
    "good morning",
    "hello",
    "hey",
    "hi",
    "how are you",
}

SWAHILI_GREETINGS = {
    "habari",
    "habari gani",
    "habari yako",
    "hujambo",
    "jambo",
    "mambo",
    "niaje",
    "shikamoo",
    "sasa",
    "vipi",
}

GREETING_FILLER = {
    "a",
    "are",
    "gani",
    "how",
    "leo",
    "mambo",
    "there",
    "today",
    "uko",
    "vipi",
    "wewe",
    "yako",
    "you",
    
}


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-zA-Z]+", text.lower()))


def _normalized(text: str) -> str:
    normalized = re.sub(r"[^\w\s]", " ", text.lower())
    return re.sub(r"\s+", " ", normalized).strip()


def detect_user_language(text: str) -> str:
    """Detect language from the latest user message only."""
    normalized = _normalized(text)
    tokens = _tokens(normalized)
    has_english = bool(tokens & ENGLISH_MARKERS)
    has_swahili = bool(tokens & SWAHILI_MARKERS)

    if has_english and has_swahili:
        return "mixed"
    if has_swahili and len(tokens) <= 6:
        return "sw"
    if has_english and len(tokens) <= 6:
        return "en"

    try:
        detected = detect(normalized)
    except LangDetectException:
        return "en"

    if detected in {"en", "sw"}:
        return detected
    if has_swahili:
        return "sw"
    return "en"


def language_label(language: str) -> str:
    if language == "sw":
        return "Swahili"
    if language == "mixed":
        return "mixed English and Swahili"
    return "English"


def mentions_coffee(text: str) -> bool:
    return bool(_tokens(text) & COFFEE_TERMS)


def greeting_reply(text: str, language: str) -> str | None:
    normalized = _normalized(text)
    tokens = _tokens(normalized)

    if not normalized or mentions_coffee(normalized):
        return None

    english_greeting = normalized in ENGLISH_GREETINGS
    swahili_greeting = normalized in SWAHILI_GREETINGS
    compact_greeting = len(tokens) <= 5 and tokens.issubset(
        ENGLISH_MARKERS | SWAHILI_MARKERS | GREETING_FILLER
    )

    if not (english_greeting or swahili_greeting or compact_greeting):
        return None

    if language == "mixed":
        return "Hello! Naweza kukusaidia vipi leo?"
    if language == "sw":
        if normalized.startswith("jambo"):
            return "Jambo! Karibu. Naweza kukusaidia vipi?"
        return "Habari! Naweza kukusaidia vipi leo?"
    if normalized.startswith("hi"):
        return "Hi! What can I help you with today?"
    return "Hello! How can I help you today?"


def format_rag_context(chunks: list[dict]) -> str:
    """Renders retrieved knowledge-base chunks into a numbered context block."""
    blocks = []
    for i, chunk in enumerate(chunks, 1):
        source = chunk.get("source", "knowledge base")
        text = chunk.get("text", "").strip()
        blocks.append(f'[{i}] From "{source}":\n{text}')
    return "\n\n".join(blocks)


def build_system_prompt(
    latest_message: str,
    language: str,
    scan_context: str = "",
    rag_chunks: list[dict] | None = None,
) -> str:
    """Assembles the system prompt: persona + conversation controls +
    (optionally) retrieved knowledge-base context.

    rag_chunks is the output of rag.retrieve_relevant(). When it is empty we
    explicitly tell the model it has NO grounding, so it says it doesn't know
    instead of inventing research findings.
    """
    scan_available = bool(scan_context.strip())
    rag_chunks = rag_chunks or []
    grounded = bool(rag_chunks)
    coffee_mode = mentions_coffee(latest_message) or scan_available or grounded

    controls = [
        "Conversation controls:",
        f"- Latest message language: {language_label(language)}.",
        f"- Coffee mode allowed: {'yes' if coffee_mode else 'no'}.",
        f"- Scan result available: {'yes' if scan_available else 'no'}.",
        "- Use any scan result only when it helps answer the latest message.",
    ]

    if scan_available:
        controls.append(f"Current scan context: {scan_context.strip()}")

    if grounded:
        controls += [
            "- Reference material from the Kahawa knowledge base is provided below.",
            "- Ground your answer in that material. Prefer what it says over your own memory.",
            "- Do not state research findings, trial results, or numbers that the material does not support.",
            "- If the material does not actually answer the farmer's question, say plainly that you do not have that information, and offer only general guidance you are confident about.",
            "- Never mention chunk numbers, file names, or that you were given documents. Just answer naturally.",
        ]
    else:
        controls += [
            "- No knowledge base material matched this question.",
            "- Do not invent research findings, studies, trials, statistics, or sources.",
            "- If the question needs specific documented facts you do not have, say honestly that you do not have that information and suggest speaking to the local agricultural officer.",
        ]

    prompt = f"{SYSTEM_PROMPT}\n\n" + "\n".join(controls)

    if grounded:
        prompt += (
            "\n\nKnowledge base material:\n"
            f"{format_rag_context(rag_chunks)}"
        )

    return prompt
