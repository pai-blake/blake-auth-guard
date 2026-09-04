"""
config/db.py
Database Connection & Management Layer
Condition 1: Connects to PostgreSQL using DATABASE_URL or PG_* env variables.
Condition 2: Automatically falls back to SQLite (database/authguard.db) if PostgreSQL is unreachable.
"""
import os
import re
import json
import shutil
import sqlite3
import hashlib
import secrets
import hmac
import importlib
import threading
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
STORAGE_DIR = ROOT_DIR / 'database'
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
SQLITE_DB_PATH = STORAGE_DIR / 'authguard.db'
LEGACY_DB_PATH = ROOT_DIR / 'data' / 'authguard.db'

if not SQLITE_DB_PATH.exists() and LEGACY_DB_PATH.exists():
    shutil.copy2(LEGACY_DB_PATH, SQLITE_DB_PATH)

load_dotenv(dotenv_path=ROOT_DIR / '.env')

DB_ENGINE = None  # 'postgresql' or 'sqlite'
_db_lock = threading.Lock()

try:
    psycopg2 = importlib.import_module('psycopg2')
    RealDictCursor = importlib.import_module('psycopg2.extras').RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False


# ==========================================================================
# Cryptographic Password Hashing (PBKDF2-HMAC-SHA256)
# ==========================================================================
def hash_password(password: str, salt: str = None) -> str:
    if not password:
        return ''
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return f"{salt}${key}"


def verify_password(password: str, stored_hash: str) -> bool:
    if not password or not stored_hash or '$' not in stored_hash:
        return False
    salt, expected_key = stored_hash.split('$', 1)
    test_key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return hmac.compare_digest(test_key, expected_key)


# ==========================================================================
# Connection Probing & Discovery
# ==========================================================================
def _test_postgresql():
    """Attempts to establish a test connection to PostgreSQL."""
    if not PSYCOPG2_AVAILABLE:
        return False

    db_url = os.getenv('DATABASE_URL', '')
    # Render (and some cloud providers) use "postgres://" but psycopg2 requires "postgresql://"
    if db_url.startswith('postgres://'):
        db_url = db_url.replace('postgres://', 'postgresql://', 1)

    pg_host = os.getenv('PG_HOST') or os.getenv('POSTGRES_HOST')
    pg_port = os.getenv('PG_PORT') or os.getenv('POSTGRES_PORT') or '5432'
    pg_user = os.getenv('PG_USER') or os.getenv('POSTGRES_USER')
    pg_pass = os.getenv('PG_PASSWORD') or os.getenv('POSTGRES_PASSWORD')
    pg_name = os.getenv('PG_DATABASE') or os.getenv('POSTGRES_DB') or 'authguard'

    if not db_url and not pg_host and not pg_user:
        return False

    try:
        if db_url:
            conn = psycopg2.connect(db_url, connect_timeout=5)
        else:
            conn = psycopg2.connect(
                host=pg_host or 'localhost',
                port=int(pg_port),
                user=pg_user or 'postgres',
                password=pg_pass or '',
                dbname=pg_name,
                connect_timeout=5
            )
        conn.close()
        return True
    except Exception as e:
        print(f"[PostgreSQL Probe Failed] {e}")
        return False


