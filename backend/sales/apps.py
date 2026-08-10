from django.apps import AppConfig


class SalesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sales'

    def ready(self):
        import sys
        if 'runserver' not in sys.argv and 'celery' not in sys.argv:
            return
            
        try:
            from django_celery_beat.models import PeriodicTask, CrontabSchedule
            import json
            
            # Create a crontab schedule for everyday at 9 AM
            schedule, _ = CrontabSchedule.objects.get_or_create(
                minute='0',
                hour='9',
                day_of_week='*',
                day_of_month='*',
                month_of_year='*',
            )
            
            PeriodicTask.objects.get_or_create(
                crontab=schedule,
                name='Send EMI Reminders Daily',
                task='sales.tasks.send_emi_reminders',
            )
        except Exception:
            pass
