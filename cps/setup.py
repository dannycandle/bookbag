import os
import uuid
import tempfile
import shutil
import sqlite3

from flask import Blueprint, redirect, url_for, request, jsonify, g, session
from .cw_login import login_user
from flask_babel import gettext as _
from werkzeug.security import generate_password_hash
from sqlalchemy.sql.expression import func

from . import constants, logger, ub, config, calibre_db, db
from .helper import valid_email, valid_password
from .string_helper import strip_whitespaces
from .render_template import render_title_template

log = logger.create()

setup = Blueprint('setup', __name__)

# Docker: set BOOKBAG_LIBRARY_PATH=/books
# Locally: defaults to <project_root>/books
DEFAULT_LIBRARY_PATH = os.environ.get('BOOKBAG_LIBRARY_PATH', '/books')



def _needs_setup():
    """Check whether setup wizard is needed. Returns (has_admin, has_db)."""
    has_admin = ub.session.query(ub.User).filter(
        ub.User.role.op('&')(constants.ROLE_ADMIN) == constants.ROLE_ADMIN
    ).first() is not None
    has_db = config.db_configured
    return has_admin, has_db


@setup.route("/setup")
def wizard():
    has_admin, has_db = _needs_setup()
    db_auto_configured = False
    # Auto-configure if metadata.db already exists at the default path
    if not has_db and os.path.exists(os.path.join(DEFAULT_LIBRARY_PATH, 'metadata.db')):
        config.config_calibre_dir = DEFAULT_LIBRARY_PATH
        try:
            config.save()
            calibre_db.reconnect_db(config, ub.app_DB_path)
            has_db = True
            db_auto_configured = True
        except Exception as ex:
            log.error("Setup: failed to auto-configure library: %s", ex)
    if has_admin and has_db:
        return redirect(url_for('web.index'))
    return render_title_template('setup.html',
                                 has_admin=has_admin,
                                 has_db=has_db,
                                 db_auto_configured=db_auto_configured,
                                 library_path=DEFAULT_LIBRARY_PATH,
                                 title=_("Setup"),
                                 page="setup")


@setup.route("/setup/account", methods=['POST'])
def create_account():
    has_admin, _ = _needs_setup()
    if has_admin:
        return jsonify(error=_("An admin account already exists.")), 400

    data = request.get_json(silent=True) or {}
    email = strip_whitespaces(data.get('email', ''))
    password = data.get('password', '')

    # Validate email
    try:
        email = valid_email(email)
    except Exception as ex:
        return jsonify(error=str(ex)), 400
    if not email:
        return jsonify(error=_("Please enter a valid email address.")), 400

    # Validate password
    try:
        valid_password(password)
    except Exception as ex:
        return jsonify(error=str(ex)), 400

    # Create admin user
    user = ub.User()
    user.name = email
    user.email = email
    user.role = constants.ADMIN_USER_ROLES
    user.sidebar_view = constants.ADMIN_USER_SIDEBAR
    user.password = generate_password_hash(password)

    ub.session.add(user)
    try:
        ub.session.commit()
    except Exception as ex:
        ub.session.rollback()
        log.error("Setup: failed to create admin user: %s", ex)
        return jsonify(error=_("Failed to create account.")), 500

    login_user(user, remember=True)
    return jsonify(success=True)


@setup.route("/setup/library/validate", methods=['POST'])
def validate_library():
    """Validate an uploaded metadata.db without installing it."""
    has_admin, has_db = _needs_setup()
    if has_db:
        return jsonify(error=_("A library is already configured.")), 400

    uploaded = request.files.get('file')
    if not uploaded or uploaded.filename == '':
        return jsonify(error=_("No file was uploaded.")), 400
    if uploaded.filename != 'metadata.db':
        return jsonify(error=_("Please upload a metadata.db file.")), 400

    # Clean up any previously staged file
    old_tmp = session.pop('setup_staged_db', None)
    if old_tmp and os.path.exists(old_tmp):
        os.unlink(old_tmp)

    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.db')
    os.close(tmp_fd)
    try:
        uploaded.save(tmp_path)
        _validate_metadata_db(tmp_path)
    except ValueError as ex:
        os.unlink(tmp_path)
        return jsonify(error=str(ex)), 400
    except Exception as ex:
        os.unlink(tmp_path)
        log.error("Setup: failed to validate uploaded metadata.db: %s", ex)
        return jsonify(error=_("Failed to validate the uploaded file.")), 500

    session['setup_staged_db'] = tmp_path
    return jsonify(success=True)