def get_connection():
    """Returns a new connection for the active database engine."""
    global DB_ENGINE
    if DB_ENGINE == 'postgresql':
        db_url = os.getenv('DATABASE_URL', '')
        # Normalize Render's postgres:// to psycopg2-compatible postgresql://
        if db_url.startswith('postgres://'):
            db_url = db_url.replace('postgres://', 'postgresql://', 1)
        if db_url:
            return psycopg2.connect(db_url, cursor_factory=RealDictCursor)
        return psycopg2.connect(
            host=os.getenv('PG_HOST') or 'localhost',
            port=int(os.getenv('PG_PORT') or '5432'),
            user=os.getenv('PG_USER') or 'postgres',
            password=os.getenv('PG_PASSWORD') or '',
            dbname=os.getenv('PG_DATABASE') or 'authguard',
            cursor_factory=RealDictCursor
        )
    else:
        conn = sqlite3.connect(str(SQLITE_DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn


def _migrate_legacy_messages(cur):
    """One-time migration: move the legacy flat `messages` table (email-keyed)
    into the conversation-based content schema. Rows whose emails no longer
    match a user are skipped. Idempotent — skips if already migrated."""
    try:
        if DB_ENGINE == 'postgresql':
            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'messages'
            """)
            cols = [r[0] for r in cur.fetchall()]
        else:
            cur.execute("PRAGMA table_info(messages)")
            cols = [r[1] for r in cur.fetchall()]

        if 'sender_email' not in cols:
            return  # never existed, or already migrated

        cur.execute("ALTER TABLE messages RENAME TO messages_legacy")
        cur.execute("SELECT sender_email, receiver_email, text, COALESCE(status, 'sent') FROM messages_legacy ORDER BY created_at")
        rows = cur.fetchall()
        moved = 0
        for r in rows:
            s_email, r_email, text, status = (r[0], r[1], r[2], r[3])
            if DB_ENGINE == 'postgresql':
                cur.execute("SELECT id FROM users WHERE LOWER(email) = %s", (s_email,))
                s_row = cur.fetchone()
                cur.execute("SELECT id FROM users WHERE LOWER(email) = %s", (r_email,))
                r_row = cur.fetchone()
                s_id = s_row[0] if s_row else None
                r_id = r_row[0] if r_row else None
            else:
                cur.execute("SELECT id FROM users WHERE LOWER(email) = ?", (s_email,))
                s_row = cur.fetchone()
                cur.execute("SELECT id FROM users WHERE LOWER(email) = ?", (r_email,))
                r_row = cur.fetchone()
                s_id = s_row['id'] if s_row else None
                r_id = r_row['id'] if r_row else None
            if not s_id or not r_id:
                continue
            convo_id = _get_or_create_conversation(cur, s_id, r_id)
            if DB_ENGINE == 'postgresql':
                cur.execute("""
                    INSERT INTO chat_messages (conversation_id, sender_id, text, status)
                    VALUES (%s, %s, %s, %s)
                """, (convo_id, s_id, text, status))
            else:
                cur.execute("""
                    INSERT INTO chat_messages (conversation_id, sender_id, text, status)
                    VALUES (?, ?, ?, ?)
                """, (convo_id, s_id, text, status))
            moved += 1
        print(f'[Migration] legacy messages -> chat_messages: {moved} rows moved')
    except Exception as e:
        print(f'[Migration] legacy messages skipped: {e}')


def _get_or_create_conversation(cur, user_a: str, user_b: str) -> int:
    """Find the conversation both users share, or create it. This link table
    (conversation_participants) is the many-to-many users <-> conversations map."""
    ph = '%s' if DB_ENGINE == 'postgresql' else '?'
    cur.execute(f"""
        SELECT cp.conversation_id
        FROM conversation_participants cp
        JOIN conversation_participants cp2 ON cp.conversation_id = cp2.conversation_id
        WHERE cp.user_id = {ph} AND cp2.user_id = {ph}
        LIMIT 1
    """, (user_a, user_b))
    row = cur.fetchone()
    if row:
        return row[0]

    if DB_ENGINE == 'postgresql':
        cur.execute("INSERT INTO conversations DEFAULT VALUES RETURNING id")
        convo_id = cur.fetchone()[0]
    else:
        cur.execute("INSERT INTO conversations DEFAULT VALUES")
        convo_id = cur.lastrowid

    for u in (user_a, user_b):
        if DB_ENGINE == 'postgresql':
            cur.execute("""
                INSERT INTO conversation_participants (conversation_id, user_id)
                VALUES (%s, %s) ON CONFLICT DO NOTHING
            """, (convo_id, u))
        else:
            cur.execute("""
                INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id)
                VALUES (?, ?)
            """, (convo_id, u))
    return convo_id


def _sync_dual_user_tables(cur):
    """Ensure users_private and users_public tables exist and are synchronized."""
    try:
        cur.execute("SELECT id, name, email, password_hash, created_at, username, avatar FROM users")
        rows = cur.fetchall()
        for r in rows:
            if DB_ENGINE == 'postgresql':
                u_id, u_name, u_email, u_pwd, u_created, u_username, u_avatar = r
            else:
                u_id = r['id']
                u_name = r['name']
                u_email = r['email']
                u_pwd = r['password_hash']
                u_created = r['created_at']
                u_username = r['username'] or (u_email.split('@')[0] if u_email else 'user')
                u_avatar = r['avatar']

            pub_key = f"pub_{hashlib.sha256(u_id.encode()).hexdigest()[:16]}"
            clean_username = u_username or (u_email.split('@')[0] if u_email else 'user')

            if DB_ENGINE == 'postgresql':
                cur.execute("""
                    INSERT INTO users_private (private_key, public_key, email, passwords, create_date, update_date)
                    VALUES (%s, %s, %s, %s, COALESCE(%s, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
                    ON CONFLICT (private_key) DO UPDATE SET
                        email = EXCLUDED.email,
                        passwords = COALESCE(EXCLUDED.passwords, users_private.passwords);
                """, (u_id, pub_key, u_email.lower(), u_pwd, u_created))
                cur.execute("""
                    INSERT INTO users_public (private_key, public_key, name, username, user_profile_photo)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (private_key) DO UPDATE SET
                        name = EXCLUDED.name,
                        username = EXCLUDED.username,
                        user_profile_photo = COALESCE(EXCLUDED.user_profile_photo, users_public.user_profile_photo);
                """, (u_id, pub_key, u_name, clean_username, u_avatar))
            else:
                cur.execute("""
                    INSERT INTO users_private (private_key, public_key, email, passwords, create_date, update_date)
                    VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
                    ON CONFLICT(private_key) DO UPDATE SET
                        email = excluded.email,
                        passwords = COALESCE(excluded.passwords, users_private.passwords);
                """, (u_id, pub_key, u_email.lower(), u_pwd, u_created))
                cur.execute("""
                    INSERT INTO users_public (private_key, public_key, name, username, user_profile_photo)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(private_key) DO UPDATE SET
                        name = excluded.name,
                        username = excluded.username,
                        user_profile_photo = COALESCE(excluded.user_profile_photo, users_public.user_profile_photo);
                """, (u_id, pub_key, u_name, clean_username, u_avatar))
    except Exception as e:
        pass


def init_db():
    """Initializes Database tables on startup with auto-fallback."""
    global DB_ENGINE

    # 1. Condition One: Try PostgreSQL
    if _test_postgresql():
        DB_ENGINE = 'postgresql'
        print("====================================================")
        print("[Database] Connected successfully to PostgreSQL!")
        print("====================================================")
    else:
        # 2. Condition Two: Fallback to SQLite
        DB_ENGINE = 'sqlite'
        print("====================================================")
        print(f"[Database Fallback] Using SQLite: {SQLITE_DB_PATH.name}")
        print("====================================================")

    # Initialize Tables
    with _db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            if DB_ENGINE == 'postgresql':
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id VARCHAR(64) PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        password_hash VARCHAR(255),
                        verified BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS otps (
                        email VARCHAR(255) PRIMARY KEY,
                        code VARCHAR(16) NOT NULL,
                        purpose VARCHAR(64) NOT NULL,
                        pending_data TEXT,
                        attempts INTEGER DEFAULT 0,
                        expires_at DOUBLE PRECISION NOT NULL
                    );
                """)
            else:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT,
                        verified INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS otps (
                        email TEXT PRIMARY KEY,
                        code TEXT NOT NULL,
                        purpose TEXT NOT NULL,
                        pending_data TEXT,
                        attempts INTEGER DEFAULT 0,
                        expires_at REAL NOT NULL
                    );
                """)
                # NOTE: the legacy flat `messages` table is no longer created.
                # Chat content lives in conversations / chat_messages /
                # media_files / call_logs (see below). Existing legacy tables
                # are migrated once by _migrate_legacy_messages().

            # ── Dual User Tables: Private & Public ─────────────────────────
            # 1. Private table (for account owner only): private_key, public_key, email, passwords, create_date, update_date
            # 2. Public table (for social communication): private_key, public_key, name, username, user_profile_photo
            if DB_ENGINE == 'postgresql':
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users_private (
                        private_key VARCHAR(64) PRIMARY KEY,
                        public_key VARCHAR(64) UNIQUE NOT NULL,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        passwords TEXT,
                        create_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users_public (
                        private_key VARCHAR(64) PRIMARY KEY,
                        public_key VARCHAR(64) UNIQUE NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        username VARCHAR(255) NOT NULL,
                        user_profile_photo TEXT,
                        FOREIGN KEY (private_key) REFERENCES users_private(private_key) ON DELETE CASCADE
                    );
                """)
            else:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users_private (
                        private_key TEXT PRIMARY KEY,
                        public_key TEXT UNIQUE NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        passwords TEXT,
                        create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        update_date DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users_public (
                        private_key TEXT PRIMARY KEY,
                        public_key TEXT UNIQUE NOT NULL,
                        name TEXT NOT NULL,
                        username TEXT NOT NULL,
                        user_profile_photo TEXT,
                        FOREIGN KEY (private_key) REFERENCES users_private(private_key) ON DELETE CASCADE
                    );
                """)

            # Backfill / sync users_private & users_public from users table
            _sync_dual_user_tables(cursor)

            # Ensure username + avatar columns exist for user settings.
            # (username uniqueness is enforced in code, not by a constraint,
            #  because SQLite cannot add a UNIQUE column via ALTER TABLE.)
            for column in ('username', 'avatar'):
                try:
                    if DB_ENGINE == 'postgresql':
                        cursor.execute(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {column} TEXT;")
                    else:
                        cursor.execute(f"ALTER TABLE users ADD COLUMN {column} TEXT;")
                except Exception:
                    pass

            # ── User-content schema ────────────────────────────────────────
            # Personal data lives in `users`. Everything users SEND to each
            # other lives in content tables linked M:N to users through
            # conversations (conversation_participants).
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id {pk},
                    created_at {ts} DEFAULT CURRENT_TIMESTAMP
                );
            """.format(pk='SERIAL PRIMARY KEY' if DB_ENGINE == 'postgresql' else 'INTEGER PRIMARY KEY AUTOINCREMENT',
                       ts='TIMESTAMP' if DB_ENGINE == 'postgresql' else 'DATETIME'))
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS conversation_participants (
                    conversation_id INTEGER NOT NULL,
                    user_id VARCHAR(64) NOT NULL,
                    joined_at {ts} DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (conversation_id, user_id)
                );
            """.format(ts='TIMESTAMP' if DB_ENGINE == 'postgresql' else 'DATETIME'))
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id {pk},
                    conversation_id INTEGER NOT NULL,
                    sender_id VARCHAR(64) NOT NULL,
                    text TEXT NOT NULL,
                    status VARCHAR(32) DEFAULT 'sent',
                    is_read {bool} DEFAULT 0,
                    created_at {ts} DEFAULT CURRENT_TIMESTAMP
                );
            """.format(pk='SERIAL PRIMARY KEY' if DB_ENGINE == 'postgresql' else 'INTEGER PRIMARY KEY AUTOINCREMENT',
                       ts='TIMESTAMP' if DB_ENGINE == 'postgresql' else 'DATETIME',
                       bool='BOOLEAN' if DB_ENGINE == 'postgresql' else 'INTEGER'))
            # Media (photos / files / VIDEOS). Video payloads are purged after
            # MEDIA_VIDEO_RETENTION_DAYS — only the name + log row remain.
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS media_files (
                    id {pk},
                    conversation_id INTEGER NOT NULL,
                    sender_id VARCHAR(64) NOT NULL,
                    receiver_id VARCHAR(64),
                    file_name TEXT NOT NULL,
                    file_type VARCHAR(16) NOT NULL,
                    mime_type TEXT,
                    file_data TEXT,
                    file_size INTEGER,
                    expires_at {dbl},
                    media_expired {bool} DEFAULT 0,
                    created_at {ts} DEFAULT CURRENT_TIMESTAMP
                );
            """.format(pk='SERIAL PRIMARY KEY' if DB_ENGINE == 'postgresql' else 'INTEGER PRIMARY KEY AUTOINCREMENT',
                       ts='TIMESTAMP' if DB_ENGINE == 'postgresql' else 'DATETIME',
                       dbl='DOUBLE PRECISION' if DB_ENGINE == 'postgresql' else 'REAL',
                       bool='BOOLEAN' if DB_ENGINE == 'postgresql' else 'INTEGER'))
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS call_logs (
                    id {pk},
                    conversation_id INTEGER NOT NULL,
                    caller_id VARCHAR(64) NOT NULL,
                    callee_id VARCHAR(64) NOT NULL,
                    call_type VARCHAR(16) DEFAULT 'voice',
                    status VARCHAR(16) DEFAULT 'ended',
                    started_at {dbl},
                    ended_at {dbl},
                    duration_seconds INTEGER DEFAULT 0,
                    created_at {ts} DEFAULT CURRENT_TIMESTAMP
                );
            """.format(pk='SERIAL PRIMARY KEY' if DB_ENGINE == 'postgresql' else 'INTEGER PRIMARY KEY AUTOINCREMENT',
                       ts='TIMESTAMP' if DB_ENGINE == 'postgresql' else 'DATETIME',
                       dbl='DOUBLE PRECISION' if DB_ENGINE == 'postgresql' else 'REAL'))

            # Saved contacts: many-to-many users <-> users (address book)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS saved_contacts (
                    user_id VARCHAR(64) NOT NULL,
                    contact_id VARCHAR(64) NOT NULL,
                    created_at {ts} DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, contact_id)
                );
            """.format(ts='TIMESTAMP' if DB_ENGINE == 'postgresql' else 'DATETIME'))

            # Per-user contact options: pin / archive / mute (one row per pair)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contact_preferences (
                    user_id VARCHAR(64) NOT NULL,
                    contact_id VARCHAR(64) NOT NULL,
                    archived {bool} DEFAULT 0,
                    pinned {bool} DEFAULT 0,
                    pinned_at {dbl},
                    muted_until {dbl},
                    PRIMARY KEY (user_id, contact_id)
                );
            """.format(ts='TIMESTAMP' if DB_ENGINE == 'postgresql' else 'DATETIME',
                       dbl='DOUBLE PRECISION' if DB_ENGINE == 'postgresql' else 'REAL',
                       bool='BOOLEAN' if DB_ENGINE == 'postgresql' else 'INTEGER'))

            # Per-user hidden content ("clear history for me"):
            # kind = 'message' | 'media' | 'call', item_id = row id
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS hidden_content (
                    user_id VARCHAR(64) NOT NULL,
                    kind VARCHAR(16) NOT NULL,
                    item_id INTEGER NOT NULL,
                    hidden_at {ts} DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, kind, item_id)
                );
            """.format(ts='TIMESTAMP' if DB_ENGINE == 'postgresql' else 'DATETIME'))

            # Contact Favourites table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contact_favourites (
                    user_id VARCHAR(64) NOT NULL,
                    contact_id VARCHAR(64) NOT NULL,
                    created_at {ts} DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, contact_id)
                );
            """.format(ts='TIMESTAMP' if DB_ENGINE == 'postgresql' else 'DATETIME'))

            # Custom Contact Pages table (user-created extra pages, max 3 extra / 6 total)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contact_pages (
                    id {pk},
                    user_id VARCHAR(64) NOT NULL,
                    page_id VARCHAR(64) NOT NULL,
                    page_name VARCHAR(128) NOT NULL,
                    page_icon VARCHAR(64) DEFAULT 'folder',
                    created_at {ts} DEFAULT CURRENT_TIMESTAMP
                );
            """.format(pk='SERIAL PRIMARY KEY' if DB_ENGINE == 'postgresql' else 'INTEGER PRIMARY KEY AUTOINCREMENT',
                       ts='TIMESTAMP' if DB_ENGINE == 'postgresql' else 'DATETIME'))

            # Account deletion confirmation tokens (emailed to the user)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS account_deletion_tokens (
                    token VARCHAR(128) PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    expires_at {dbl} NOT NULL,
                    created_at {ts} DEFAULT CURRENT_TIMESTAMP
                );
            """.format(ts='TIMESTAMP' if DB_ENGINE == 'postgresql' else 'DATETIME',
                       dbl='DOUBLE PRECISION' if DB_ENGINE == 'postgresql' else 'REAL'))

            # Calendar Events table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS calendar_events (
                    id VARCHAR(64) PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    title VARCHAR(140) NOT NULL,
                    description TEXT,
                    start_dt VARCHAR(32) NOT NULL,
                    end_dt VARCHAR(32) NOT NULL,
                    all_day INTEGER DEFAULT 0,
                    color VARCHAR(32) DEFAULT '#6C63FF',
                    category VARCHAR(32) DEFAULT 'general',
                    location VARCHAR(256),
                    recurrence VARCHAR(128),
                    reminder_min INTEGER DEFAULT NULL,
                    attendees TEXT DEFAULT '',
                    created_at {ts} DEFAULT CURRENT_TIMESTAMP,
                    updated_at {ts} DEFAULT CURRENT_TIMESTAMP
                );
            """.format(ts='TIMESTAMP' if DB_ENGINE == 'postgresql' else 'DATETIME'))

            # Create performance indexes for calendar_events on both engines
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events(user_id);" if DB_ENGINE == 'sqlite' else "CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events (user_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_calendar_dates ON calendar_events(user_id, start_dt, end_dt);" if DB_ENGINE == 'sqlite' else "CREATE INDEX IF NOT EXISTS idx_calendar_dates ON calendar_events (user_id, start_dt, end_dt);")

            # ── One-time migration: legacy flat `messages` table ──────────
            _migrate_legacy_messages(cursor)

            conn.commit()
        finally:
            conn.close()


def get_db_status():
    """Returns the current database engine status."""
    return {
        'engine': DB_ENGINE,
        'sqlite_path': str(SQLITE_DB_PATH) if DB_ENGINE == 'sqlite' else None
    }


# ==========================================================================
# Unified CRUD Operations (PostgreSQL & SQLite)
# ==========================================================================

def db_save_otp(email: str, code: str, purpose: str, pending_data: dict, expires_at: float):
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            p_data_json = json.dumps(pending_data or {})
            if DB_ENGINE == 'postgresql':
                cur.execute("""
                    INSERT INTO otps (email, code, purpose, pending_data, attempts, expires_at)
                    VALUES (%s, %s, %s, %s, 0, %s)
                    ON CONFLICT (email) DO UPDATE SET
                        code = EXCLUDED.code,
                        purpose = EXCLUDED.purpose,
                        pending_data = EXCLUDED.pending_data,
                        attempts = 0,
                        expires_at = EXCLUDED.expires_at;
                """, (email.lower(), code, purpose, p_data_json, expires_at))
            else:
                cur.execute("""
                    INSERT OR REPLACE INTO otps (email, code, purpose, pending_data, attempts, expires_at)
                    VALUES (?, ?, ?, ?, 0, ?);
                """, (email.lower(), code, purpose, p_data_json, expires_at))
            conn.commit()
        finally:
            conn.close()


def db_get_otp(email: str):
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            if DB_ENGINE == 'postgresql':
                cur.execute("SELECT email, code, purpose, pending_data, attempts, expires_at FROM otps WHERE email = %s", (email.lower(),))
                row = cur.fetchone()
                if row:
                    return {
                        'email': row[0],
                        'code': row[1],
                        'purpose': row[2],
                        'pending_data': json.loads(row[3]) if row[3] else {},
                        'attempts': row[4],
                        'expires_at': row[5]
                    }
            else:
                cur.execute("SELECT email, code, purpose, pending_data, attempts, expires_at FROM otps WHERE email = ?", (email.lower(),))
                row = cur.fetchone()
                if row:
                    return {
                        'email': row['email'],
                        'code': row['code'],
                        'purpose': row['purpose'],
                        'pending_data': json.loads(row['pending_data']) if row['pending_data'] else {},
                        'attempts': row['attempts'],
                        'expires_at': row['expires_at']
                    }
            return None
        finally:
            conn.close()


def db_increment_otp_attempt(email: str):
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            if DB_ENGINE == 'postgresql':
                cur.execute("UPDATE otps SET attempts = attempts + 1 WHERE email = %s", (email.lower(),))
            else:
                cur.execute("UPDATE otps SET attempts = attempts + 1 WHERE email = ?", (email.lower(),))
            conn.commit()
        finally:
            conn.close()


def db_delete_otp(email: str):
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            if DB_ENGINE == 'postgresql':
                cur.execute("DELETE FROM otps WHERE email = %s", (email.lower(),))
            else:
                cur.execute("DELETE FROM otps WHERE email = ?", (email.lower(),))
            conn.commit()
        finally:
            conn.close()


def db_get_user(email: str):
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            if DB_ENGINE == 'postgresql':
                cur.execute("""
                    SELECT pr.private_key, pu.public_key, pu.name, pr.email, pr.passwords,
                           pr.create_date, pr.update_date, pu.username, pu.user_profile_photo
                    FROM users_private pr
                    JOIN users_public pu ON pu.private_key = pr.private_key
                    WHERE LOWER(pr.email) = %s
                """, (email.lower(),))
                row = cur.fetchone()
                if row:
                    return {
                        'id': row[0], 'private_key': row[0], 'public_key': row[1],
                        'name': row[2], 'email': row[3], 'password_hash': row[4],
                        'passwords': row[4], 'created_at': str(row[5]), 'create_date': str(row[5]),
                        'updated_at': str(row[6]), 'update_date': str(row[6]),
                        'username': row[7], 'avatar': row[8], 'user_profile_photo': row[8],
                        'verified': True
                    }
                # Fallback to legacy users table
                cur.execute("SELECT id, name, email, password_hash, verified, created_at, username, avatar FROM users WHERE email = %s", (email.lower(),))
                row = cur.fetchone()
                if row:
                    pub_key = f"pub_{hashlib.sha256(row[0].encode()).hexdigest()[:16]}"
                    return {
                        'id': row[0], 'private_key': row[0], 'public_key': pub_key,
                        'name': row[1], 'email': row[2],
                        'password_hash': row[3], 'passwords': row[3], 'verified': row[4],
                        'created_at': str(row[5]), 'create_date': str(row[5]),
                        'username': row[6], 'avatar': row[7], 'user_profile_photo': row[7]
                    }
            else:
                cur.execute("""
                    SELECT pr.private_key, pu.public_key, pu.name, pr.email, pr.passwords,
                           pr.create_date, pr.update_date, pu.username, pu.user_profile_photo
                    FROM users_private pr
                    JOIN users_public pu ON pu.private_key = pr.private_key
                    WHERE LOWER(pr.email) = ?
                """, (email.lower(),))
                row = cur.fetchone()
                if row:
                    return {
                        'id': row['private_key'], 'private_key': row['private_key'], 'public_key': row['public_key'],
                        'name': row['name'], 'email': row['email'], 'password_hash': row['passwords'],
                        'passwords': row['passwords'], 'created_at': str(row['create_date']), 'create_date': str(row['create_date']),
                        'updated_at': str(row['update_date']), 'update_date': str(row['update_date']),
                        'username': row['username'], 'avatar': row['user_profile_photo'], 'user_profile_photo': row['user_profile_photo'],
                        'verified': True
                    }
                # Fallback
                cur.execute("SELECT id, name, email, password_hash, verified, created_at, username, avatar FROM users WHERE email = ?", (email.lower(),))
                row = cur.fetchone()
                if row:
                    pub_key = f"pub_{hashlib.sha256(row['id'].encode()).hexdigest()[:16]}"
                    return {
                        'id': row['id'], 'private_key': row['id'], 'public_key': pub_key,
                        'name': row['name'], 'email': row['email'],
                        'password_hash': row['password_hash'], 'passwords': row['password_hash'],
                        'verified': bool(row['verified']), 'created_at': str(row['created_at']), 'create_date': str(row['created_at']),
                        'username': row['username'], 'avatar': row['avatar'], 'user_profile_photo': row['avatar']
                    }
            return None
        finally:
            conn.close()


# ==========================================================================
# Username & Profile Management
# ==========================================================================
USERNAME_PREFIX = 'authguard_user_'
USERNAME_PATTERN = re.compile(r'^' + USERNAME_PREFIX + r'(\d{6,})$')

# Media retention: video payloads are purged after this many days.
# The media_files row itself stays — only the name and the log remain.
MEDIA_VIDEO_RETENTION_DAYS = 90


def _generate_username(cur) -> str:
    """Next system username: authguard_user_000001, +1 per user (caller holds lock)."""
    if DB_ENGINE == 'postgresql':
        cur.execute("SELECT username FROM users WHERE username LIKE %s", (USERNAME_PREFIX + '%',))
    else:
        cur.execute("SELECT username FROM users WHERE username LIKE ?", (USERNAME_PREFIX + '%',))
    highest = 0
    for (username,) in cur.fetchall():
        match = USERNAME_PATTERN.match(username or '')
        if match:
            highest = max(highest, int(match.group(1)))
    return f"{USERNAME_PREFIX}{highest + 1:06d}"


def db_next_username() -> str:
    """Public: next available system username."""
    with _db_lock:
        conn = get_connection()
        try:
            return _generate_username(conn.cursor())
        finally:
            conn.close()


def db_username_exists(username: str, exclude_email: str = None) -> bool:
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            if DB_ENGINE == 'postgresql':
                cur.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(%s) AND LOWER(email) != LOWER(%s)",
                            (username, exclude_email or ''))
            else:
                cur.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND LOWER(email) != LOWER(?)",
                            (username, exclude_email or ''))
            return cur.fetchone() is not None
        finally:
            conn.close()


def db_ensure_username(email: str) -> str:
    """Assign the next system username to a user who has none. Returns username."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            if DB_ENGINE == 'postgresql':
                cur.execute("SELECT username FROM users WHERE email = %s", (email.lower(),))
            else:
                cur.execute("SELECT username FROM users WHERE email = ?", (email.lower(),))
            row = cur.fetchone()
            current = (row[0] if DB_ENGINE == 'postgresql' else row['username']) if row else None
            if current:
                return current
            username = _generate_username(cur)
            if DB_ENGINE == 'postgresql':
                cur.execute("UPDATE users SET username = %s WHERE email = %s", (username, email.lower()))
            else:
                cur.execute("UPDATE users SET username = ? WHERE email = ?", (username, email.lower()))
            conn.commit()
            return username
        finally:
            conn.close()


