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

from platform_admin.models import PlatformConfig, ShopDataBackup, ShopDataOperation
from tenants.models import Shop
from django.core import serializers
from django.core.files.base import ContentFile
from django.db import transaction
from django.apps import apps
from django.utils import timezone

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
        
        # Ensure MEDIA_ROOT exists to prevent FileNotFoundError
        if not os.path.exists(settings.MEDIA_ROOT):
            os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
            
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
        # Remove the temporary SQL file from storage immediately
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass

OPERATIONAL_MODELS_ORDER = [
    "catalog.Category",
    "catalog.Brand",
    "catalog.Unit",
    "accounting.ExpenseCategory",
    "crm.Customer",
    "purchasing.Supplier",
    "catalog.Product",
    "catalog.ProductUnit",
    "catalog.ProductVariation",
    "sales.Sale",
    "purchasing.PurchaseOrder",
    "service.Warranty",
    "sales.SaleItem",
    "purchasing.PurchaseOrderItem",
    "service.WarrantyClaim",
    "service.ServiceTicket",
    "service.ServiceTicketPart",
    "service.ServiceTicketStatusHistory",
    "sales.SaleReturn",
    "sales.SaleReturnItem",
    "sales.EMISchedule",
    "sales.EMIInstallment",
    "sales.Payment",
    "purchasing.PurchasePayment",
    "purchasing.SupplierPayment",
    "crm.CustomerPayment",
    "branches.StockTransfer",
    "branches.StockTransferItem",
    "inventory.StockMovement",
    "accounting.Expense",
    "accounting.RecurringExpense",
    "accounting.LedgerEntry",
    "accounting.DailySettlement",
    "notifications.Notification",
]

@shared_task
def clear_shop_data_task(shop_id, user_id):
    """
    Background task to securely back up and delete a shop's operational data.
    """
    op = ShopDataOperation.objects.create(
        shop_id=shop_id,
        initiated_by_id=user_id,
        operation_type=ShopDataOperation.OperationType.CLEAR,
        status=ShopDataOperation.Status.STARTED
    )

    try:
        # 1. Gather data
        objects = []
        for model_name in OPERATIONAL_MODELS_ORDER:
            try:
                model = apps.get_model(model_name)
                if hasattr(model, 'all_objects'):
                    objects.extend(model.all_objects.filter(shop_id=shop_id))
                else:
                    objects.extend(model.objects.filter(shop_id=shop_id))
            except LookupError:
                continue

        # 2. Serialize
        json_data = serializers.serialize("json", objects)
        
        # 3. Create Backup
        import datetime
        from django.utils import timezone
        
        backup = ShopDataBackup.objects.create(
            shop_id=shop_id,
            created_by_id=user_id,
            expires_at=timezone.now() + datetime.timedelta(days=15),
            records_count=len(objects),
            status=ShopDataBackup.Status.PENDING
        )
        backup.backup_file.save(f"shop_{shop_id}_backup_{backup.id}.json", ContentFile(json_data.encode('utf-8')))
        backup.status = ShopDataBackup.Status.VERIFIED
        backup.save()

        # 4. Delete Data (in reverse dependency order to avoid FK errors)
        with transaction.atomic():
            for model_name in reversed(OPERATIONAL_MODELS_ORDER):
                try:
                    model = apps.get_model(model_name)
                    # We bypass TenantManager just in case, though filter(shop_id) is safe
                    if hasattr(model, 'all_objects'):
                        model.all_objects.filter(shop_id=shop_id).delete()
                    else:
                        model.objects.filter(shop_id=shop_id).delete()
                except LookupError:
                    continue

        op.status = ShopDataOperation.Status.COMPLETED
        op.completed_at = timezone.now()
        op.save()
        return True

    except Exception as e:
        logger.error(f"Shop data clear failed for shop {shop_id}: {str(e)}")
        op.status = ShopDataOperation.Status.FAILED
        op.error_message = str(e)
        op.completed_at = timezone.now()
        op.save()
        return False


@shared_task
def restore_shop_data_task(backup_id, user_id):
    """
    Restores operational data from a 15-day backup file.
    """
    backup = ShopDataBackup.objects.get(id=backup_id)
    op = ShopDataOperation.objects.create(
        shop_id=backup.shop_id,
        initiated_by_id=user_id,
        operation_type=ShopDataOperation.OperationType.RESTORE,
        status=ShopDataOperation.Status.STARTED
    )

    try:
        if not backup.backup_file:
            raise ValueError("Backup file missing.")

        backup.backup_file.open("r")
        json_data = backup.backup_file.read()
        if isinstance(json_data, bytes):
            json_data = json_data.decode('utf-8')
        backup.backup_file.close()

        with transaction.atomic():
            # Clear current operational data before restoring to prevent conflicts
            for model_name in reversed(OPERATIONAL_MODELS_ORDER):
                try:
                    model = apps.get_model(model_name)
                    if hasattr(model, 'all_objects'):
                        model.all_objects.filter(shop_id=backup.shop_id).delete()
                    else:
                        model.objects.filter(shop_id=backup.shop_id).delete()
                except LookupError:
                    continue

            # Deserialize and save
            for deserialized_object in serializers.deserialize("json", json_data):
                obj = deserialized_object.object
                if getattr(obj, 'shop_id', None) == backup.shop_id:
                    obj.save()

        backup.status = ShopDataBackup.Status.RESTORED
        backup.save()

        op.status = ShopDataOperation.Status.COMPLETED
        op.completed_at = timezone.now()
        op.save()
        return True

    except Exception as e:
        logger.error(f"Shop data restore failed for backup {backup_id}: {str(e)}")
        op.status = ShopDataOperation.Status.FAILED
        op.error_message = str(e)
        op.completed_at = timezone.now()
        op.save()
        return False


@shared_task
def cleanup_expired_shop_backups():
    """
    Runs daily to permanently delete expired shop backups.
    """
    from django.utils import timezone
    expired_backups = ShopDataBackup.objects.filter(
        expires_at__lte=timezone.now()
    ).exclude(status=ShopDataBackup.Status.DELETED)

    for backup in expired_backups:
        if backup.backup_file:
            try:
                backup.backup_file.delete(save=False)
            except Exception as e:
                logger.error(f"Failed to delete file for backup {backup.id}: {e}")
        
        backup.status = ShopDataBackup.Status.DELETED
        backup.deleted_at = timezone.now()
        backup.save()
        
        ShopDataOperation.objects.create(
            shop_id=backup.shop_id,
            operation_type=ShopDataOperation.OperationType.AUTO_DELETE,
            status=ShopDataOperation.Status.COMPLETED,
            completed_at=timezone.now()
        )
