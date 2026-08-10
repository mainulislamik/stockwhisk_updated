import logging
import os
import subprocess
import tempfile
import time
import shutil
from django.conf import settings
from celery import shared_task
from google.oauth2.credentials import Credentials
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
        "user": os.environ.get("DB_USER", "stockwhisk"),
        "name": os.environ.get("DB_NAME", "stockwhisk"),
    }

@shared_task
def perform_drive_backup():
    config = PlatformConfig.get_solo()
    if not config.drive_refresh_token or not config.drive_folder_id or not config.drive_client_id or not config.drive_client_secret:
        msg = "Google Drive backup skipped: Missing OAuth config or folder ID."
        logger.warning(msg)
        return False, msg
        
    try:
        credentials = Credentials(
            token=None,
            refresh_token=config.drive_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=config.drive_client_id,
            client_secret=config.drive_client_secret
        )
        drive_service = build('drive', 'v3', credentials=credentials, cache_discovery=False)
    except Exception as e:
        msg = f"Google Drive authentication failed: {e}"
        logger.error(msg)
        return False, msg

    env, db = _db_env()
    filename = f"stockwhisk_backup_{time.strftime('%Y%m%d-%H%M%S')}.sql"
    
    # 1. Create a local temporary file
    fd, tmp_path = tempfile.mkstemp(suffix=".sql")
    os.close(fd)
    
    try:
        # 2. Run pg_dump to dump to the temp file
        with open(tmp_path, "wb") as f_out:
            try:
                proc = subprocess.Popen(
                    ["pg_dump", "-h", db["host"], "-p", db["port"], "-U", db["user"],
                     "-d", db["name"], "--clean", "--if-exists", "--no-owner",
                     "--no-privileges"],
                    stdout=f_out, stderr=subprocess.PIPE, env=env,
                )
            except FileNotFoundError:
                msg = "pg_dump command not found on server."
                logger.error(msg)
                return False, msg

            proc.wait()
            if proc.returncode != 0:
                err = proc.stderr.read().decode(errors="replace")
                msg = f"pg_dump failed: {err}"
                logger.error(msg)
                return False, msg

        # 3. Upload DB to Google Drive
        file_metadata = {
            'name': filename,
            'parents': [config.drive_folder_id]
        }
        media = MediaFileUpload(tmp_path, mimetype='application/sql', resumable=True)
        uploaded_file = drive_service.files().create(body=file_metadata, media_body=media, fields='id').execute()

        # 3.5 Backup Media Directory
        media_filename = f"stockwhisk_media_{time.strftime('%Y%m%d-%H%M%S')}.zip"
        media_tmp_dir = tempfile.mkdtemp()
        media_tmp_path = os.path.join(media_tmp_dir, "media")
        shutil.make_archive(media_tmp_path, 'zip', settings.MEDIA_ROOT)
        media_zip_path = media_tmp_path + ".zip"

        try:
            media_file_metadata = {
                'name': media_filename,
                'parents': [config.drive_folder_id]
            }
            media_upload = MediaFileUpload(media_zip_path, mimetype='application/zip', resumable=True)
            uploaded_media_file = drive_service.files().create(body=media_file_metadata, media_body=media_upload, fields='id').execute()
        finally:
            # Clean up local zip
            if os.path.exists(media_zip_path):
                os.remove(media_zip_path)
            shutil.rmtree(media_tmp_dir, ignore_errors=True)
        
        # 4. Delete old backups in the folder to save space
        try:
            # Delete old SQL backups
            query = f"'{config.drive_folder_id}' in parents and name contains 'stockwhisk_backup_' and trashed=false"
            results = drive_service.files().list(q=query, fields="files(id, name)").execute()
            items = results.get('files', [])
            for item in items:
                if item['id'] != uploaded_file.get('id'):
                    drive_service.files().delete(fileId=item['id']).execute()
                    logger.info(f"Deleted old backup from Drive: {item['name']}")
                    
            # Delete old Media backups
            media_query = f"'{config.drive_folder_id}' in parents and name contains 'stockwhisk_media_' and trashed=false"
            media_results = drive_service.files().list(q=media_query, fields="files(id, name)").execute()
            media_items = media_results.get('files', [])
            for item in media_items:
                if item['id'] != uploaded_media_file.get('id'):
                    drive_service.files().delete(fileId=item['id']).execute()
                    logger.info(f"Deleted old media backup from Drive: {item['name']}")
        except Exception as e:
            logger.warning(f"Failed to delete old backups from Drive: {e}")

        msg = f"Google Drive backup successful: {filename}"
        logger.info(msg)
        return True, msg
    except Exception as e:
        msg = f"Google Drive backup failed: {e}"
        logger.error(msg)
        return False, msg
    finally:
        # 4. Remove the temporary file from VPS storage immediately
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except:
                pass