def db_update_user_profile(email: str, name=None, username=None, avatar=None):
    """Update profile fields across users_public, users_private, and users."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            if username is not None:
                if DB_ENGINE == 'postgresql':
                    cur.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(%s) AND LOWER(email) != LOWER(%s)",
                                (username, email.lower()))
                else:
                    cur.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND LOWER(email) != LOWER(?)",
                                (username, email.lower()))
                if cur.fetchone():
                    return False, 'That username is already taken.'

            sets, params = [], []
            if name is not None:
                sets.append("name = %s" if DB_ENGINE == 'postgresql' else "name = ?")
                params.append(name)
            if username is not None:
                sets.append("username = %s" if DB_ENGINE == 'postgresql' else "username = ?")
                params.append(username)
            if avatar is not None:
                sets.append("avatar = %s" if DB_ENGINE == 'postgresql' else "avatar = ?")
                params.append(avatar)
            if not sets:
                return False, 'Nothing to update.'
            
            # 1. Update legacy users table
            u_params = list(params) + [email.lower()]
            cur.execute(f"UPDATE users SET {', '.join(sets)} WHERE LOWER(email) = {('%s' if DB_ENGINE == 'postgresql' else '?')}", u_params)

            # 2. Update users_public and users_private
            u_id = _resolve_user_id(cur, email)
            if u_id:
                pub_sets, pub_params = [], []
                if name is not None:
                    pub_sets.append("name = %s" if DB_ENGINE == 'postgresql' else "name = ?")
                    pub_params.append(name)
                if username is not None:
                    pub_sets.append("username = %s" if DB_ENGINE == 'postgresql' else "username = ?")
                    pub_params.append(username)
                if avatar is not None:
                    pub_sets.append("user_profile_photo = %s" if DB_ENGINE == 'postgresql' else "user_profile_photo = ?")
                    pub_params.append(avatar)
                if pub_sets:
                    pub_params.append(u_id)
                    cur.execute(f"UPDATE users_public SET {', '.join(pub_sets)} WHERE private_key = {('%s' if DB_ENGINE == 'postgresql' else '?')}", pub_params)

                # update timestamp in private table
                if DB_ENGINE == 'postgresql':
                    cur.execute("UPDATE users_private SET update_date = CURRENT_TIMESTAMP WHERE private_key = %s", (u_id,))
                else:
                    cur.execute("UPDATE users_private SET update_date = CURRENT_TIMESTAMP WHERE private_key = ?", (u_id,))

            conn.commit()
            return True, None
        finally:
            conn.close()


def db_create_user(user_id: str, name: str, email: str, password_hash: str = None, verified: bool = False):
    created = False
    username = None
    pub_key = f"pub_{hashlib.sha256(user_id.encode()).hexdigest()[:16]}"
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            existed = _resolve_user_id(cur, email) is not None
            username = _generate_username(cur)
            if DB_ENGINE == 'postgresql':
                cur.execute("""
                    INSERT INTO users (id, name, email, password_hash, verified, username)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (email) DO UPDATE SET
                        name = EXCLUDED.name,
                        password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
                        verified = EXCLUDED.verified;
                """, (user_id, name, email.lower(), password_hash, verified, username))
                cur.execute("""
                    INSERT INTO users_private (private_key, public_key, email, passwords, create_date, update_date)
                    VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT (private_key) DO UPDATE SET
                        email = EXCLUDED.email,
                        passwords = COALESCE(EXCLUDED.passwords, users_private.passwords),
                        update_date = CURRENT_TIMESTAMP;
                """, (user_id, pub_key, email.lower(), password_hash))
                cur.execute("""
                    INSERT INTO users_public (private_key, public_key, name, username)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (private_key) DO UPDATE SET
                        name = EXCLUDED.name,
                        username = EXCLUDED.username;
                """, (user_id, pub_key, name, username))
            else:
                cur.execute("""
                    INSERT INTO users (id, name, email, password_hash, verified, username)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(email) DO UPDATE SET
                        name = excluded.name,
                        password_hash = COALESCE(excluded.password_hash, users.password_hash),
                        verified = excluded.verified;
                """, (user_id, name, email.lower(), password_hash, 1 if verified else 0, username))
                cur.execute("""
                    INSERT INTO users_private (private_key, public_key, email, passwords, create_date, update_date)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT(private_key) DO UPDATE SET
                        email = excluded.email,
                        passwords = COALESCE(excluded.passwords, users_private.passwords),
                        update_date = CURRENT_TIMESTAMP;
                """, (user_id, pub_key, email.lower(), password_hash))
                cur.execute("""
                    INSERT INTO users_public (private_key, public_key, name, username)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(private_key) DO UPDATE SET
                        name = excluded.name,
                        username = excluded.username;
                """, (user_id, pub_key, name, username))
            conn.commit()
            created = not existed
        finally:
            conn.close()

    # Admin bot: welcome every brand-new user exactly once (outside the lock).
    if created:
        try:
            from core.body.bots.admin_bot import send_welcome_if_new
            send_welcome_if_new(email, name=name, username=username)
        except ImportError:
            pass
        except Exception as bot_error:
            print(f'[Bot] welcome message failed: {bot_error}')
    return True


def db_update_user_password(email: str, new_password_hash: str):
    updated = False
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"UPDATE users SET password_hash = {ph} WHERE LOWER(email) = {ph}",
                        (new_password_hash, email.lower()))
            u_id = _resolve_user_id(cur, email)
            if u_id:
                cur.execute(f"UPDATE users_private SET passwords = {ph}, update_date = CURRENT_TIMESTAMP WHERE private_key = {ph}",
                            (new_password_hash, u_id))
            conn.commit()
            updated = cur.rowcount > 0
        finally:
            conn.close()

    # Admin bot: security notification with the exact change time.
    if updated:
        try:
            from core.body.bots.admin_bot import notify_password_changed
            notify_password_changed(email)
        except ImportError:
            pass
        except Exception as bot_error:
            print(f'[Bot] security notice failed: {bot_error}')
    return True


def db_delete_account(email: str):
    """Permanently delete an account and every trace of it:
    profile, conversations, sent messages/media/call logs, saved contacts,
    preferences, hidden-content records, OTP rows, and both private/public user tables."""
    try:
        from core.body.bots.admin_bot import BOT_ID
    except ImportError:
        BOT_ID = None
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, email)
            if not u_id:
                return False
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'

            convos = [r[0] for r in cur.execute(f"""
                SELECT conversation_id FROM conversation_participants WHERE user_id = {ph}
            """, (u_id,)).fetchall()]

            for convo_id in convos:
                # remove everything the account sent
                cur.execute(f"""
                    DELETE FROM chat_messages
                    WHERE conversation_id = {ph} AND sender_id = {ph}
                """, (convo_id, u_id))
                cur.execute(f"""
                    DELETE FROM media_files
                    WHERE conversation_id = {ph} AND sender_id = {ph}
                """, (convo_id, u_id))
                cur.execute(f"""
                    DELETE FROM call_logs
                    WHERE conversation_id = {ph} AND (caller_id = {ph} OR callee_id = {ph})
                """, (convo_id, u_id, u_id))
                cur.execute(f"""
                    DELETE FROM conversation_participants
                    WHERE conversation_id = {ph} AND user_id = {ph}
                """, (convo_id, u_id))
                remaining = [r[0] for r in cur.execute(f"""
                    SELECT user_id FROM conversation_participants WHERE conversation_id = {ph}
                """, (convo_id,)).fetchall()]
                if not remaining or all(rid == BOT_ID for rid in remaining):
                    cur.execute(f"DELETE FROM chat_messages WHERE conversation_id = {ph}", (convo_id,))
                    cur.execute(f"DELETE FROM media_files WHERE conversation_id = {ph}", (convo_id,))
                    cur.execute(f"DELETE FROM call_logs WHERE conversation_id = {ph}", (convo_id,))
                    for rid in remaining:
                        cur.execute(f"""
                            DELETE FROM conversation_participants
                            WHERE conversation_id = {ph} AND user_id = {ph}
                        """, (convo_id, rid))
                    cur.execute(f"DELETE FROM conversations WHERE id = {ph}", (convo_id,))

            cur.execute(f"DELETE FROM saved_contacts WHERE user_id = {ph} OR contact_id = {ph}", (u_id, u_id))
            cur.execute(f"DELETE FROM contact_preferences WHERE user_id = {ph} OR contact_id = {ph}", (u_id, u_id))
            cur.execute(f"DELETE FROM hidden_content WHERE user_id = {ph}", (u_id,))
            cur.execute(f"DELETE FROM otps WHERE email = {ph}", (email.lower(),))
            cur.execute(f"DELETE FROM users_public WHERE private_key = {ph}", (u_id,))
            cur.execute(f"DELETE FROM users_private WHERE private_key = {ph}", (u_id,))
            cur.execute(f"DELETE FROM users WHERE id = {ph}", (u_id,))
            conn.commit()
            return True
        finally:
            conn.close()


def db_create_deletion_token(email: str, ttl_seconds: int = 900):
    """Create a single-use account-deletion confirmation token.
    Returns (token, expires_at) or (None, None) if the account is missing."""
    import secrets as _secrets
    import time as _time
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, email)
            if not u_id:
                return None, None
            token = _secrets.token_urlsafe(32)
            expires_at = _time.time() + ttl_seconds
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            # one live token per account: replace any previous one
            cur.execute(f"DELETE FROM account_deletion_tokens WHERE user_id = {ph}", (u_id,))
            cur.execute(f"""
                INSERT INTO account_deletion_tokens (token, user_id, expires_at)
                VALUES ({ph}, {ph}, {ph})
            """, (token, u_id, expires_at))
            conn.commit()
            return token, expires_at
        finally:
            conn.close()


def db_peek_deletion_token(token: str):
    """Validate a deletion token WITHOUT consuming it.
    Returns the user's email, or None when unknown/expired."""
    import time as _time
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"""
                SELECT t.user_id, t.expires_at, u.email
                FROM account_deletion_tokens t
                JOIN users u ON u.id = t.user_id
                WHERE t.token = {ph}
            """, (token,))
            r = cur.fetchone()
            if not r:
                return None
            if DB_ENGINE == 'postgresql':
                expires_at, email = r[1], r[2]
            else:
                expires_at, email = r['expires_at'], r['email']
            if expires_at < _time.time():
                return None
            return email
        finally:
            conn.close()