@setup.route("/setup/library", methods=['POST'])
def setup_library():
    has_admin, has_db = _needs_setup()
    if has_db:
        return jsonify(error=_("A library is already configured.")), 400

    data = request.get_json(silent=True) or {}
    mode = data.get('mode', 'fresh')

    if mode == 'upload':
        # Install pre-validated staged file
        tmp_path = session.pop('setup_staged_db', None)
        if not tmp_path or not os.path.exists(tmp_path):
            return jsonify(error=_("No validated file found. Please select a file first.")), 400

        os.makedirs(DEFAULT_LIBRARY_PATH, exist_ok=True)
        dest = os.path.join(DEFAULT_LIBRARY_PATH, 'metadata.db')
        shutil.move(tmp_path, dest)
    else:
        # "Start Fresh" — create an empty metadata.db
        os.makedirs(DEFAULT_LIBRARY_PATH, exist_ok=True)
        dest = os.path.join(DEFAULT_LIBRARY_PATH, 'metadata.db')
        try:
            _create_empty_metadata_db(dest)
        except Exception as ex:
            log.error("Setup: failed to create metadata.db: %s", ex)
            return jsonify(error=_("Failed to create library.")), 500

    # Point config at the new library
    config.config_calibre_dir = DEFAULT_LIBRARY_PATH
    try:
        config.save()
    except Exception as ex:
        log.error("Setup: failed to save config: %s", ex)
        return jsonify(error=_("Failed to save configuration.")), 500

    # Reconnect calibre_db to the new library
    calibre_db.reconnect_db(config, ub.app_DB_path)

    return jsonify(success=True, mode=mode)


def _validate_metadata_db(path):
    """Validate that the file is a Calibre-compatible metadata.db."""
    required_tables = {'books', 'authors', 'tags', 'series', 'publishers', 'languages',
                       'data', 'library_id', 'custom_columns'}
    try:
        conn = sqlite3.connect(path)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}
        conn.close()
    except Exception:
        raise ValueError(_("The uploaded file is not a valid database."))
    missing = required_tables - tables
    if missing:
        raise ValueError(_("Not a valid Calibre database. Missing tables: %(tables)s",
                           tables=', '.join(sorted(missing))))


def _create_empty_metadata_db(path):
    """Create a minimal Calibre-compatible metadata.db."""
    from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, Float, text
    from sqlalchemy import TIMESTAMP
    engine = create_engine('sqlite:///{}'.format(path), echo=False)
    with engine.begin() as conn:
        conn.execute(text('''CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL DEFAULT 'Unknown',
            sort TEXT,
            "author_sort" TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            pubdate TIMESTAMP DEFAULT '0101-01-01 00:00:00+00:00',
            series_index TEXT NOT NULL DEFAULT '1.0',
            last_modified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            path TEXT NOT NULL DEFAULT '',
            has_cover INTEGER DEFAULT 0,
            uuid TEXT,
            isbn TEXT DEFAULT '',
            lccn TEXT DEFAULT '',
            flags INTEGER NOT NULL DEFAULT 1
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS authors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort TEXT,
            link TEXT NOT NULL DEFAULT ''
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS series (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort TEXT
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS publishers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort TEXT
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS languages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lang_code TEXT NOT NULL
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book INTEGER NOT NULL,
            text TEXT NOT NULL DEFAULT ''
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rating INTEGER
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS identifiers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book INTEGER NOT NULL,
            type TEXT NOT NULL DEFAULT 'isbn',
            val TEXT NOT NULL
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book INTEGER NOT NULL,
            format TEXT NOT NULL,
            uncompressed_size INTEGER NOT NULL,
            name TEXT NOT NULL
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS books_authors_link (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book INTEGER NOT NULL,
            author INTEGER NOT NULL
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS books_tags_link (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book INTEGER NOT NULL,
            tag INTEGER NOT NULL
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS books_series_link (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book INTEGER NOT NULL,
            series INTEGER NOT NULL
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS books_publishers_link (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book INTEGER NOT NULL,
            publisher INTEGER NOT NULL
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS books_languages_link (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book INTEGER NOT NULL,
            lang_code INTEGER NOT NULL,
            item_order INTEGER NOT NULL DEFAULT 0
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS books_ratings_link (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book INTEGER NOT NULL,
            rating INTEGER NOT NULL
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS custom_columns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            name TEXT NOT NULL,
            datatype TEXT NOT NULL,
            mark_for_delete INTEGER NOT NULL DEFAULT 0,
            editable INTEGER NOT NULL DEFAULT 1,
            display TEXT DEFAULT '{}',
            is_multiple INTEGER NOT NULL DEFAULT 0,
            normalized INTEGER NOT NULL DEFAULT 0
        )'''))
        conn.execute(text('''CREATE TABLE IF NOT EXISTS library_id (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL
        )'''))
        lib_uuid = str(uuid.uuid4())
        conn.execute(text("INSERT INTO library_id (uuid) VALUES (:uuid)"), {"uuid": lib_uuid})
