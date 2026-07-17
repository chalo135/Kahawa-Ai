import re
import json
import os
import requests
from datetime import datetime, timezone

FACTS_FILE = "facts.json"
WIKI_API   = "https://en.wikipedia.org/w/api.php"
HEADERS    = {"User-Agent": "KahawaSmart/1.0 (educational research project)"}

ARTICLES = [
    ("Hemileia vastatrix",        "Coffee Leaf Rust"),
    ("Coffee production in Kenya", "Kenya Coffee"),
    ("Coffee leaf disease",        "Coffee Diseases"),
]


def fetch_article(title: str) -> tuple[str, str]:
    params = {
        "action":         "query",
        "titles":         title,
        "prop":           "extracts",
        "explaintext":    True,
        "exsectionformat":"plain",
        "format":         "json",
    }
    resp = requests.get(WIKI_API, params=params, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    pages = resp.json()["query"]["pages"]
    page  = next(iter(pages.values()))
    return page.get("title", title), page.get("extract", "")


def extract_facts(title: str, text: str, source_label: str, max_facts: int = 5) -> list[dict]:
    facts = []
    paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 150]
    for para in paragraphs[:max_facts]:
        clean = re.sub(r"={2,}.*?={2,}", "", para).strip()
        if len(clean) < 100:
            continue
        first_sentence = (clean.split(".")[0])[:80].strip()
        facts.append({
            "title":      first_sentence,
            "text":       clean[:420] + ("..." if len(clean) > 420 else ""),
            "source":     source_label,
            "source_url": f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}",
        })
    return facts


def load_facts() -> dict | None:
    if not os.path.exists(FACTS_FILE):
        return None
    with open(FACTS_FILE, encoding="utf-8") as f:
        return json.load(f)


def is_stale(max_age_hours: int = 24) -> bool:
    data = load_facts()
    if not data:
        return True
    try:
        last = datetime.fromisoformat(data["last_updated"].rstrip("Z"))
        age  = (datetime.utcnow() - last).total_seconds() / 3600
        return age > max_age_hours
    except Exception:
        return True


def run() -> bool:
    print("Scraper: fetching coffee leaf rust facts from Wikipedia...")
    all_facts = []

    for wiki_title, label in ARTICLES:
        try:
            title, text = fetch_article(wiki_title)
            facts = extract_facts(title, text, label)
            all_facts.extend(facts)
            print(f"  {label}: {len(facts)} facts extracted")
        except Exception as e:
            print(f"  Failed to scrape '{wiki_title}': {e}")

    if not all_facts:
        print("Scraper: no facts retrieved — keeping existing data.")
        return False

    data = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "count":        len(all_facts),
        "facts":        all_facts,
    }
    with open(FACTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Scraper: saved {len(all_facts)} facts to {FACTS_FILE}")
    return True


if __name__ == "__main__":
    run()
