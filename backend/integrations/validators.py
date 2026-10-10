"""
Tenant Boundary Validation & IDOR Defense for Integrations.

Provides strict assertions that prevent cross-tenant object manipulation (BOLA/IDOR):
Tenant A cannot reference or bind Tenant A items to Tenant B, or vice-versa.
"""
from rest_framework.exceptions import PermissionDenied


class CrossTenantBoundaryViolation(PermissionDenied):
    """
    Raised when an operation attempts to link or access entities across tenant boundaries.
    Treated as a critical security event and audited.
    """
    default_detail = "Security Violation: Cross-tenant resource linkage is strictly prohibited."
    default_code = "cross_tenant_violation"


def validate_tenant_boundary(
    *,
    shop,
    product=None,
    order=None,
    integration=None,
    credential=None,
    stock_movement=None,
    shipment=None,
    external_order=None,
    courier_account=None,
    endpoint=None,
    mapping=None,
    event=None,
):
    """
    Assert that all provided entities belong strictly to the specified `shop`.
    Raises CrossTenantBoundaryViolation if any object belongs to a different shop.
    """
    shop_id = getattr(shop, "id", shop)
    if not shop_id:
        raise CrossTenantBoundaryViolation("Active shop identifier is required for boundary validation.")

    if product is not None:
        p_shop_id = getattr(product, "shop_id", None) or getattr(getattr(product, "shop", None), "id", None)
        if p_shop_id != shop_id:
            raise CrossTenantBoundaryViolation(
                f"IDOR Violation: Product #{getattr(product, 'id', product)} does not belong to Shop #{shop_id}."
            )

    if order is not None:
        o_shop_id = getattr(order, "shop_id", None) or getattr(getattr(order, "shop", None), "id", None)
        if o_shop_id != shop_id:
            raise CrossTenantBoundaryViolation(
                f"IDOR Violation: Order #{getattr(order, 'id', order)} does not belong to Shop #{shop_id}."
            )

    if integration is not None:
        i_shop_id = getattr(integration, "shop_id", None) or getattr(getattr(integration, "shop", None), "id", None)
        if i_shop_id != shop_id:
            raise CrossTenantBoundaryViolation(
                f"IDOR Violation: Integration #{getattr(integration, 'id', integration)} does not belong to Shop #{shop_id}."
            )

    if credential is not None:
        c_shop_id = getattr(credential, "shop_id", None) or getattr(getattr(credential, "shop", None), "id", None)
        if c_shop_id != shop_id:
            raise CrossTenantBoundaryViolation(
                f"IDOR Violation: Credential #{getattr(credential, 'id', credential)} does not belong to Shop #{shop_id}."
            )

    if stock_movement is not None:
        s_shop_id = getattr(stock_movement, "shop_id", None) or getattr(getattr(stock_movement, "shop", None), "id", None)
        if s_shop_id != shop_id:
            raise CrossTenantBoundaryViolation(
                f"IDOR Violation: StockMovement #{getattr(stock_movement, 'id', stock_movement)} does not belong to Shop #{shop_id}."
            )

    if shipment is not None:
        sh_shop_id = getattr(shipment, "shop_id", None) or getattr(getattr(shipment, "shop", None), "id", None)
        if sh_shop_id != shop_id:
            raise CrossTenantBoundaryViolation(
                f"IDOR Violation: Shipment #{getattr(shipment, 'id', shipment)} does not belong to Shop #{shop_id}."
            )

    if external_order is not None:
        eo_shop_id = getattr(external_order, "shop_id", None) or getattr(getattr(external_order, "shop", None), "id", None)
        if eo_shop_id != shop_id:
            raise CrossTenantBoundaryViolation(
                f"IDOR Violation: ExternalOrder #{getattr(external_order, 'id', external_order)} does not belong to Shop #{shop_id}."
            )

    if courier_account is not None:
        ca_shop_id = getattr(courier_account, "shop_id", None) or getattr(getattr(courier_account, "shop", None), "id", None)
        if ca_shop_id != shop_id:
            raise CrossTenantBoundaryViolation(
                f"IDOR Violation: CourierAccount #{getattr(courier_account, 'id', courier_account)} does not belong to Shop #{shop_id}."
            )

    if endpoint is not None:
        ep_shop_id = getattr(endpoint, "shop_id", None) or getattr(getattr(endpoint, "shop", None), "id", None)
        if ep_shop_id != shop_id:
            raise CrossTenantBoundaryViolation(
                f"IDOR Violation: WebhookEndpoint #{getattr(endpoint, 'id', endpoint)} does not belong to Shop #{shop_id}."
            )

    if mapping is not None:
        m_shop_id = getattr(mapping, "shop_id", None) or getattr(getattr(mapping, "shop", None), "id", None)
        if m_shop_id != shop_id:
            raise CrossTenantBoundaryViolation(
                f"IDOR Violation: ProductChannelMapping #{getattr(mapping, 'id', mapping)} does not belong to Shop #{shop_id}."
            )

    if event is not None:
        ev_shop_id = getattr(event, "shop_id", None) or getattr(getattr(event, "shop", None), "id", None)
        if ev_shop_id != shop_id:
            raise CrossTenantBoundaryViolation(
                f"IDOR Violation: IntegrationEvent #{getattr(event, 'id', event)} does not belong to Shop #{shop_id}."
            )