def db_consume_deletion_token(token: str):
    """Validate + consume a deletion token. Returns the user's email, or None
    when the token is unknown, expired, or the account no longer exists."""
    import time as _time
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"""
                SELECT t.user_id, t.expires_at, u.email
                FROM account_deletion_tokens t
                JOIN users u ON u.id = t.user_id
                WHERE t.token = {ph}
            """, (token,))
            r = cur.fetchone()
            if not r:
                return None
            if DB_ENGINE == 'postgresql':
                user_id, expires_at, email = r
            else:
                user_id, expires_at, email = r['user_id'], r['expires_at'], r['email']
            cur.execute(f"DELETE FROM account_deletion_tokens WHERE token = {ph}", (token,))
            conn.commit()
            if expires_at < _time.time():
                return None
            return email
        finally:
            conn.close()


def db_update_user_heartbeat(email: str):
    import time
    if not email:
        return False
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            now_ts = time.time()
            if DB_ENGINE == 'postgresql':
                cur.execute("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE LOWER(email) = %s", (email.lower(),))
            else:
                cur.execute("UPDATE users SET last_seen = ? WHERE LOWER(email) = ?", (now_ts, email.lower()))
            conn.commit()
            return True
        finally:
            conn.close()


def db_get_unread_counts(viewer_email: str):
    """Unread TEXT message counts per sender for the viewer's sidebar.
    Returns {sender_email: count} — drives the Unread tab.
    Messages hidden via 'clear for me' are excluded."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            v_id = _resolve_user_id(cur, viewer_email)
            if not v_id:
                return {}
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            hidden = _hidden_ids_for(cur, v_id, 'message')
            cur.execute(f"""
                SELECT u.email, cm.id
                FROM chat_messages cm
                JOIN conversation_participants mine
                  ON mine.conversation_id = cm.conversation_id AND mine.user_id = {ph}
                JOIN conversation_participants theirs
                  ON theirs.conversation_id = cm.conversation_id AND theirs.user_id != {ph}
                JOIN users u ON u.id = cm.sender_id
                WHERE cm.sender_id = theirs.user_id
                  AND COALESCE(cm.status, 'sent') != 'read'
            """, (v_id, v_id))
            result = {}
            for r in cur.fetchall():
                email = r[0] if DB_ENGINE == 'postgresql' else r['email']
                msg_id = r[1] if DB_ENGINE == 'postgresql' else r['id']
                if msg_id in hidden:
                    continue
                result[email] = result.get(email, 0) + 1
            return result
        finally:
            conn.close()


def db_get_all_users(exclude_email: str = None):
    import time
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            ex = (exclude_email or '').lower()
            now_ts = time.time()
            if DB_ENGINE == 'postgresql':
                if ex:
                    cur.execute("SELECT id, name, email, created_at, EXTRACT(EPOCH FROM last_seen) FROM users WHERE LOWER(email) != %s ORDER BY name ASC", (ex,))
                else:
                    cur.execute("SELECT id, name, email, created_at, EXTRACT(EPOCH FROM last_seen) FROM users ORDER BY name ASC")
                rows = cur.fetchall()
                result = []
                for r in rows:
                    ls = r[4]
                    is_online = bool(ls and (now_ts - float(ls)) < 35)
                    result.append({'id': r[0], 'name': r[1], 'email': r[2], 'created_at': str(r[3]), 'online': is_online})
                return result
            else:
                if ex:
                    cur.execute("SELECT id, name, email, created_at, last_seen FROM users WHERE LOWER(email) != ? ORDER BY name ASC", (ex,))
                else:
                    cur.execute("SELECT id, name, email, created_at, last_seen FROM users ORDER BY name ASC")
                rows = cur.fetchall()
                result = []
                for r in rows:
                    ls = r['last_seen']
                    is_online = bool(ls and (now_ts - float(ls)) < 35)
                    result.append({'id': r['id'], 'name': r['name'], 'email': r['email'], 'created_at': str(r['created_at']), 'online': is_online})
                return result
        finally:
            conn.close()


def _resolve_user_id(cur, email: str):
    ph = '%s' if DB_ENGINE == 'postgresql' else '?'
    cur.execute(f"SELECT id FROM users WHERE LOWER(email) = {ph}", (email.lower(),))
    row = cur.fetchone()
    if not row:
        return None
    return row[0]


def db_save_message(sender_email: str, receiver_email: str, text: str):
    """Store a TEXT chat message. [CALL_LOG] payloads are routed to the
    dedicated call_logs table instead (see db_save_call_log)."""
    if isinstance(text, str) and '[CALL_LOG]' in text:
        # Backward-compatible path: parse the legacy text format.
        # Format: [CALL_LOG] <type> | Start: X | End: Y | Duration: Z / Missed
        try:
            clean = text.replace('[CALL_LOG]', '').strip()
            parts = [p.strip() for p in clean.split('|')]
            call_type = 'video' if 'video' in parts[0].lower() else 'voice'
            status = 'missed' if 'missed' in clean.lower() or 'declined' in clean.lower() else 'ended'
            import re as _re
            dur_match = _re.search(r'(\d+)m\s+(\d+)s', parts[-1])
            duration = int(dur_match.group(1)) * 60 + int(dur_match.group(2)) if dur_match else 0
            return db_save_call_log(sender_email, receiver_email, call_type, status, duration_seconds=duration)
        except Exception:
            pass  # fall through and store as text

    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            s_id = _resolve_user_id(cur, sender_email)
            r_id = _resolve_user_id(cur, receiver_email)
            if not s_id or not r_id:
                return None
            convo_id = _get_or_create_conversation(cur, s_id, r_id)
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            if DB_ENGINE == 'postgresql':
                cur.execute("""
                    INSERT INTO chat_messages (conversation_id, sender_id, text, status)
                    VALUES (%s, %s, %s, 'sent') RETURNING id
                """, (convo_id, s_id, text))
                msg_id = cur.fetchone()[0]
            else:
                cur.execute("""
                    INSERT INTO chat_messages (conversation_id, sender_id, text, status)
                    VALUES (?, ?, ?, 'sent')
                """, (convo_id, s_id, text))
                msg_id = cur.lastrowid
            conn.commit()
            return {'id': f'm_{msg_id}', 'sender_email': sender_email, 'receiver_email': receiver_email,
                    'text': text, 'status': 'sent', 'created_at': 'Just now'}
        finally:
            conn.close()


def db_save_media(sender_email: str, receiver_email: str, file_name: str,
                  file_type: str, mime_type: str, data_url: str):
    """Store a photo / file / video sent between users. Videos expire after
    MEDIA_VIDEO_RETENTION_DAYS — the purge keeps only the name + log row."""
    import time as _time
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            s_id = _resolve_user_id(cur, sender_email)
            r_id = _resolve_user_id(cur, receiver_email)
            if not s_id or not r_id:
                return None
            convo_id = _get_or_create_conversation(cur, s_id, r_id)
            expires_at = (_time.time() + MEDIA_VIDEO_RETENTION_DAYS * 86400) if file_type == 'video' else None
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            if DB_ENGINE == 'postgresql':
                cur.execute("""
                    INSERT INTO media_files (conversation_id, sender_id, receiver_id,
                        file_name, file_type, mime_type, file_data, file_size, expires_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
                """, (convo_id, s_id, r_id, file_name, file_type, mime_type, data_url,
                      len(data_url), expires_at))
                media_id = cur.fetchone()[0]
            else:
                cur.execute("""
                    INSERT INTO media_files (conversation_id, sender_id, receiver_id,
                        file_name, file_type, mime_type, file_data, file_size, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (convo_id, s_id, r_id, file_name, file_type, mime_type, data_url,
                      len(data_url), expires_at))
                media_id = cur.lastrowid
            conn.commit()
            return {'id': f'md_{media_id}', 'media_id': media_id, 'file_name': file_name,
                    'file_type': file_type, 'file_size': len(data_url)}
        finally:
            conn.close()


def db_get_media(media_id: int):
    """Full media row (including payload) for serving. Expired videos carry
    file_data = NULL and media_expired = True — only name + log remain."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"""
                SELECT id, conversation_id, sender_id, receiver_id, file_name,
                       file_type, mime_type, file_data, file_size, expires_at, media_expired, created_at
                FROM media_files WHERE id = {ph}
            """, (media_id,))
            row = cur.fetchone()
            if not row:
                return None
            if DB_ENGINE == 'postgresql':
                return {'id': row[0], 'conversation_id': row[1], 'sender_id': row[2],
                        'receiver_id': row[3], 'file_name': row[4], 'file_type': row[5],
                        'mime_type': row[6], 'file_data': row[7], 'file_size': row[8],
                        'expires_at': row[9], 'media_expired': bool(row[10]), 'created_at': str(row[11])}
            return {'id': row['id'], 'conversation_id': row['conversation_id'], 'sender_id': row['sender_id'],
                    'receiver_id': row['receiver_id'], 'file_name': row['file_name'], 'file_type': row['file_type'],
                    'mime_type': row['mime_type'], 'file_data': row['file_data'], 'file_size': row['file_size'],
                    'expires_at': row['expires_at'], 'media_expired': bool(row['media_expired']),
                    'created_at': str(row['created_at'])}
        finally:
            conn.close()


def db_purge_expired_media():
    """Retention job: delete VIDEO payloads past their expiry (default 90 days).
    The row itself stays — only the name and the log remain, as required."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            import time as _time
            now = _time.time()
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            flag = 'TRUE' if DB_ENGINE == 'postgresql' else '1'
            cur.execute(f"""
                UPDATE media_files
                SET file_data = NULL, media_expired = {flag}
                WHERE file_type = 'video' AND expires_at IS NOT NULL
                  AND expires_at < {ph} AND file_data IS NOT NULL
            """, (now,))
            purged = cur.rowcount
            conn.commit()
            return purged
        finally:
            conn.close()


def db_save_call_log(caller_email: str, callee_email: str, call_type: str,
                     status: str = 'ended', started_at=None, ended_at=None,
                     duration_seconds: int = 0):
    """Store a voice/video call record in its dedicated table."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            c_id = _resolve_user_id(cur, caller_email)
            e_id = _resolve_user_id(cur, callee_email)
            if not c_id or not e_id:
                return None
            convo_id = _get_or_create_conversation(cur, c_id, e_id)
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            if DB_ENGINE == 'postgresql':
                cur.execute("""
                    INSERT INTO call_logs (conversation_id, caller_id, callee_id,
                        call_type, status, duration_seconds)
                    VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
                """, (convo_id, c_id, e_id, call_type, status, duration_seconds))
                log_id = cur.fetchone()[0]
            else:
                cur.execute("""
                    INSERT INTO call_logs (conversation_id, caller_id, callee_id,
                        call_type, status, duration_seconds)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (convo_id, c_id, e_id, call_type, status, duration_seconds))
                log_id = cur.lastrowid
            conn.commit()
            return {'id': f'c_{log_id}', 'call_type': call_type, 'status': status}
        finally:
            conn.close()


