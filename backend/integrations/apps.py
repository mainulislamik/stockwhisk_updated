"""
Integrations Application Config
"""
from django.apps import AppConfig


class IntegrationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "integrations"
    verbose_name = "Integrations"

    def ready(self):
        try:
            from . import signals  # noqa
        except Exception:
            pass
