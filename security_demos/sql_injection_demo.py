"""
============================================================
Kahawa Smart - SQL Injection Demonstration (educational)
============================================================

IMPORTANT - read this first:
    The real Kahawa Smart app does NOT use an SQL database. User
    accounts live in the browser's localStorage as JSON, and login
    is a plain string comparison (auth.js -> loginUser). That means
    the real app has NO SQL layer for an attacker to inject into, so
    classic SQL injection cannot succeed against it.

    This script is therefore a *controlled demonstration* of the
    vulnerability class and its fix, using a throwaway SQLite database
    that we build here. It exists to prove I understand (a) how SQL
    injection works and (b) how to prevent it - NOT because the app
    was ever vulnerable.

Run it:
    python security_demos/sql_injection_demo.py

It builds an in-memory database with two users, then logs in twice:
  1. Through a NAIVE query built with string formatting  -> exploitable
  2. Through a PARAMETERISED query                        -> safe
The same attacker input is used against both, so you can see the
identical payload succeed against one and fail against the other.

Uses only Python's standard library (sqlite3, hashlib) - no new
dependency, consistent with the rest of the project.
"""

import hashlib
import sqlite3


# ── Setup: a small throwaway users database ───────────────
def build_demo_db() -> sqlite3.Connection:
    """Creates an in-memory SQLite DB with two seeded users.

    Passwords are stored as SHA-256 hashes to mirror the real app's
    auth.js. That is deliberate: it shows that hashing passwords does
    NOT stop SQL injection - the attack bypasses the password check
    entirely, it never needs to know the password."""
    conn = sqlite3.connect(":memory:")
    conn.execute(
        """
        CREATE TABLE users (
            id       INTEGER PRIMARY KEY,
            email    TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,   -- SHA-256 hash
            role     TEXT NOT NULL
        )
        """
    )
    seed = [
        ("admin@kahawa.com", _sha256("SuperSecretAdminPass!"), "admin"),
        ("farmer@kahawa.com", _sha256("Str0ng!Pass"), "user"),
    ]
    conn.executemany(
        "INSERT INTO users (email, password, role) VALUES (?, ?, ?)", seed
    )
    conn.commit()
    return conn


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


# ── 1. THE VULNERABLE WAY (never do this) ─────────────────
def login_vulnerable(conn: sqlite3.Connection, email: str, password: str):
    """Builds the SQL by pasting user input straight into the query
    string. This is the classic mistake that creates SQL injection:
    the input can contain SQL syntax that changes what the query does."""
    query = (
        "SELECT email, role FROM users "
        f"WHERE email = '{email}' AND password = '{_sha256(password)}'"
    )
    print(f"      SQL executed: {query}")
    # executescript is used so multi-statement payloads (e.g. '; DROP ...)
    # can also be demonstrated - a normal execute() would refuse them,
    # which itself is a small (accidental) mitigation in sqlite3.
    cur = conn.cursor()
    try:
        cur.execute(query)
    except (sqlite3.Warning, sqlite3.ProgrammingError) as exc:
        # Python's sqlite3 execute() refuses to run more than one statement,
        # so a *stacked* payload like  '; DROP TABLE users; --  is rejected
        # here. That is an accidental, driver-specific safety net - NOT a
        # real defence: the single-statement auth-bypass attacks above still
        # succeed, and other databases/drivers do allow stacked queries.
        return f"blocked by driver: {exc}"
    row = cur.fetchone()
    return row


# ── 2. THE SAFE WAY (parameterised query) ─────────────────
def login_secure(conn: sqlite3.Connection, email: str, password: str):
    """Uses a parameterised query: the '?' placeholders are sent to the
    database engine separately from the values. The engine treats the
    values as pure DATA, never as SQL, so injected syntax is inert."""
    # Defence in depth: reject absurd input before it ever reaches the DB.
    if len(email) > 254 or len(password) > 200:
        return "rejected: input too long"

    cur = conn.cursor()
    cur.execute(
        "SELECT email, role FROM users WHERE email = ? AND password = ?",
        (email, _sha256(password)),
    )
    return cur.fetchone()


# ── Demonstration driver ──────────────────────────────────
def _show(title: str) -> None:
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def main() -> None:
    # Attacker inputs. In each case the attacker does NOT know any
    # valid password - they only type into the email/username box.
    attacks = [
        ("Auth bypass - comment out the password check",
         "admin@kahawa.com' --", "anything"),
        ("Auth bypass - always-true condition",
         "' OR '1'='1' --", "anything"),
        ("Destructive - try to drop the users table",
         "x'; DROP TABLE users; --", "anything"),
    ]

    _show("1) VULNERABLE query - string-formatted SQL")
    conn = build_demo_db()
    for label, email, pw in attacks:
        print(f"\n  Attack: {label}")
        print(f"      Attacker types email = {email!r}")
        result = login_vulnerable(conn, email, pw)
        if result and result not in ("", None) and not str(result).startswith("blocked"):
            print(f"      RESULT: >>> LOGGED IN as {result[0]} (role={result[1]}) "
                  f"- BYPASS SUCCEEDED, no password needed! <<<")
        else:
            print(f"      RESULT: {result}")
    conn.close()

    _show("2) SECURED query - same attacks, parameterised")
    conn = build_demo_db()
    for label, email, pw in attacks:
        print(f"\n  Attack: {label}")
        print(f"      Attacker types email = {email!r}")
        result = login_secure(conn, email, pw)
        if result:
            print(f"      RESULT: logged in as {result[0]} - (would only happen "
                  f"for a REAL account)")
        else:
            print("      RESULT: login rejected - injection treated as literal "
                  "text, no match. SAFE.")

    # Prove the table still exists after the "DROP" attempt.
    still_there = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    print(f"\n  users table intact after attacks? {still_there} rows present -> YES")
    conn.close()

    _show("3) Sanity check - a genuine login still works")
    conn = build_demo_db()
    ok = login_secure(conn, "farmer@kahawa.com", "Str0ng!Pass")
    bad = login_secure(conn, "farmer@kahawa.com", "wrong-password")
    print(f"\n  correct credentials -> {ok}")
    print(f"  wrong password      -> {bad}")
    conn.close()

    print("\n" + "-" * 60)
    print("Takeaway: identical attacker input BYPASSES the string-built")
    print("query but is HARMLESS against the parameterised one. The fix is")
    print("not to 'filter bad words' - it is to never mix code and data.")
    print("-" * 60)


if __name__ == "__main__":
    main()