def db_get_messages(user1_email: str, user2_email: str):
    """Merged conversation timeline for a user pair: text messages + media
    files + call logs, chronologically interleaved. Call logs are returned in
    the legacy [CALL_LOG] text format so the existing renderer keeps working."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u1 = user1_email.lower()
            c_id = _resolve_user_id(cur, user2_email)
            if not c_id:
                return []
            convo_id = _get_or_create_conversation(cur, _resolve_user_id(cur, user1_email), c_id)
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            items = []

            cur.execute(f"""
                SELECT id, sender_id, text, COALESCE(status, 'sent'), created_at
                FROM chat_messages WHERE conversation_id = {ph} ORDER BY created_at ASC, id ASC
            """, (convo_id,))
            for r in cur.fetchall():
                sid = r[1] if DB_ENGINE == 'postgresql' else r[1]
                text = r[2] if DB_ENGINE == 'postgresql' else r[2]
                status = r[3] if DB_ENGINE == 'postgresql' else r[3]
                created = r[4] if DB_ENGINE == 'postgresql' else r[4]
                numeric_id = r[0] if DB_ENGINE == 'postgresql' else r[0]
                items.append({'_ts': str(created), 'id': f'm_{numeric_id}',
                              'kind': 'text', 'sender': 'me' if sid == _resolve_user_id(cur, user1_email) else 'them',
                              'text': text, 'status': status,
                              'time': str(created)[11:16] if created else 'Just now'})

            cur.execute(f"""
                SELECT id, sender_id, file_name, file_type, file_size, media_expired, created_at
                FROM media_files WHERE conversation_id = {ph} ORDER BY created_at ASC, id ASC
            """, (convo_id,))
            for r in cur.fetchall():
                if DB_ENGINE == 'postgresql':
                    mid, sid, fname, ftype, fsize, expired, created = r[0], r[1], r[2], r[3], r[4], r[5], r[6]
                else:
                    mid, sid, fname, ftype, fsize, expired, created = (r['id'], r['sender_id'], r['file_name'],
                                                                       r['file_type'], r['file_size'], r['media_expired'], r['created_at'])
                items.append({'_ts': str(created), 'id': f'md_{mid}', 'kind': 'media',
                              'sender': 'me' if sid == _resolve_user_id(cur, user1_email) else 'them',
                              'media_id': mid, 'file_name': fname, 'file_type': ftype,
                              'file_size': fsize, 'media_expired': bool(expired),
                              'time': str(created)[11:16] if created else 'Just now'})

            cur.execute(f"""
                SELECT id, caller_id, call_type, status, duration_seconds, created_at
                FROM call_logs WHERE conversation_id = {ph} ORDER BY created_at ASC, id ASC
            """, (convo_id,))
            for r in cur.fetchall():
                if DB_ENGINE == 'postgresql':
                    lid, caller, ctype, cstatus, dur, created = r[0], r[1], r[2], r[3], r[4], r[5]
                else:
                    lid, caller, ctype, cstatus, dur, created = (r['id'], r['caller_id'], r['call_type'],
                                                                 r['status'], r['duration_seconds'], r['created_at'])
                title = '🎥 Video Meeting' if ctype == 'video' else '📞 Voice Call'
                dur_str = f'Duration: {dur // 60}m {dur % 60:02d}s' if dur else 'Duration: Missed / Declined'
                if cstatus in ('missed', 'declined'):
                    dur_str = 'Duration: Missed / Declined'
                items.append({'_ts': str(created), 'id': f'c_{lid}', 'kind': 'call',
                              'sender': 'me' if caller == _resolve_user_id(cur, user1_email) else 'them',
                              'text': f'[CALL_LOG] {title} | Start: — | End: — | {dur_str}',
                              'status': 'read', 'time': str(created)[11:16] if created else 'Just now'})

            # "Clear for me": drop items the viewer has hidden
            viewer_id = _resolve_user_id(cur, user1_email)
            hidden_msgs = _hidden_ids_for(cur, viewer_id, 'message')
            hidden_media = _hidden_ids_for(cur, viewer_id, 'media')
            hidden_calls = _hidden_ids_for(cur, viewer_id, 'call')
            items = [it for it in items if not (
                (it['kind'] == 'text' and int(it['id'][2:]) in hidden_msgs) or
                (it['kind'] == 'media' and it['media_id'] in hidden_media) or
                (it['kind'] == 'call' and int(it['id'][2:]) in hidden_calls)
            )]

            items.sort(key=lambda x: (x['_ts'], x['id']))
            for it in items:
                it.pop('_ts', None)
            return items
        finally:
            conn.close()


def db_mark_messages_read(reader_email: str, sender_email: str):
    """Mark all text messages from sender to reader (in their shared
    conversation) as 'read'."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            r_id = _resolve_user_id(cur, reader_email)
            s_id = _resolve_user_id(cur, sender_email)
            if not r_id or not s_id:
                return
            convo_id = _get_or_create_conversation(cur, r_id, s_id)
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            flag = 'TRUE' if DB_ENGINE == 'postgresql' else '1'
            cur.execute(f"""
                UPDATE chat_messages SET status = 'read', is_read = {flag}
                WHERE conversation_id = {ph} AND sender_id = {ph}
                  AND COALESCE(status, 'sent') != 'read'
            """, (convo_id, s_id))
            conn.commit()
        finally:
            conn.close()


