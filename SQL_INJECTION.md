# SQL Injection — How Kahawa Smart Prevents It

Kahawa Smart now stores user accounts in a real SQLite database (`kahawa.db`),
so SQL injection is a real, relevant threat to this app. This document is the
one-page explanation for a marker: what the attack is, the exact code that
prevents it, and proof it holds.

> **Note:** an earlier version of this document said "this app has no SQL, so
> injection cannot apply." That was true then. It is no longer true — the app
> gained a SQLite user store, so the defence below is now what matters.

---

## 1. What SQL injection is (plain language)

The database speaks a language (SQL). If a program **builds a command by gluing
user input into that language**, the user can type things that stop being *data*
and start being *commands* — like closing a quote early and commenting out the
rest of the check. The classic result is logging in as someone else without
their password.

---

## 2. The comparison (for the slide)

Both queries below look for a user by name. Only one is safe.

### ❌ Vulnerable — string concatenation (NOT used in this app)

```python
# DO NOT DO THIS — illustration only, this code is not in the app.
query = "SELECT * FROM users WHERE username = '" + username + "'"
cursor.execute(query)
```

If the attacker types `admin'--` into the username box, the database receives:

```sql
SELECT * FROM users WHERE username = 'admin'--'
```

The `'` closes the string early and `--` turns **the rest of the line into a
comment**, deleting the password check. The database happily returns the admin
row. Note this works *even though passwords are hashed* — the attack never needs
the password, it removes the check entirely.

### ✅ Safe — parameterized query (what this app actually uses)

From [`db.py`](db.py), `get_user_by_username()`:

```python
row = conn.execute(
    "SELECT id, username, name, password_hash, created_at "
    "FROM users WHERE username = ?",
    (username,),
).fetchone()
```

The SQL is a **fixed, constant string**. The `?` is a placeholder, and the value
travels to the database **separately**, as a parameter.

---

## 3. Why the safe version cannot be exploited

The database engine **compiles the SQL first**, while it still contains only the
`?` placeholder — before it has ever seen the user's text. Only then are the
values bound in, as pure **data**.

Because the command's structure is already fixed by the time the input arrives,
the input *cannot change that structure*. `admin'--` is looked up as a literal
username, forty-five characters of ordinary text, matching nobody. There is no
parsing step left for it to hijack.

This is a **structural** guarantee, not filtering. We never try to detect or
strip "bad" characters — that approach is fragile (endless encodings to bypass,
and it breaks legitimate names like `O'Brien`). We simply never mix code and data.

---

## 4. Where this is enforced

Every statement that touches user input lives in [`db.py`](db.py), and every one
uses bound `?` placeholders:

| Function | Statement | User input bound as |
|---|---|---|
| `create_user()` | `INSERT INTO users (...) VALUES (?, ?, ?, ?)` | username, name, hash, timestamp |
| `get_user_by_username()` | `SELECT ... WHERE username = ?` | username |
| `update_password()` | `UPDATE users SET password_hash = ? WHERE username = ?` | hash, username |

There is **no** string concatenation, f-string, or `%` formatting building SQL
anywhere in the app. We use stdlib `sqlite3` rather than an ORM on purpose: the
`?` placeholders are visible in the source, so the defence is easy to point at.

---

## 5. Proof it holds (tested against the live API)

These payloads were sent to the running `POST /api/login`:

| Payload (as username **and** password) | Result |
|---|---|
| `' OR '1'='1` | `401` rejected |
| `admin'--` | `401` rejected |
| `eliud'--` | `401` rejected |
| `'; DROP TABLE users; --` | `401` rejected |
| `" OR ""="` | `401` rejected |

After the `DROP TABLE` attempt the `users` table was **still intact** and login
still worked. A runnable, self-contained demonstration of the vulnerable vs.
secured query lives in [`security_demos/sql_injection_demo.py`](security_demos/sql_injection_demo.py).

---

## 6. Defence in depth (the other layers)

Parameterization is the actual fix. These reduce blast radius around it:

1. **Pydantic validation** — request bodies must match a typed schema with
   length caps (`auth_routes.py`) before our code runs; oversized/malformed
   input is rejected with a `422`.
2. **bcrypt password hashing** — even a full database dump exposes no passwords.
   (As shown above, hashing does *not* stop injection; the two solve different
   problems and you need both.)
3. **Generic login errors** — "Username or password is incorrect" never reveals
   which of the two was wrong.
4. **Least privilege** *(noted for production)* — the app's DB account should
   not be able to `DROP TABLE`. With file-based SQLite this is filesystem
   permissions rather than a DB grant.

---

## 7. Likely questions from the marker

**Q: Is your app vulnerable to SQL injection?**
No. Every query is parameterized with bound `?` placeholders, so user input is
always data and never becomes part of the command. I tested the live login with
five standard payloads — all rejected, table intact.

**Q: Why not just filter out quotes and semicolons?**
Because it's fragile and wrong-headed: attackers have countless encodings to
bypass a blocklist, and you'd eventually reject a legitimate name like O'Brien.
Parameterization fixes the problem at its root, so filtering isn't needed.

**Q: You hash passwords — doesn't that stop injection?**
No, and that's the key insight. The `admin'--` payload comments out the password
check entirely, so it never needs the password at all. Hashing protects passwords
*at rest*; parameterization protects the *query*. You need both.

**Q: Why raw sqlite3 instead of an ORM like SQLAlchemy?**
An ORM would parameterize for me, which is fine — but it hides the mechanism.
With stdlib `sqlite3` the `?` placeholders are visible in `db.py`, so I can point
at exactly where and how the defence works.

**Q: What's the weakest point now?**
Not injection — it's that `JWT_SECRET` must be a strong, secret value in
production. Anyone who knows it can forge a session cookie, which would bypass
login without touching the database at all.
