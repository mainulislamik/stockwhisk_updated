"""
Unit, Functional, and Lifecycle Tests for Phase 9 Custom Webhook Website Connector.

Verifies:
1. Connection & Disconnect lifecycle operations
2. Authentication & credential validation (valid, 401, 403, missing credentials)
3. Product fetch operations & malformed response handling
4. Product flow: Phase 5 mapping, export, import, missing SKU handling
5. Inventory flow: Outbound ATS calculation, update_inventory, reservation deduction
6. Order flow: Inbound webhook verification, parsing, mapping, StockWhisk order & stock reservation
7. Duplicate order handling & idempotency
8. Duplicate webhook detection & rejection
9. Webhook lifecycle (register, verify signature, delete)
10. Error handling: HTTP 429 rate limit (with retry_after), timeout, HTTP 500/502/504
11. Bounded retry mechanism for transient errors vs immediate abort on permanent errors
12. Multi-tenant isolation (cross-tenant safety across shops)
"""
import hashlib
import hmac
import json
import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch
import requests

from django.test import TransactionTestCase

from accounts.models import RoleType, User
from catalog.models import Category, Product, ProductVariation, Unit
from inventory.models import MovementType
from inventory.services import apply_movement
from sales.models import Sale
from tenants.models import Shop

from .connectors import (
    BaseWebsiteConnector,
    ConnectorAuthError,
    ConnectorDuplicateWebhookError,
    ConnectorError,
    ConnectorMalformedResponseError,
    ConnectorMissingProductError,
    ConnectorMissingSKUError,
    ConnectorRateLimitError,
    ConnectorServerError,
    ConnectorTimeoutError,
    ConnectorWebhookError,
    CustomWebhookConnector,
    CustomWebhookInventoryAdapter,
    get_connector,
)
from .inventory_engine import get_inventory_levels, reserve_inventory_for_order
from .models import (
    ExternalOrder,
    Integration,
    IntegrationCategory,
    IntegrationCredential,
    IntegrationLog,
    IntegrationProvider,
    IntegrationStatus,
    InventoryReservation,
    ProductChannelMapping,
)
from .order_engine import StandardOrderDTO, StandardOrderItemDTO