def db_update_message_status(msg_id, status: str):
    """Update a single text message's status ('received' / 'read').
    IDs arrive prefixed ('m_<id>'); other kinds (media/call) are ignored."""
    if not isinstance(msg_id, str) or not msg_id.startswith('m_'):
        return
    try:
        numeric_id = int(msg_id[2:])
    except ValueError:
        return
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"UPDATE chat_messages SET status = {ph} WHERE id = {ph}", (status, numeric_id))
            conn.commit()
        finally:
            conn.close()


# ==========================================================================
# Saved Contacts (address book — many-to-many users <-> users)
# ==========================================================================

def db_save_contact(user_email: str, contact_email: str):
    """Save a contact for the user. Returns (ok, error)."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            c_id = _resolve_user_id(cur, contact_email)
            if not u_id or not c_id:
                return False, 'Contact account not found.'
            if u_id == c_id:
                return False, 'You cannot save yourself as a contact.'
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            if DB_ENGINE == 'postgresql':
                cur.execute("""
                    INSERT INTO saved_contacts (user_id, contact_id)
                    VALUES (%s, %s) ON CONFLICT DO NOTHING
                """, (u_id, c_id))
            else:
                cur.execute("""
                    INSERT OR IGNORE INTO saved_contacts (user_id, contact_id)
                    VALUES (?, ?)
                """, (u_id, c_id))
            conn.commit()
            return True, None
        finally:
            conn.close()


def db_unsave_contact(user_email: str, contact_email: str):
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            c_id = _resolve_user_id(cur, contact_email)
            if not u_id or not c_id:
                return False
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"DELETE FROM saved_contacts WHERE user_id = {ph} AND contact_id = {ph}", (u_id, c_id))
            conn.commit()
            return True
        finally:
            conn.close()


def db_get_saved_contacts(user_email: str):
    """All saved contacts with their public profile info + online status."""
    import time as _time
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            if not u_id:
                return []
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            now_ts = _time.time()
            cur.execute(f"""
                SELECT u.id, u.name, u.email, u.username, u.avatar, u.last_seen
                FROM saved_contacts sc
                JOIN users u ON u.id = sc.contact_id
                WHERE sc.user_id = {ph}
                ORDER BY u.name ASC
            """, (u_id,))
            result = []
            for r in cur.fetchall():
                if DB_ENGINE == 'postgresql':
                    uid, name, email, username, avatar, last_seen = r
                else:
                    uid, name, email, username, avatar, last_seen = (r['id'], r['name'], r['email'],
                                                                     r['username'], r['avatar'], r['last_seen'])
                result.append({
                    'id': uid, 'name': name, 'email': email,
                    'username': username, 'avatar': avatar,
                    'online': bool(last_seen and (now_ts - float(last_seen)) < 35),
                })
            return result
        finally:
            conn.close()


def db_is_contact_saved(user_email: str, contact_email: str) -> bool:
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            c_id = _resolve_user_id(cur, contact_email)
            if not u_id or not c_id:
                return False
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"SELECT 1 FROM saved_contacts WHERE user_id = {ph} AND contact_id = {ph} LIMIT 1", (u_id, c_id))
            return cur.fetchone() is not None
        finally:
            conn.close()


def db_search_users(query: str, exclude_email: str, limit: int = 10, exact: bool = False):
    """Search users for the contact panel.
    exact=False -> LIKE match on username / name / email (conversation search).
    exact=True  -> EXACT username match only (the Contacts tab requirement)."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            ex = (exclude_email or '').lower()
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            now_ts = _resolve_time()
            if exact:
                username_exact = (query or '').strip().lstrip('@').lower()
                if not username_exact:
                    return []
                cur.execute(f"""
                    SELECT id, name, email, username, avatar, last_seen
                    FROM users
                    WHERE LOWER(email) != {ph}
                      AND LOWER(username) = LOWER({ph})
                    ORDER BY name ASC
                    LIMIT {int(limit)}
                """, (ex, username_exact))
            else:
                q = f"%{(query or '').strip().lstrip('@').lower()}%"
                cur.execute(f"""
                    SELECT id, name, email, username, avatar, last_seen
                    FROM users
                    WHERE LOWER(email) != {ph}
                      AND (LOWER(username) LIKE {ph} OR LOWER(name) LIKE {ph} OR LOWER(email) LIKE {ph})
                    ORDER BY name ASC
                    LIMIT {int(limit)}
                """, (ex, q, q, q))
            result = []
            for r in cur.fetchall():
                if DB_ENGINE == 'postgresql':
                    uid, name, email, username, avatar, last_seen = r
                else:
                    uid, name, email, username, avatar, last_seen = (r['id'], r['name'], r['email'],
                                                                     r['username'], r['avatar'], r['last_seen'])
                result.append({
                    'id': uid, 'name': name, 'email': email,
                    'username': username, 'avatar': avatar,
                    'online': bool(last_seen and (now_ts - float(last_seen)) < 35),
                })
            return result
        finally:
            conn.close()


def _resolve_time():
    import time as _time
    return _time.time()


def db_get_public_profile(username: str):
    """Public profile by username for the QR redirect (no email/password)."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"""
                SELECT id, name, username, avatar FROM users
                WHERE LOWER(username) = LOWER({ph})
            """, ((username or '').lstrip('@').lower(),))
            r = cur.fetchone()
            if not r:
                return None
            if DB_ENGINE == 'postgresql':
                return {'id': r[0], 'name': r[1], 'username': r[2], 'avatar': r[3]}
            return {'id': r['id'], 'name': r['name'], 'username': r['username'], 'avatar': r['avatar']}
        finally:
            conn.close()


def db_get_shared_files(user1_email: str, user2_email: str):
    """Media files exchanged between two users (for the profile drawer).
    Expired videos appear with name only."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u1 = _resolve_user_id(cur, user1_email)
            u2 = _resolve_user_id(cur, user2_email)
            if not u1 or not u2:
                return []
            convo_id = _get_or_create_conversation(cur, u1, u2)
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"""
                SELECT id, file_name, file_type, file_size, media_expired, created_at
                FROM media_files WHERE conversation_id = {ph}
                ORDER BY created_at DESC, id DESC
            """, (convo_id,))
            result = []
            for r in cur.fetchall():
                if DB_ENGINE == 'postgresql':
                    mid, fname, ftype, fsize, expired, created = r
                else:
                    mid, fname, ftype, fsize, expired, created = (r['id'], r['file_name'], r['file_type'],
                                                                  r['file_size'], r['media_expired'], r['created_at'])
                result.append({'media_id': mid, 'file_name': fname, 'file_type': ftype,
                               'file_size': fsize, 'media_expired': bool(expired), 'created_at': str(created)})
            return result
        finally:
            conn.close()


# ==========================================================================
# Contact Options — pin / archive / mute / mark-read / clear history
# ==========================================================================

def db_get_contact_prefs(user_email: str):
    """All option flags for the user's contacts.
    Returns {contact_id: {archived, pinned, pinned_at, muted_until}}."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            if not u_id:
                return {}
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"""
                SELECT cp.contact_id, u.email, cp.archived, cp.pinned, cp.pinned_at, cp.muted_until
                FROM contact_preferences cp
                JOIN users u ON u.id = cp.contact_id
                WHERE cp.user_id = {ph}
            """, (u_id,))
            result = {}
            for r in cur.fetchall():
                if DB_ENGINE == 'postgresql':
                    cid, email, archived, pinned, pinned_at, muted_until = r
                else:
                    cid, email, archived, pinned, pinned_at, muted_until = (r['contact_id'], r['email'],
                                                                            r['archived'], r['pinned'], r['pinned_at'], r['muted_until'])
                result[email] = {
                    'archived': bool(archived),
                    'pinned': bool(pinned),
                    'pinned_at': float(pinned_at) if pinned_at is not None else None,
                    'muted_until': float(muted_until) if muted_until is not None else None,
                }
            return result
        finally:
            conn.close()


def db_set_contact_pref(user_email: str, contact_email: str, field: str, value):
    """Set one option flag ('archived' | 'pinned' | 'pinned_at' | 'muted_until')."""
    allowed = ('archived', 'pinned', 'pinned_at', 'muted_until')
    if field not in allowed:
        return False
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            c_id = _resolve_user_id(cur, contact_email)
            if not u_id or not c_id:
                return False
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            if DB_ENGINE == 'postgresql':
                cur.execute(f"""
                    INSERT INTO contact_preferences (user_id, contact_id, {field})
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id, contact_id) DO UPDATE SET {field} = EXCLUDED.{field}
                """, (u_id, c_id, value))
            else:
                # ensure row exists, then update the single flag
                cur.execute("""
                    INSERT OR IGNORE INTO contact_preferences (user_id, contact_id)
                    VALUES (?, ?)
                """, (u_id, c_id))
                cur.execute(f"""
                    UPDATE contact_preferences SET {field} = {ph}
                    WHERE user_id = {ph} AND contact_id = {ph}
                """, (value, u_id, c_id))
            conn.commit()
            return True
        finally:
            conn.close()


def db_count_pinned(user_email: str) -> int:
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            if not u_id:
                return 0
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            flag = 'TRUE' if DB_ENGINE == 'postgresql' else '1'
            cur.execute(f"SELECT COUNT(*) FROM contact_preferences WHERE user_id = {ph} AND pinned = {flag}", (u_id,))
            r = cur.fetchone()
            return r[0] if DB_ENGINE == 'postgresql' else r[0]
        finally:
            conn.close()


def _hidden_ids_for(cur, user_id: str, kind: str):
    ph = '%s' if DB_ENGINE == 'postgresql' else '?'
    cur.execute(f"SELECT item_id FROM hidden_content WHERE user_id = {ph} AND kind = {ph}", (user_id, kind))
    return {r[0] for r in cur.fetchall()}


def db_hide_content_for(user_email: str, items):
    """Hide content for ONE user only ('clear for me').
    items = [{'kind': 'message'|'media'|'call', 'id': <numeric id>}, ...]"""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            if not u_id:
                return False
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            for item in items:
                cur.execute(f"""
                    INSERT OR IGNORE INTO hidden_content (user_id, kind, item_id)
                    VALUES ({ph}, {ph}, {ph})
                """, (u_id, item['kind'], item['id']))
            conn.commit()
            return True
        finally:
            conn.close()


def db_clear_history(user_email: str, contact_email: str, for_both: bool):
    """Clear the conversation history.
    for_both=True  -> hard-delete messages/media/call logs (gone for both).
    for_both=False -> hide everything for the caller only (contact keeps it)."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u1 = _resolve_user_id(cur, user_email)
            u2 = _resolve_user_id(cur, contact_email)
            if not u1 or not u2:
                return False
            convo_id = _get_or_create_conversation(cur, u1, u2)
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'

            if for_both:
                cur.execute(f"DELETE FROM chat_messages WHERE conversation_id = {ph}", (convo_id,))
                cur.execute(f"DELETE FROM media_files WHERE conversation_id = {ph}", (convo_id,))
                cur.execute(f"DELETE FROM call_logs WHERE conversation_id = {ph}", (convo_id,))
                cur.execute(f"""
                    DELETE FROM hidden_content
                    WHERE user_id IN ({ph}, {ph})
                      AND item_id NOT IN (SELECT id FROM chat_messages)
                      AND kind = 'message'
                """, (u1, u2))
            else:
                # collect this pair's content ids, then hide each for the caller
                cur.execute(f"SELECT id FROM chat_messages WHERE conversation_id = {ph}", (convo_id,))
                msg_ids = [r[0] for r in cur.fetchall()]
                cur.execute(f"SELECT id FROM media_files WHERE conversation_id = {ph}", (convo_id,))
                media_ids = [r[0] for r in cur.fetchall()]
                cur.execute(f"SELECT id FROM call_logs WHERE conversation_id = {ph}", (convo_id,))
                call_ids = [r[0] for r in cur.fetchall()]
                for i in msg_ids:
                    cur.execute(f"""
                        INSERT OR IGNORE INTO hidden_content (user_id, kind, item_id) VALUES ({ph}, 'message', {ph})
                    """, (u1, i))
                for i in media_ids:
                    cur.execute(f"""
                        INSERT OR IGNORE INTO hidden_content (user_id, kind, item_id) VALUES ({ph}, 'media', {ph})
                    """, (u1, i))
                for i in call_ids:
                    cur.execute(f"""
                        INSERT OR IGNORE INTO hidden_content (user_id, kind, item_id) VALUES ({ph}, 'call', {ph})
                    """, (u1, i))
            conn.commit()
            return True
        finally:
            conn.close()


