"""
SQLite data layer for Kahawa Smart.

SECURITY — the property this file exists to demonstrate:
    Every SQL statement below is a fixed, constant string. User input is
    NEVER concatenated, f-stringed, or %-formatted into the SQL. It is
    passed separately as bound parameters via '?' placeholders, e.g.

        conn.execute("SELECT ... WHERE username = ?", (username,))

    The database engine compiles the statement FIRST, then binds the values
    as pure data. Injected SQL syntax (' OR '1'='1, '; DROP TABLE users; --)
    is therefore stored/compared as literal text and can never change the
    command. See SQL_INJECTION.md for the side-by-side explanation.

We use Python's stdlib sqlite3 (no ORM) deliberately: the '?' placeholders
are visible in the code, which makes the defence easy to point at and explain.
"""
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

DB_PATH = os.getenv("DB_PATH", "kahawa.db")

# 'name' is a small addition to the brief's schema: the existing signup form
# collects a Full Name and the navbar shows it, so we persist it rather than
# break that UI. Everything else is as specified.
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT    NOT NULL DEFAULT '',
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL
);
"""


@contextmanager
def get_conn():
    """One short-lived connection per operation — safe across FastAPI's
    threadpool, and closed even if the caller raises."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Creates the users table if it does not exist. Called at startup."""
    with get_conn() as conn:
        conn.executescript(SCHEMA)
    print(f"[DB] SQLite ready at {DB_PATH}")


def create_user(username: str, password_hash: str, name: str = "") -> int | None:
    """Inserts a new user. Returns the new id, or None if the username is
    already taken (UNIQUE constraint). Parameterized."""
    with get_conn() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (username, name, password_hash, created_at) "
                "VALUES (?, ?, ?, ?)",
                (username, name, password_hash, datetime.now(timezone.utc).isoformat()),
            )
            return cur.lastrowid
        except sqlite3.IntegrityError:
            return None


def get_user_by_username(username: str) -> dict | None:
    """Looks up a user by username. Parameterized — this is the query an
    attacker would target with ' OR '1'='1 in a naive implementation."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, name, password_hash, created_at "
            "FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        return dict(row) if row else None


def update_password(username: str, password_hash: str) -> bool:
    """Sets a new password hash. Returns True if a row was updated."""
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE users SET password_hash = ? WHERE username = ?",
            (password_hash, username),
        )
        return cur.rowcount > 0


def count_users() -> int:
    with get_conn() as conn:
        return conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