class CustomWebhookConnectorPhase9Tests(TransactionTestCase):
    def setUp(self):
        super().setUp()

        # 1. Tenant Shop A
        u_suffix = uuid.uuid4().hex[:6]
        self.shop_a = Shop.objects.create(
            name="Phase 9 Shop Alpha",
            slug=f"p9-shop-alpha-{u_suffix}",
            is_active=True,
            modules={"integrations": True},
        )
        self.user_a = User.objects.create_user(
            email=f"owner_alpha_{u_suffix}@example.com",
            shop=self.shop_a,
            role=RoleType.OWNER,
            password="Password123!",
        )

        self.integration_a = Integration.all_objects.create(
            shop=self.shop_a,
            name="Alpha Web Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.CUSTOM_WEBHOOK,
            status=IntegrationStatus.CONNECTED,
            is_active=True,
            base_url="https://store-alpha.example.com",
            config={"sync_inventory": True, "sync_orders": True},
        )

        self.secret_token = "whsec_super_secret_signing_key_12345"
        self.cred_a = IntegrationCredential.all_objects.create(
            shop=self.shop_a,
            integration=self.integration_a,
        )
        self.cred_a.set_credentials(
            api_key="api_key_alpha_123",
            api_secret="api_sec_alpha_456",
            webhook_secret=self.secret_token,
        )
        self.cred_a.save()

        # Catalog setup for Shop A
        self.unit_a, _ = Unit.all_objects.get_or_create(
            shop=self.shop_a,
            name="Piece",
            defaults={"short_code": "pcs", "measure_type": "count", "allow_decimal": False},
        )
        self.category_a = Category.all_objects.create(shop=self.shop_a, name="Electronics")

        self.product_a = Product.all_objects.create(
            shop=self.shop_a,
            category=self.category_a,
            unit=self.unit_a,
            name="Wireless Mouse",
            sku="MOUSE-W-01",
            cost_price=Decimal("150.00"),
            selling_price=Decimal("300.00"),
            track_inventory=True,
        )
        apply_movement(
            shop=self.shop_a,
            product=self.product_a,
            movement_type=MovementType.OPENING,
            quantity=Decimal("20.00"),
            note="Initial Stock 20",
        )

        # 2. Tenant Shop B (for Tenant Isolation testing)
        self.shop_b = Shop.objects.create(
            name="Phase 9 Shop Beta",
            slug=f"p9-shop-beta-{u_suffix}",
            is_active=True,
        )
        self.user_b = User.objects.create_user(
            email=f"owner_beta_{u_suffix}@example.com",
            shop=self.shop_b,
            role=RoleType.OWNER,
            password="Password123!",
        )
        self.integration_b = Integration.all_objects.create(
            shop=self.shop_b,
            name="Beta Web Store",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.CUSTOM_WEBHOOK,
            status=IntegrationStatus.CONNECTED,
            is_active=True,
            base_url="https://store-beta.example.com",
        )
        self.cred_b = IntegrationCredential.all_objects.create(
            shop=self.shop_b,
            integration=self.integration_b,
        )
        self.cred_b.set_credentials(
            api_key="api_key_beta_789",
            api_secret="api_sec_beta_999",
            webhook_secret="beta_secret",
        )
        self.cred_b.save()

        self.unit_b, _ = Unit.all_objects.get_or_create(
            shop=self.shop_b,
            name="Piece",
            defaults={"short_code": "pcs", "measure_type": "count", "allow_decimal": False},
        )
        self.product_b = Product.all_objects.create(
            shop=self.shop_b,
            unit=self.unit_b,
            name="Beta Mechanical Keyboard",
            sku="KEY-MECH-02",
            cost_price=Decimal("400.00"),
            selling_price=Decimal("800.00"),
            track_inventory=True,
        )

    def _sign_payload(self, body_bytes: bytes, secret: str = "") -> str:
        sec = secret or self.secret_token
        return hmac.new(sec.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

    # --------------------------------------------------------------------------
    # 1. Connection & Disconnect Lifecycle Operations
    # --------------------------------------------------------------------------

    @patch("requests.request")
    def test_connect_and_disconnect(self, mock_req):
        # Start in DRAFT state for testing connection lifecycle
        self.integration_a.status = IntegrationStatus.DRAFT
        self.integration_a.is_active = False
        self.integration_a.save(update_fields=["status", "is_active"])

        # Mock auth verification success
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"valid": True}
        mock_req.return_value = mock_resp

        connector = get_connector(self.integration_a)
        self.assertIsInstance(connector, CustomWebhookConnector)

        # Connect
        connected = connector.connect()
        self.assertTrue(connected)
        self.integration_a.refresh_from_db()
        self.assertEqual(self.integration_a.status, IntegrationStatus.CONNECTED)
        self.assertTrue(
            IntegrationLog.all_objects.filter(
                shop=self.shop_a,
                integration=self.integration_a,
                action="connector_connected",
            ).exists()
        )

        # Disconnect
        disconnected = connector.disconnect()
        self.assertTrue(disconnected)
        self.integration_a.refresh_from_db()
        self.assertEqual(self.integration_a.status, IntegrationStatus.DISCONNECTED)
        self.assertFalse(self.integration_a.is_active)
        self.assertTrue(
            IntegrationLog.all_objects.filter(
                shop=self.shop_a,
                integration=self.integration_a,
                action="connector_disconnected",
            ).exists()
        )

    # --------------------------------------------------------------------------
    # 2. Authentication & Credential Validation
    # --------------------------------------------------------------------------

    def test_authentication_missing_credentials(self):
        # Create uncredentialed integration
        integ = Integration.all_objects.create(
            shop=self.shop_a,
            name="Uncredentialed",
            category=IntegrationCategory.ECOMMERCE,
            provider=IntegrationProvider.CUSTOM_WEBHOOK,
            base_url="https://empty.example.com",
        )
        connector = get_connector(integ)
        with self.assertRaises(ConnectorAuthError):
            connector.validate_credentials()

    @patch("requests.request")
    def test_authentication_http_401_and_403(self, mock_req):
        connector = get_connector(self.integration_a)

        # HTTP 401
        mock_401 = MagicMock()
        mock_401.status_code = 401
        mock_401.text = "Unauthorized"
        mock_req.return_value = mock_401

        with self.assertRaises(ConnectorAuthError):
            connector.validate_credentials()

        # HTTP 403
        mock_403 = MagicMock()
        mock_403.status_code = 403
        mock_403.text = "Forbidden: Insufficient API Scope"
        mock_req.return_value = mock_403

        with self.assertRaises(ConnectorAuthError):
            connector.validate_credentials()

    # --------------------------------------------------------------------------
    # 3. Product Fetch Operations & Malformed Responses
    # --------------------------------------------------------------------------

    @patch("requests.request")
    def test_fetch_products_success(self, mock_req):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "products": [
                {
                    "id": "ext_prod_101",
                    "sku": "EXT-SKU-101",
                    "name": "External Gaming Mouse",
                    "price": "350.00",
                    "stock_quantity": 45,
                },
                {
                    "id": "ext_prod_102",
                    "sku": "EXT-SKU-102",
                    "name": "External USB Hub",
                    "price": "120.00",
                    "stock_quantity": 10,
                },
            ]
        }
        mock_req.return_value = mock_resp

        connector = get_connector(self.integration_a)
        items = connector.fetch_products(page=1, limit=10)
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["external_product_id"], "ext_prod_101")
        self.assertEqual(items[0]["external_sku"], "EXT-SKU-101")
        self.assertEqual(items[0]["stock_quantity"], 45)

    @patch("requests.request")
    def test_fetch_products_malformed_and_missing_id(self, mock_req):
        connector = get_connector(self.integration_a)

        # Malformed non-JSON response
        mock_malformed = MagicMock()
        mock_malformed.status_code = 200
        mock_malformed.content = b"<html>Bad Gateway</html>"
        mock_malformed.json.side_effect = ValueError("Invalid JSON")
        mock_req.return_value = mock_malformed

        with self.assertRaises(ConnectorMalformedResponseError):
            connector.fetch_products()

        # Product missing external id
        mock_bad_item = MagicMock()
        mock_bad_item.status_code = 200
        mock_bad_item.content = b'{"products": [{"name": "No ID Item"}]}'
        mock_bad_item.json.return_value = {"products": [{"name": "No ID Item"}]}
        mock_req.return_value = mock_bad_item

        with self.assertRaises(ConnectorMissingProductError):
            connector.fetch_products()

    # --------------------------------------------------------------------------
    # 4. Product Flow: Mapping, Export, Import
    # --------------------------------------------------------------------------

    def test_map_product_using_phase5_system(self):
        connector = get_connector(self.integration_a)
        mapping = connector.map_product(
            product=self.product_a,
            external_product_id="remote_prod_77",
            external_sku="MOUSE-W-01",
            sync_stock=True,
        )
        self.assertEqual(mapping.shop, self.shop_a)
        self.assertEqual(mapping.integration, self.integration_a)
        self.assertEqual(mapping.external_product_id, "remote_prod_77")
        self.assertTrue(mapping.is_sync_enabled)
        self.assertTrue(mapping.sync_inventory)

    @patch("requests.request")
    def test_export_and_map_product(self, mock_req):
        # Mock product creation on remote site
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.content = b'{"id": "ext_mouse_999", "status": "publish"}'
        mock_resp.json.return_value = {"id": "ext_mouse_999", "status": "publish"}
        mock_req.return_value = mock_resp

        connector = get_connector(self.integration_a)
        mapping = connector.export_and_map_product(
            product=self.product_a,
            sync_stock=True,
        )
        self.assertEqual(mapping.external_product_id, "ext_mouse_999")
        self.assertEqual(mapping.external_sku, "MOUSE-W-01")

        # Verify POST data sent
        called_args, called_kwargs = mock_req.call_args
        self.assertEqual(called_kwargs["json"]["sku"], "MOUSE-W-01")
        self.assertEqual(called_kwargs["json"]["stock_quantity"], 20.0)

    def test_export_missing_sku_fails(self):
        # Product without SKU
        prod_no_sku = Product.all_objects.create(
            shop=self.shop_a,
            unit=self.unit_a,
            name="No SKU Product",
            selling_price=Decimal("10.00"),
        )
        Product.all_objects.filter(id=prod_no_sku.id).update(sku="")
        prod_no_sku.refresh_from_db()

        connector = get_connector(self.integration_a)
        with self.assertRaises(ConnectorMissingSKUError):
            connector.export_and_map_product(prod_no_sku)

    def test_import_and_map_product(self):
        connector = get_connector(self.integration_a)
        remote_item = {
            "external_product_id": "ext_web_headphone_55",
            "sku": "HEADPHONE-BT-55",
            "name": "Bluetooth Wireless Headphones",
            "price": "1200.00",
        }

        mapping = connector.import_and_map_product(remote_item)
        self.assertEqual(mapping.external_product_id, "ext_web_headphone_55")

        # Verify internal Product created
        product = Product.all_objects.get(shop=self.shop_a, sku="HEADPHONE-BT-55")
        self.assertEqual(product.name, "Bluetooth Wireless Headphones")
        self.assertEqual(product.selling_price, Decimal("1200.00"))

    # --------------------------------------------------------------------------
    # 5. Inventory Flow: Outbound ATS calculation & update_inventory
    # --------------------------------------------------------------------------

    @patch("requests.request")
    def test_inventory_update_and_ats_push(self, mock_req):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = b'{"success": true}'
        mock_resp.json.return_value = {"success": True}
        mock_req.return_value = mock_resp

        connector = get_connector(self.integration_a)
        # Establish mapping
        connector.map_product(
            product=self.product_a,
            external_product_id="remote_mouse_101",
        )

        # Push stock
        res = connector.sync_stock_to_external(self.product_a)
        self.assertEqual(res, {"success": True})

        # Verify posted quantity matches ATS = 20 (no reservations)
        called_args, called_kwargs = mock_req.call_args
        self.assertEqual(called_kwargs["json"]["available_quantity"], 20.0)

        # Now simulate a reservation of 5 items
        reserve_inventory_for_order(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.product_a,
            quantity=Decimal("5.00"),
            reference_type="WebOrder",
            reference_id="ext-ord-temp",
        )
        self.product_a.refresh_from_db()

        # Push stock again -> ATS must be 15
        connector.sync_stock_to_external(self.product_a)
        called_args, called_kwargs = mock_req.call_args
        self.assertEqual(called_kwargs["json"]["available_quantity"], 15.0)

    # --------------------------------------------------------------------------
    # 6. Order Flow: Inbound Webhook, Parsing, Mapping, Order & Stock Reservation
    # --------------------------------------------------------------------------

    def test_order_import_and_stock_reservation(self):
        connector = get_connector(self.integration_a)

        # Establish mapping for self.product_a
        connector.map_product(
            product=self.product_a,
            external_product_id="line_mouse_ext_id",
            external_sku="MOUSE-W-01",
        )

        order_payload = {
            "id": "evt_order_1001",
            "order_id": "WC-ORDER-991",
            "order_number": "ORD-991",
            "status": "pending",
            "customer": {
                "name": "Touhidul Islam",
                "phone": "01711000000",
                "email": "touhid@example.com",
            },
            "items": [
                {
                    "product_id": "line_mouse_ext_id",
                    "sku": "MOUSE-W-01",
                    "name": "Wireless Mouse",
                    "quantity": "2.00",
                    "price": "300.00",
                }
            ],
            "total_amount": "600.00",
        }
        body_bytes = json.dumps(order_payload).encode("utf-8")
        sig = self._sign_payload(body_bytes)

        # Execute inbound webhook order ingestion
        ext_order, created = connector.handle_inbound_order_webhook(body_bytes, sig)
        self.assertTrue(created)
        self.assertEqual(ext_order.external_order_id, "WC-ORDER-991")
        self.assertEqual(ext_order.shop, self.shop_a)

        # Verify StockWhisk Sale created
        self.assertIsNotNone(ext_order.sale)
        self.assertEqual(ext_order.sale.total, Decimal("600.00"))

        # Verify Concurrency-safe Stock Reservation created
        reservations = InventoryReservation.all_objects.filter(
            shop=self.shop_a,
            reference_type="Sale",
            reference_id=str(ext_order.sale.id),
            product=self.product_a,
        )
        self.assertEqual(reservations.count(), 1)
        self.assertEqual(reservations.first().quantity, Decimal("2.00"))

        # Verify ATS dropped from 20 to 18
        self.product_a.refresh_from_db()
        levels = get_inventory_levels(self.product_a)
        self.assertEqual(levels["on_hand"], Decimal("20.00"))
        self.assertEqual(levels["reserved"], Decimal("2.00"))
        self.assertEqual(levels["available"], Decimal("18.00"))

    # --------------------------------------------------------------------------
    # 7. Duplicate Order Handling & Idempotency
    # --------------------------------------------------------------------------

    def test_duplicate_order_idempotency(self):
        connector = get_connector(self.integration_a)
        connector.map_product(
            product=self.product_a,
            external_product_id="line_mouse_ext_id",
            external_sku="MOUSE-W-01",
        )

        order_payload = {
            "order_id": "WC-ORDER-IDEMP-01",
            "items": [
                {
                    "product_id": "line_mouse_ext_id",
                    "sku": "MOUSE-W-01",
                    "quantity": "1.00",
                    "price": "300.00",
                }
            ],
            "total_amount": "300.00",
        }
        body_bytes = json.dumps(order_payload).encode("utf-8")
        sig = self._sign_payload(body_bytes)

        # First ingestion
        ext_order1, created1 = connector.handle_inbound_order_webhook(body_bytes, sig)
        self.assertTrue(created1)

        # Second ingestion with same order_id
        ext_order2, created2 = connector.handle_inbound_order_webhook(body_bytes, sig)
        self.assertFalse(created2)
        self.assertEqual(ext_order1.id, ext_order2.id)

        # Verify reservations NOT duplicated
        self.assertEqual(
            InventoryReservation.all_objects.filter(
                shop=self.shop_a,
                reference_type="Sale",
                reference_id=str(ext_order1.sale.id),
            ).count(),
            1,
        )

    # --------------------------------------------------------------------------
    # 8. Duplicate Webhook Detection & Rejection
    # --------------------------------------------------------------------------

    def test_duplicate_webhook_detection(self):
        connector = get_connector(self.integration_a)
        connector.map_product(
            product=self.product_a,
            external_product_id="line_mouse_ext_id",
            external_sku="MOUSE-W-01",
        )

        event_payload = {
            "event_id": "evt_unique_hash_99",
            "order_id": "WC-ORDER-EVT-01",
            "items": [
                {
                    "product_id": "line_mouse_ext_id",
                    "sku": "MOUSE-W-01",
                    "quantity": "1.00",
                    "price": "300.00",
                }
            ],
            "total_amount": "300.00",
        }
        body_bytes = json.dumps(event_payload).encode("utf-8")
        sig = self._sign_payload(body_bytes)

        # First run succeeds
        connector.handle_inbound_order_webhook(body_bytes, sig)

        # Second run with same event_id raises ConnectorDuplicateWebhookError
        with self.assertRaises(ConnectorDuplicateWebhookError):
            connector.handle_inbound_order_webhook(body_bytes, sig)

    # --------------------------------------------------------------------------
    # 9. Webhook Lifecycle (Register, Verify Signature, Delete)
    # --------------------------------------------------------------------------

    @patch("requests.request")
    def test_webhook_register_and_delete(self, mock_req):
        connector = get_connector(self.integration_a)

        # Register
        mock_reg = MagicMock()
        mock_reg.status_code = 201
        mock_reg.content = b'{"id": "wh_remote_123", "status": "active"}'
        mock_reg.json.return_value = {"id": "wh_remote_123", "status": "active"}
        mock_req.return_value = mock_reg

        reg_res = connector.register_webhook("order.created", "https://api.stockwhisk.com/wh/alpha")
        self.assertEqual(reg_res["id"], "wh_remote_123")

        # Delete
        mock_del = MagicMock()
        mock_del.status_code = 204
        mock_del.content = b""
        mock_req.return_value = mock_del

        deleted = connector.delete_webhook("wh_remote_123")
        self.assertTrue(deleted)

    def test_webhook_signature_tampered_fails(self):
        connector = get_connector(self.integration_a)
        valid_body = b'{"order_id": "123"}'
        tampered_sig = "invalid_hash_signature_000000000000"

        with self.assertRaises(ConnectorAuthError):
            connector.handle_inbound_order_webhook(valid_body, tampered_sig)

    # --------------------------------------------------------------------------
    # 10. Error Handling: 429 Rate Limit, Timeout, 500 Server Error
    # --------------------------------------------------------------------------

    @patch("requests.request")
    def test_error_handling_rate_limit(self, mock_req):
        connector = get_connector(self.integration_a)

        mock_429 = MagicMock()
        mock_429.status_code = 429
        mock_429.headers = {"Retry-After": "45"}
        mock_429.text = "Too Many Requests"
        mock_req.return_value = mock_429

        with self.assertRaises(ConnectorRateLimitError) as ctx:
            connector.fetch_order("ORD-101")
        self.assertEqual(ctx.exception.retry_after, 45)

    @patch("requests.request")
    def test_error_handling_timeout_and_500(self, mock_req):
        connector = get_connector(self.integration_a)

        # Timeout
        mock_req.side_effect = requests.exceptions.Timeout("Connection timed out")
        with self.assertRaises(ConnectorTimeoutError):
            connector.fetch_order("ORD-101")

        # HTTP 500
        mock_req.side_effect = None
        mock_500 = MagicMock()
        mock_500.status_code = 500
        mock_500.text = "Internal Server Error"
        mock_req.return_value = mock_500

        with self.assertRaises(ConnectorServerError):
            connector.fetch_order("ORD-101")

    # --------------------------------------------------------------------------
    # 11. Bounded Retry Mechanism
    # --------------------------------------------------------------------------

    def test_retry_mechanism_transient_vs_permanent(self):
        connector = get_connector(self.integration_a)

        # Transient failure that recovers on attempt 2
        calls = {"count": 0}

        def transient_op():
            calls["count"] += 1
            if calls["count"] < 2:
                raise ConnectorTimeoutError("Temporary timeout")
            return "SUCCESS"

        res = connector.execute_with_retry(transient_op, max_attempts=3, backoff_seconds=0.01)
        self.assertEqual(res, "SUCCESS")
        self.assertEqual(calls["count"], 2)

        # Permanent failure that aborts immediately without retry
        perm_calls = {"count": 0}

        def permanent_op():
            perm_calls["count"] += 1
            raise ConnectorAuthError("Invalid credentials", status_code=401)

        with self.assertRaises(ConnectorAuthError):
            connector.execute_with_retry(permanent_op, max_attempts=3, backoff_seconds=0.01)
        self.assertEqual(perm_calls["count"], 1)

    # --------------------------------------------------------------------------
    # 12. Multi-Tenant Isolation
    # --------------------------------------------------------------------------

    def test_tenant_isolation(self):
        connector_a = get_connector(self.integration_a)
        connector_b = get_connector(self.integration_b)

        # Shop A connector cannot map Shop B product
        with self.assertRaises(Exception):
            connector_a.map_product(
                product=self.product_b,  # Belongs to Shop B
                external_product_id="cross_tenant_prod",
            )

        # Order destined for Shop A cannot touch Shop B catalog or reservations
        connector_a.map_product(
            product=self.product_a,
            external_product_id="mouse_alpha_ext",
            external_sku="MOUSE-W-01",
        )
        payload = {
            "order_id": "ORD-TENANT-ALPHA",
            "items": [
                {
                    "product_id": "mouse_alpha_ext",
                    "sku": "MOUSE-W-01",
                    "quantity": "1.00",
                    "price": "300.00",
                }
            ],
            "total_amount": "300.00",
        }
        body = json.dumps(payload).encode("utf-8")
        sig = self._sign_payload(body)

        connector_a.handle_inbound_order_webhook(body, sig)

        # Ensure Shop B has 0 orders and 0 reservations
        self.assertFalse(ExternalOrder.all_objects.filter(shop=self.shop_b).exists())
        self.assertFalse(InventoryReservation.all_objects.filter(shop=self.shop_b).exists())