# ==========================================================================
# Contact Module — Search, Saved Contacts, Favourites & Custom Pages
# ==========================================================================

def db_search_users_for_contact(query: str, exclude_email: str, limit: int = 25):
    """Search users for Contact module.
    - If query starts with '@' (e.g. '@minthit'): EXACT match on username only.
    - If query is a name (e.g. 'min t'): substring LIKE match on name (returns 'min thit', 'min thi ri', etc.).
    Returns user info with is_saved and is_favourite flags.
    """
    import time as _time
    q_str = (query or '').strip()
    if not q_str:
        return []
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            ex = (exclude_email or '').lower()
            u_id = _resolve_user_id(cur, ex)
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            now_ts = _time.time()

            if q_str.startswith('@'):
                target_username = q_str[1:].strip().lower()
                if not target_username:
                    return []
                cur.execute(f"""
                    SELECT id, name, email, username, avatar, last_seen
                    FROM users
                    WHERE LOWER(email) != {ph}
                      AND LOWER(username) = LOWER({ph})
                    ORDER BY name ASC
                    LIMIT {int(limit)}
                """, (ex, target_username))
            else:
                name_pattern = f"%{q_str.lower()}%"
                cur.execute(f"""
                    SELECT id, name, email, username, avatar, last_seen
                    FROM users
                    WHERE LOWER(email) != {ph}
                      AND (LOWER(name) LIKE {ph} OR LOWER(username) = LOWER({ph}))
                    ORDER BY name ASC
                    LIMIT {int(limit)}
                """, (ex, name_pattern, q_str.lower()))

            raw_users = cur.fetchall()
            if not raw_users:
                return []

            saved_set = set()
            fav_set = set()
            if u_id:
                cur.execute(f"SELECT contact_id FROM saved_contacts WHERE user_id = {ph}", (u_id,))
                saved_set = {r[0] if DB_ENGINE == 'postgresql' else r['contact_id'] for r in cur.fetchall()}
                cur.execute(f"SELECT contact_id FROM contact_favourites WHERE user_id = {ph}", (u_id,))
                fav_set = {r[0] if DB_ENGINE == 'postgresql' else r['contact_id'] for r in cur.fetchall()}

            result = []
            for r in raw_users:
                if DB_ENGINE == 'postgresql':
                    uid, name, email, username, avatar, last_seen = r
                else:
                    uid, name, email, username, avatar, last_seen = (
                        r['id'], r['name'], r['email'], r['username'], r['avatar'], r['last_seen']
                    )
                clean_uname = username or (email.split('@')[0] if email else 'user')
                is_online = bool(last_seen and (now_ts - float(last_seen)) < 35)
                result.append({
                    'id': uid,
                    'name': name or clean_uname,
                    'email': email,
                    'username': clean_uname,
                    'avatar': avatar or '',
                    'online': is_online,
                    'is_saved': uid in saved_set,
                    'is_favourite': uid in fav_set,
                })
            return result
        finally:
            conn.close()


def db_get_saved_contacts_enhanced(user_email: str):
    """Retrieve all saved contacts for the user with full profile and favourite flags."""
    import time as _time
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            if not u_id:
                return []
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            now_ts = _time.time()

            cur.execute(f"""
                SELECT u.id, u.name, u.email, u.username, u.avatar, u.last_seen,
                       CASE WHEN cf.contact_id IS NOT NULL THEN 1 ELSE 0 END AS is_fav
                FROM saved_contacts sc
                JOIN users u ON u.id = sc.contact_id
                LEFT JOIN contact_favourites cf ON cf.user_id = sc.user_id AND cf.contact_id = sc.contact_id
                WHERE sc.user_id = {ph}
                ORDER BY u.name ASC
            """, (u_id,))

            result = []
            for r in cur.fetchall():
                if DB_ENGINE == 'postgresql':
                    uid, name, email, username, avatar, last_seen, is_fav = r
                else:
                    uid, name, email, username, avatar, last_seen, is_fav = (
                        r['id'], r['name'], r['email'], r['username'], r['avatar'], r['last_seen'], r['is_fav']
                    )
                clean_uname = username or (email.split('@')[0] if email else 'user')
                is_online = bool(last_seen and (now_ts - float(last_seen)) < 35)
                result.append({
                    'id': uid,
                    'name': name or clean_uname,
                    'email': email,
                    'username': clean_uname,
                    'avatar': avatar or '',
                    'online': is_online,
                    'is_saved': True,
                    'is_favourite': bool(is_fav),
                })
            return result
        finally:
            conn.close()


def db_save_contact_enhanced(user_email: str, contact_identifier: str):
    """Save contact by ID or email."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            if not u_id:
                return False, 'User not found'
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"SELECT id FROM users WHERE id = {ph} OR LOWER(email) = {ph}", (contact_identifier, contact_identifier.lower()))
            row = cur.fetchone()
            if not row:
                return False, 'Contact not found'
            c_id = row[0] if DB_ENGINE == 'postgresql' else row['id']
            if u_id == c_id:
                return False, 'You cannot save yourself as a contact'

            if DB_ENGINE == 'postgresql':
                cur.execute("""
                    INSERT INTO saved_contacts (user_id, contact_id)
                    VALUES (%s, %s) ON CONFLICT DO NOTHING
                """, (u_id, c_id))
            else:
                cur.execute("""
                    INSERT OR IGNORE INTO saved_contacts (user_id, contact_id)
                    VALUES (?, ?)
                """, (u_id, c_id))
            conn.commit()
            return True, None
        finally:
            conn.close()


def db_unsave_contact_enhanced(user_email: str, contact_identifier: str):
    """Unsave contact by ID or email. Also removes from favourites."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            if not u_id:
                return False
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"SELECT id FROM users WHERE id = {ph} OR LOWER(email) = {ph}", (contact_identifier, contact_identifier.lower()))
            row = cur.fetchone()
            if not row:
                return False
            c_id = row[0] if DB_ENGINE == 'postgresql' else row['id']

            cur.execute(f"DELETE FROM saved_contacts WHERE user_id = {ph} AND contact_id = {ph}", (u_id, c_id))
            cur.execute(f"DELETE FROM contact_favourites WHERE user_id = {ph} AND contact_id = {ph}", (u_id, c_id))
            conn.commit()
            return True
        finally:
            conn.close()


def db_toggle_favourite_contact(user_email: str, contact_identifier: str, is_fav: bool):
    """Add or remove a contact from favourites."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            if not u_id:
                return False, 'User not found'
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"SELECT id FROM users WHERE id = {ph} OR LOWER(email) = {ph}", (contact_identifier, contact_identifier.lower()))
            row = cur.fetchone()
            if not row:
                return False, 'Contact not found'
            c_id = row[0] if DB_ENGINE == 'postgresql' else row['id']

            if is_fav:
                # Ensure it's saved in contacts as well
                if DB_ENGINE == 'postgresql':
                    cur.execute("""
                        INSERT INTO saved_contacts (user_id, contact_id)
                        VALUES (%s, %s) ON CONFLICT DO NOTHING
                    """, (u_id, c_id))
                    cur.execute("""
                        INSERT INTO contact_favourites (user_id, contact_id)
                        VALUES (%s, %s) ON CONFLICT DO NOTHING
                    """, (u_id, c_id))
                else:
                    cur.execute("""
                        INSERT OR IGNORE INTO saved_contacts (user_id, contact_id)
                        VALUES (?, ?)
                    """, (u_id, c_id))
                    cur.execute("""
                        INSERT OR IGNORE INTO contact_favourites (user_id, contact_id)
                        VALUES (?, ?)
                    """, (u_id, c_id))
            else:
                cur.execute(f"DELETE FROM contact_favourites WHERE user_id = {ph} AND contact_id = {ph}", (u_id, c_id))

            conn.commit()
            return True, None
        finally:
            conn.close()


def db_get_favourite_contacts(user_email: str):
    """Retrieve only favourite contacts for user."""
    import time as _time
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            if not u_id:
                return []
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            now_ts = _time.time()

            cur.execute(f"""
                SELECT u.id, u.name, u.email, u.username, u.avatar, u.last_seen
                FROM contact_favourites cf
                JOIN users u ON u.id = cf.contact_id
                WHERE cf.user_id = {ph}
                ORDER BY u.name ASC
            """, (u_id,))

            result = []
            for r in cur.fetchall():
                if DB_ENGINE == 'postgresql':
                    uid, name, email, username, avatar, last_seen = r
                else:
                    uid, name, email, username, avatar, last_seen = (
                        r['id'], r['name'], r['email'], r['username'], r['avatar'], r['last_seen']
                    )
                clean_uname = username or (email.split('@')[0] if email else 'user')
                is_online = bool(last_seen and (now_ts - float(last_seen)) < 35)
                result.append({
                    'id': uid,
                    'name': name or clean_uname,
                    'email': email,
                    'username': clean_uname,
                    'avatar': avatar or '',
                    'online': is_online,
                    'is_saved': True,
                    'is_favourite': True,
                })
            return result
        finally:
            conn.close()


def db_get_user_contact_pages(user_email: str):
    """Retrieve all custom pages created by user (max 3 extra pages)."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            if not u_id:
                return []
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"""
                SELECT id, page_id, page_name, page_icon, created_at
                FROM contact_pages
                WHERE user_id = {ph}
                ORDER BY id ASC
            """, (u_id,))

            result = []
            for r in cur.fetchall():
                if DB_ENGINE == 'postgresql':
                    pid, page_id, page_name, page_icon, created_at = r
                else:
                    pid, page_id, page_name, page_icon, created_at = (
                        r['id'], r['page_id'], r['page_name'], r['page_icon'], r['created_at']
                    )
                result.append({
                    'id': pid,
                    'page_id': page_id,
                    'page_name': page_name,
                    'page_icon': page_icon or 'folder',
                    'created_at': str(created_at)
                })
            return result
        finally:
            conn.close()


