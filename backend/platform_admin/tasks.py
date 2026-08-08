import logging
import os
import subprocess
import tempfile
import time
import json
from celery import shared_task
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from platform_admin.models import PlatformConfig

logger = logging.getLogger(__name__)

def _db_env():
    env = os.environ.copy()
    env["PGPASSWORD"] = os.environ.get("DB_PASSWORD", "stockwhisk_password")
    return env, {
        "host": os.environ.get("DB_HOST", "db"),
        "port": os.environ.get("DB_PORT", "5432"),
        "name": os.environ.get("DB_NAME", "stockwhisk"),
        "user": os.environ.get("DB_USER", "stockwhisk"),
    }

@shared_task
def perform_drive_backup():
    config = PlatformConfig.get_solo()
    if not config.drive_credentials_json or not config.drive_folder_id:
        logger.warning("Google Drive backup skipped: Missing credentials or folder ID.")
        return False
        
    try:
        creds_info = json.loads(config.drive_credentials_json)
        credentials = Credentials.from_service_account_info(
            creds_info, scopes=['https://www.googleapis.com/auth/drive.file']
        )
        drive_service = build('drive', 'v3', credentials=credentials, cache_discovery=False)
    except Exception as e:
        logger.error(f"Google Drive authentication failed: {e}")
        return False

    env, db = _db_env()
    filename = f"stockwhisk_backup_{time.strftime('%Y%m%d-%H%M%S')}.sql"
    
    # 1. Create a local temporary file
    fd, tmp_path = tempfile.mkstemp(suffix=".sql")
    os.close(fd)
    
    try:
        # 2. Run pg_dump to dump to the temp file
        with open(tmp_path, "wb") as f_out:
            proc = subprocess.Popen(
                ["pg_dump", "-h", db["host"], "-p", db["port"], "-U", db["user"],
                 "-d", db["name"], "--clean", "--if-exists", "--no-owner",
                 "--no-privileges"],
                stdout=f_out, stderr=subprocess.PIPE, env=env,
            )
            proc.wait()
            if proc.returncode != 0:
                err = proc.stderr.read().decode(errors="replace")
                logger.error(f"pg_dump failed: {err}")
                return False

        # 3. Upload to Google Drive
        file_metadata = {
            'name': filename,
            'parents': [config.drive_folder_id]
        }
        media = MediaFileUpload(tmp_path, mimetype='application/sql', resumable=True)
        drive_service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        
        logger.info(f"Google Drive backup successful: {filename}")
        return True
    except Exception as e:
        logger.error(f"Google Drive backup failed: {e}")
        return False
    finally:
        # 4. Remove the temporary file from VPS storage immediately
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
