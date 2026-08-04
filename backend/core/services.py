from typing import Generic, TypeVar, Type, Optional
from django.db import models
from django.core.exceptions import PermissionDenied
from .tenant_context import get_current_tenant

T = TypeVar('T', bound=models.Model)

class BaseService(Generic[T]):
    """
    Base service class that enforces tenant isolation.
    All business logic should be placed in service classes, leaving ViewSets thin.
    """
    model: Type[T]

    @classmethod
    def get_queryset(cls) -> models.QuerySet[T]:
        """
        Returns a tenant-scoped queryset.
        Raises PermissionDenied if no tenant is set.
        """
        tenant = get_current_tenant()
        if not tenant:
            raise PermissionDenied("No tenant active in current context.")
        
        # If the model has a 'shop' field (most do), filter by it.
        # This acts as a secondary failsafe over TenantManager.
        if hasattr(cls.model, 'shop'):
            return cls.model.objects.filter(shop=tenant)
        return cls.model.objects.all()

    @classmethod
    def get_object(cls, object_id: int) -> T:
        """Fetch a single object ensuring it belongs to the current tenant."""
        return cls.get_queryset().get(id=object_id)
