"""
Server-side authentication for Kahawa Smart.

Replaces the old browser-only localStorage auth with a real backend:
  - passwords hashed with bcrypt (slow, salted per-user, industry standard)
  - users stored in SQLite via parameterized queries (see db.py)
  - session issued as a signed JWT in an httpOnly cookie, so page JavaScript
    (and therefore any XSS) cannot read or steal the token
  - "Remember me" is enforced SERVER-SIDE at token issuance: the exp claim is
    30 minutes normally, 30 days when remember=true. The browser cannot extend
    it, because the token is signed and we verify exp on every request.

Kept in its own router so the auth routes are separate from the chat routes.
"""
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, Response
from fastapi import Request as FastAPIRequest
from pydantic import BaseModel, Field

import db
# Import from config (not os.getenv directly): config runs load_dotenv(), so
# importing it here guarantees .env is loaded before we read these values.
from config import COOKIE_SECURE, JWT_SECRET as _ENV_JWT_SECRET

router = APIRouter(prefix="/api", tags=["auth"])

SESSION_COOKIE = "kahawa_session"
JWT_ALG = "HS256"

SESSION_MINUTES = 30            # normal login
REMEMBER_DAYS = 30              # "remember me" login

# The signing key. MUST be set in production — anyone who knows it can forge
# a session. A random per-boot key is used as a dev fallback, which simply
# means everyone is logged out when the server restarts.
JWT_SECRET = _ENV_JWT_SECRET
if not JWT_SECRET:
    JWT_SECRET = secrets.token_urlsafe(48)
    print(
        "WARNING: JWT_SECRET is not set in .env — using a temporary key. "
        "Sessions will be invalidated on every restart. Set JWT_SECRET before deploying."
    )
elif len(JWT_SECRET) < 32:
    print("WARNING: JWT_SECRET is shorter than 32 characters — use a longer random value.")


# ── Request models (Pydantic validates shape/length before our code runs) ──
class SignupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=80)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=128)
    remember: bool = False


class ResetPasswordRequest(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    new_password: str = Field(min_length=8, max_length=128)


# ── Helpers ───────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _issue_token(username: str, remember: bool) -> tuple[str, int]:
    """Returns (jwt, max_age_seconds). Lifetime is decided HERE, on the
    server — never by the browser."""
    lifetime = (
        timedelta(days=REMEMBER_DAYS) if remember
        else timedelta(minutes=SESSION_MINUTES)
    )
    now = datetime.now(timezone.utc)
    payload = {"sub": username, "iat": now, "exp": now + lifetime}
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)
    return token, int(lifetime.total_seconds())


def _set_session_cookie(response: Response, token: str, max_age: int) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=max_age,
        httponly=True,           # JavaScript cannot read it -> XSS can't steal it
        secure=COOKIE_SECURE,    # HTTPS-only in production
        samesite="lax",
        path="/",
    )


def current_user(request: FastAPIRequest) -> dict:
    """Validates the session cookie. Raises 401 if missing/expired/forged."""
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not signed in.")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Your session has expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session.")

    user = db.get_user_by_username(payload.get("sub", ""))
    if not user:
        raise HTTPException(status_code=401, detail="Account no longer exists.")
    return {
        "username": user["username"],
        "name": user["name"],
        "created_at": user["created_at"],
    }


# ── Routes ────────────────────────────────────────────────
@router.post("/signup")
def signup(body: SignupRequest, response: Response) -> dict:
    username = body.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Please choose a username.")

    user_id = db.create_user(username, hash_password(body.password), body.name.strip())
    if user_id is None:
        # Duplicate username handled cleanly (UNIQUE constraint), not a 500.
        raise HTTPException(status_code=409, detail="That email is already registered.")

    # Log them straight in after signup.
    token, max_age = _issue_token(username, remember=False)
    _set_session_cookie(response, token, max_age)
    return {"username": username, "name": body.name.strip()}


@router.post("/login")
def login(body: LoginRequest, response: Response) -> dict:
    user = db.get_user_by_username(body.username.strip())

    # Same generic message whether the username or the password was wrong,
    # so this cannot be used to discover which usernames exist.
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Username or password is incorrect.")

    token, max_age = _issue_token(user["username"], remember=body.remember)
    _set_session_cookie(response, token, max_age)
    return {"username": user["username"], "remember": body.remember}


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(request: FastAPIRequest) -> dict:
    return current_user(request)


@router.get("/reset-password/check")
def reset_password_check(username: str) -> dict:
    """Does an account exist for this email? Used by the reset flow's first
    screen so it can say "we don't have an account for that email".

    Note: this is deliberately an account-existence oracle, matching the
    product decision to give farmers a helpful message. A stricter app would
    always reply "if it exists we've emailed you" to prevent enumeration.
    """
    if not db.get_user_by_username(username.strip()):
        raise HTTPException(
            status_code=404,
            detail="We don't have an account for that email.",
        )
    return {"exists": True}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest) -> dict:
    """Demo-mode reset: no email server, so we set the new password directly
    once the username is known to exist. A production version would email a
    signed, single-use, expiring token instead (see SECURITY.md)."""
    username = body.username.strip()
    if not db.get_user_by_username(username):
        raise HTTPException(
            status_code=404,
            detail="We don't have an account for that username.",
        )
    db.update_password(username, hash_password(body.new_password))
    return {"ok": True, "username": username}