def db_create_contact_page(user_email: str, name: str, icon: str = 'folder'):
    """Create a new custom contact page. Enforces max 3 extra pages (6 total)."""
    import uuid
    clean_name = (name or '').strip()
    if not clean_name:
        return False, 'Page name cannot be empty'

    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            if not u_id:
                return False, 'User not found'
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'

            # Count existing custom pages
            cur.execute(f"SELECT COUNT(*) FROM contact_pages WHERE user_id = {ph}", (u_id,))
            cnt = cur.fetchone()[0]
            if cnt >= 3:
                return False, 'Maximum page limit reached (max 3 extra pages, 6 total).'

            page_id = f"custom_{uuid.uuid4().hex[:8]}"
            clean_icon = icon or 'folder'

            if DB_ENGINE == 'postgresql':
                cur.execute("""
                    INSERT INTO contact_pages (user_id, page_id, page_name, page_icon)
                    VALUES (%s, %s, %s, %s) RETURNING id
                """, (u_id, page_id, clean_name, clean_icon))
                new_id = cur.fetchone()[0]
            else:
                cur.execute("""
                    INSERT INTO contact_pages (user_id, page_id, page_name, page_icon)
                    VALUES (?, ?, ?, ?)
                """, (u_id, page_id, clean_name, clean_icon))
                new_id = cur.lastrowid

            conn.commit()
            return True, {
                'id': new_id,
                'page_id': page_id,
                'page_name': clean_name,
                'page_icon': clean_icon
            }
        finally:
            conn.close()


def db_rename_contact_page(user_email: str, page_id: str, new_name: str):
    """Rename a custom contact page."""
    clean_name = (new_name or '').strip()
    if not clean_name:
        return False, 'Page name cannot be empty'

    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            if not u_id:
                return False, 'User not found'
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'

            cur.execute(f"""
                UPDATE contact_pages
                SET page_name = {ph}
                WHERE user_id = {ph} AND page_id = {ph}
            """, (clean_name, u_id, page_id))
            conn.commit()
            if cur.rowcount > 0:
                return True, None
            return False, 'Page not found'
        finally:
            conn.close()


def db_delete_contact_page(user_email: str, page_id: str):
    """Delete a custom contact page."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_user_id(cur, user_email)
            if not u_id:
                return False, 'User not found'
            ph = '%s' if DB_ENGINE == 'postgresql' else '?'

            cur.execute(f"""
                DELETE FROM contact_pages
                WHERE user_id = {ph} AND page_id = {ph}
            """, (u_id, page_id))
            conn.commit()
            if cur.rowcount > 0:
                return True, None
            return False, 'Page not found'
        finally:
            conn.close()


# ==========================================================================
# Calendar Module — CRUD Operations
# ==========================================================================

def _resolve_calendar_user_id(cur, user_ident: str):
    """Resolve user ID from either user ID string or email address."""
    if not user_ident:
        return None
    ident = str(user_ident).strip()
    ph = '%s' if DB_ENGINE == 'postgresql' else '?'
    # 1. Check if direct user ID
    cur.execute(f"SELECT id FROM users WHERE id = {ph}", (ident,))
    row = cur.fetchone()
    if row:
        return row[0] if DB_ENGINE == 'postgresql' else row['id']
    # 2. Check if email
    cur.execute(f"SELECT id FROM users WHERE LOWER(email) = {ph}", (ident.lower(),))
    row = cur.fetchone()
    if row:
        return row[0] if DB_ENGINE == 'postgresql' else row['id']
    return None


def _format_calendar_row(row):
    """Format row result into a clean dictionary."""
    if not row:
        return None
    if isinstance(row, dict):
        return dict(row)
    if hasattr(row, 'keys'):
        return {k: row[k] for k in row.keys()}
    cols = [
        'id', 'user_id', 'title', 'description', 'start_dt', 'end_dt',
        'all_day', 'color', 'category', 'location', 'recurrence',
        'reminder_min', 'attendees', 'created_at', 'updated_at'
    ]
    return {cols[i]: row[i] for i in range(min(len(cols), len(row)))}


def db_create_calendar_event(user_ident: str, event_data: dict):
    """Create a new calendar event for user."""
    import secrets as _secrets
    import datetime as _dt
    title = (event_data.get('title') or '').strip()
    if not title:
        return False, 'Event title is required'

    start_dt = (event_data.get('start_dt') or '').strip()
    end_dt = (event_data.get('end_dt') or '').strip()
    if not start_dt or not end_dt:
        return False, 'Start and end dates/times are required'

    all_day = 1 if event_data.get('all_day') in (1, '1', True, 'true') else 0
    color = (event_data.get('color') or '#6C63FF').strip()
    category = (event_data.get('category') or 'general').strip().lower()
    description = (event_data.get('description') or '').strip()
    location = (event_data.get('location') or '').strip()
    recurrence = (event_data.get('recurrence') or '').strip()
    attendees = (event_data.get('attendees') or '').strip()

    raw_reminder = event_data.get('reminder_min')
    try:
        reminder_min = int(raw_reminder) if raw_reminder not in (None, '', 'none') else None
    except (ValueError, TypeError):
        reminder_min = None

    event_id = f"evt_{_secrets.token_hex(8)}"

    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_calendar_user_id(cur, user_ident)
            if not u_id:
                return False, 'User not found'

            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            now_iso = _dt.datetime.utcnow().isoformat()

            cur.execute(f"""
                INSERT INTO calendar_events (
                    id, user_id, title, description, start_dt, end_dt,
                    all_day, color, category, location, recurrence,
                    reminder_min, attendees, created_at, updated_at
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
            """, (
                event_id, u_id, title, description, start_dt, end_dt,
                all_day, color, category, location, recurrence,
                reminder_min, attendees, now_iso, now_iso
            ))
            conn.commit()

            return True, {
                'id': event_id,
                'user_id': u_id,
                'title': title,
                'description': description,
                'start_dt': start_dt,
                'end_dt': end_dt,
                'all_day': all_day,
                'color': color,
                'category': category,
                'location': location,
                'recurrence': recurrence,
                'reminder_min': reminder_min,
                'attendees': attendees,
                'created_at': now_iso,
                'updated_at': now_iso
            }
        except Exception as e:
            return False, str(e)
        finally:
            conn.close()


def db_get_calendar_events(user_ident: str, start_dt: str = None, end_dt: str = None, category: str = None):
    """Retrieve calendar events for user, optionally filtered by range and category."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_calendar_user_id(cur, user_ident)
            if not u_id:
                return []

            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            query = f"""
                SELECT id, user_id, title, description, start_dt, end_dt,
                       all_day, color, category, location, recurrence,
                       reminder_min, attendees, created_at, updated_at
                FROM calendar_events
                WHERE user_id = {ph}
            """
            params = [u_id]

            if start_dt:
                query += f" AND end_dt >= {ph}"
                params.append(start_dt)
            if end_dt:
                query += f" AND start_dt <= {ph}"
                params.append(end_dt)
            if category and category != 'all':
                query += f" AND category = {ph}"
                params.append(category.strip().lower())

            query += " ORDER BY start_dt ASC, created_at ASC"

            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            return [_format_calendar_row(r) for r in rows]
        finally:
            conn.close()


def db_get_calendar_event(user_ident: str, event_id: str):
    """Get single calendar event detail."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_calendar_user_id(cur, user_ident)
            if not u_id:
                return None

            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"""
                SELECT id, user_id, title, description, start_dt, end_dt,
                       all_day, color, category, location, recurrence,
                       reminder_min, attendees, created_at, updated_at
                FROM calendar_events
                WHERE user_id = {ph} AND id = {ph}
            """, (u_id, event_id))
            row = cur.fetchone()
            return _format_calendar_row(row)
        finally:
            conn.close()


def db_update_calendar_event(user_ident: str, event_id: str, update_data: dict):
    """Update an existing calendar event."""
    import datetime as _dt
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_calendar_user_id(cur, user_ident)
            if not u_id:
                return False, 'User not found'

            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"SELECT id FROM calendar_events WHERE user_id = {ph} AND id = {ph}", (u_id, event_id))
            if not cur.fetchone():
                return False, 'Event not found'

            allowed_fields = [
                'title', 'description', 'start_dt', 'end_dt', 'all_day',
                'color', 'category', 'location', 'recurrence', 'reminder_min', 'attendees'
            ]
            set_clauses = []
            params = []

            for f in allowed_fields:
                if f in update_data:
                    val = update_data[f]
                    if f == 'title':
                        val = (val or '').strip()
                        if not val:
                            return False, 'Title cannot be empty'
                    elif f == 'all_day':
                        val = 1 if val in (1, '1', True, 'true') else 0
                    elif f == 'reminder_min':
                        try:
                            val = int(val) if val not in (None, '', 'none') else None
                        except (ValueError, TypeError):
                            val = None
                    elif isinstance(val, str):
                        val = val.strip()

                    set_clauses.append(f"{f} = {ph}")
                    params.append(val)

            if not set_clauses:
                return False, 'No fields to update'

            now_iso = _dt.datetime.utcnow().isoformat()
            set_clauses.append(f"updated_at = {ph}")
            params.append(now_iso)

            params.extend([u_id, event_id])
            cur.execute(f"""
                UPDATE calendar_events
                SET {', '.join(set_clauses)}
                WHERE user_id = {ph} AND id = {ph}
            """, tuple(params))
            conn.commit()

            # Return updated event
            cur.execute(f"""
                SELECT id, user_id, title, description, start_dt, end_dt,
                       all_day, color, category, location, recurrence,
                       reminder_min, attendees, created_at, updated_at
                FROM calendar_events
                WHERE user_id = {ph} AND id = {ph}
            """, (u_id, event_id))
            updated_row = cur.fetchone()
            return True, _format_calendar_row(updated_row)
        except Exception as e:
            return False, str(e)
        finally:
            conn.close()


def db_delete_calendar_event(user_ident: str, event_id: str):
    """Delete a calendar event."""
    with _db_lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            u_id = _resolve_calendar_user_id(cur, user_ident)
            if not u_id:
                return False, 'User not found'

            ph = '%s' if DB_ENGINE == 'postgresql' else '?'
            cur.execute(f"""
                DELETE FROM calendar_events
                WHERE user_id = {ph} AND id = {ph}
            """, (u_id, event_id))
            conn.commit()
            if cur.rowcount > 0:
                return True, None
            return False, 'Event not found'
        except Exception as e:
            return False, str(e)
        finally:
            conn.close()


# Auto-initialize database tables and dual user schemas on module load
try:
    init_db()
except Exception as _e:
    print(f"[Database] init_db note: {_e}")

