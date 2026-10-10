"""
Tests for Phase 5: Reliable Product Channel Mapping System.

Verifies:
1. Valid mapping (product, variation, external IDs, SKUs)
2. Duplicate mapping prevention
3. Missing SKU fallback and handling
4. Wrong tenant / Cross-tenant protection
5. Variation mapping (product variation linked correctly)
6. Unmapped product detection
7. Conflicting external ID detection (mapping already owned by another product)
8. Invalid integration (inactive integration mapping rejected)
9. Permission errors (cashier/unauthorized role blocked)
"""
import json
from decimal import Decimal
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import RoleType, User
from catalog.models import Category, Product, ProductVariation, Unit
from core.tenant_context import set_current_tenant
from integrations.mapping_services import (
    create_or_update_product_mapping,
    detect_conflicting_mappings,
    disconnect_product_mapping,
    get_unmapped_products,
    search_product_mapping,
    MappingConflictError,
    MappingValidationError,
)
from integrations.models import Integration, IntegrationCategory, IntegrationProvider, ProductChannelMapping
from integrations.services import create_integration
from tenants.models import Shop


class ProductChannelMappingTestCase(TestCase):
    def setUp(self):
        super().setUp()

        # Create Shops
        self.shop_a = Shop.objects.create(name="Shop Alpha", slug="shop-alpha", modules={"integrations": True})
        self.shop_b = Shop.objects.create(name="Shop Beta", slug="shop-beta", modules={"integrations": True})

        # Create Users
        self.owner_a = User.objects.create_user(
            email="owner_a@test.com",
            first_name="Owner",
            last_name="A",
            role=RoleType.OWNER,
            shop=self.shop_a,
            password="password123",
        )
        self.cashier_a = User.objects.create_user(
            email="cashier_a@test.com",
            first_name="Cashier",
            last_name="A",
            role=RoleType.CASHIER,
            shop=self.shop_a,
            password="password123",
        )
        self.owner_b = User.objects.create_user(
            email="owner_b@test.com",
            first_name="Owner",
            last_name="B",
            role=RoleType.OWNER,
            shop=self.shop_b,
            password="password123",
        )

        # Create Integrations
        self.integration_a = create_integration(
            shop=self.shop_a,
            name="WooCommerce Shop Alpha",
            category="ecommerce",
            provider="woocommerce",
            credentials={"api_key": "ck_test_123", "api_secret": "cs_test_123"},
        )
        self.integration_b = create_integration(
            shop=self.shop_b,
            name="Shopify Shop Beta",
            category="ecommerce",
            provider="shopify",
            credentials={"access_token": "shpat_test_123"},
        )

        # Create Catalog Items
        self.unit_a, _ = Unit.all_objects.get_or_create(
            shop=self.shop_a,
            name="Pcs",
            defaults={"short_code": "pcs", "measure_type": "count", "allow_decimal": False},
        )
        self.cat_a = Category.all_objects.create(shop=self.shop_a, name="Electronics")

        self.prod_a1 = Product.all_objects.create(
            shop=self.shop_a,
            name="Wireless Earbuds",
            sku="EARBUDS-BLK",
            barcode="88012345",
            unit=self.unit_a,
            category=self.cat_a,
            selling_price=Decimal("1500.00"),
            cost_price=Decimal("900.00"),
        )
        self.prod_a2 = Product.all_objects.create(
            shop=self.shop_a,
            name="Mechanical Keyboard",
            sku="KEYBOARD-RGB",
            unit=self.unit_a,
            category=self.cat_a,
            selling_price=Decimal("4500.00"),
            cost_price=Decimal("3000.00"),
        )
        self.prod_a3_no_sku = Product.all_objects.create(
            shop=self.shop_a,
            name="Mouse Pad",
            sku="",  # No SKU
            unit=self.unit_a,
            category=self.cat_a,
            selling_price=Decimal("300.00"),
            cost_price=Decimal("150.00"),
        )

        # Product Variation
        self.var_red = ProductVariation.all_objects.create(
            shop=self.shop_a,
            product=self.prod_a2,
            name="Red Switches",
            sku="KEYBOARD-RGB-RED",
            selling_price=Decimal("4600.00"),
        )
        self.var_blue = ProductVariation.all_objects.create(
            shop=self.shop_a,
            product=self.prod_a2,
            name="Blue Switches",
            sku="KEYBOARD-RGB-BLUE",
            selling_price=Decimal("4500.00"),
        )

        # Shop B Product
        self.unit_b, _ = Unit.all_objects.get_or_create(
            shop=self.shop_b,
            name="Box",
            defaults={"short_code": "box", "measure_type": "count", "allow_decimal": False},
        )
        self.prod_b = Product.all_objects.create(
            shop=self.shop_b,
            name="Shop B Item",
            sku="SHOP-B-ITEM",
            unit=self.unit_b,
            selling_price=Decimal("100.00"),
        )

        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.owner_a)

        self.client_cashier = APIClient()
        self.client_cashier.force_authenticate(user=self.cashier_a)

        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.owner_b)

    def test_valid_product_mapping_lifecycle(self):
        """Creates a valid ProductChannelMapping and verifies search & lookup."""
        mapping, created = create_or_update_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.prod_a1,
            external_product_id="84920",
            external_sku="WC-EARBUDS-BLK",
        )
        self.assertTrue(created)
        self.assertEqual(mapping.internal_sku, "EARBUDS-BLK")
        self.assertEqual(mapping.external_product_id, "84920")
        self.assertEqual(mapping.external_sku, "WC-EARBUDS-BLK")
        self.assertEqual(mapping.sync_status, ProductChannelMapping.SyncStatus.ACTIVE)

        # Lookup by External ID
        found = search_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            external_product_id="84920",
        )
        self.assertIsNotNone(found)
        self.assertEqual(found.id, mapping.id)

        # Lookup by External SKU
        found_sku = search_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            sku="WC-EARBUDS-BLK",
        )
        self.assertIsNotNone(found_sku)
        self.assertEqual(found_sku.id, mapping.id)

        # Lookup by Internal SKU
        found_int_sku = search_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            sku="EARBUDS-BLK",
        )
        self.assertIsNotNone(found_int_sku)
        self.assertEqual(found_int_sku.id, mapping.id)

    def test_variation_mapping(self):
        """Verifies mapping a specific variation of a product with external variation ID."""
        mapping, created = create_or_update_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.prod_a2,
            variation=self.var_red,
            external_product_id="99001",
            external_variation_id="99002",
            external_sku="WC-KB-RED",
        )
        self.assertTrue(created)
        self.assertEqual(mapping.variation_id, self.var_red.id)
        self.assertEqual(mapping.internal_sku, "KEYBOARD-RGB-RED")
        self.assertEqual(mapping.external_variation_id, "99002")

        # Search matching external_product_id + external_variation_id
        matched = search_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            external_product_id="99001",
            external_variation_id="99002",
        )
        self.assertIsNotNone(matched)
        self.assertEqual(matched.variation_id, self.var_red.id)

    def test_missing_sku_allowed_with_external_product_id(self):
        """Product without an internal SKU can still map using stable external product ID."""
        # Force empty SKU in database
        Product.all_objects.filter(id=self.prod_a3_no_sku.id).update(sku="")
        self.prod_a3_no_sku.refresh_from_db()

        mapping, created = create_or_update_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.prod_a3_no_sku,
            external_product_id="55443",
            external_sku="",
        )
        self.assertTrue(created)
        self.assertEqual(mapping.internal_sku, "")
        self.assertEqual(mapping.external_product_id, "55443")

        # Can still be found via external product ID
        found = search_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            external_product_id="55443",
        )
        self.assertIsNotNone(found)
        self.assertEqual(found.id, mapping.id)

    def test_conflicting_external_id_rejected(self):
        """Assigning an already mapped external product ID to a different product raises MappingConflictError."""
        create_or_update_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.prod_a1,
            external_product_id="84920",
        )

        with self.assertRaises(MappingConflictError):
            create_or_update_product_mapping(
                shop=self.shop_a,
                integration=self.integration_a,
                product=self.prod_a2,  # Different product trying to use same external ID
                external_product_id="84920",
            )

    def test_conflicting_internal_product_rejected(self):
        """Mapping the same internal product to two different external IDs in one channel is rejected."""
        create_or_update_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.prod_a1,
            external_product_id="84920",
        )

        with self.assertRaises(MappingConflictError):
            create_or_update_product_mapping(
                shop=self.shop_a,
                integration=self.integration_a,
                product=self.prod_a1,
                external_product_id="84921",  # Different external ID for same product
            )

    def test_wrong_tenant_protection(self):
        """Tenant B product or integration cannot be mapped into Tenant A channel."""
        from rest_framework.exceptions import PermissionDenied

        # Try to map Tenant B's product to Tenant A's integration
        with self.assertRaises(PermissionDenied):
            create_or_update_product_mapping(
                shop=self.shop_a,
                integration=self.integration_a,
                product=self.prod_b,
                external_product_id="77777",
            )

        # Try to use Tenant B's integration under Shop A
        with self.assertRaises(PermissionDenied):
            create_or_update_product_mapping(
                shop=self.shop_a,
                integration=self.integration_b,
                product=self.prod_a1,
                external_product_id="77777",
            )

    def test_invalid_integration_inactive(self):
        """Mapping creation fails if the integration channel is inactive."""
        self.integration_a.is_active = False
        self.integration_a.save()

        with self.assertRaises(MappingValidationError):
            create_or_update_product_mapping(
                shop=self.shop_a,
                integration=self.integration_a,
                product=self.prod_a1,
                external_product_id="11111",
            )

    def test_disconnect_and_delete_mapping(self):
        """Verifies soft disconnect and hard deletion operations."""
        mapping, _ = create_or_update_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.prod_a1,
            external_product_id="84920",
        )

        # Soft disconnect
        disc = disconnect_product_mapping(shop=self.shop_a, mapping_id=mapping.id, soft=True)
        self.assertEqual(disc.sync_status, ProductChannelMapping.SyncStatus.DISCONNECTED)
        self.assertFalse(disc.is_sync_enabled)

        # Hard delete
        disconnect_product_mapping(shop=self.shop_a, mapping_id=mapping.id, soft=False)
        self.assertFalse(ProductChannelMapping.all_objects.filter(id=mapping.id).exists())

    def test_detect_unmapped_products(self):
        """Detects products in the shop that have not yet been mapped to this channel."""
        # prod_a1 is mapped, prod_a2 and prod_a3 are not
        create_or_update_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.prod_a1,
            external_product_id="84920",
        )

        unmapped = get_unmapped_products(shop=self.shop_a, integration=self.integration_a)
        unmapped_ids = [item["id"] for item in unmapped]
        self.assertNotIn(self.prod_a1.id, unmapped_ids)
        self.assertIn(self.prod_a2.id, unmapped_ids)
        self.assertIn(self.prod_a3_no_sku.id, unmapped_ids)

    def test_detect_conflicting_mappings(self):
        """Detects conflicting duplicate external SKUs across mappings."""
        m1, _ = create_or_update_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.prod_a1,
            external_product_id="101",
            external_sku="COLLIDING-SKU",
        )
        m2, _ = create_or_update_product_mapping(
            shop=self.shop_a,
            integration=self.integration_a,
            product=self.prod_a2,
            external_product_id="102",
            external_sku="COLLIDING-SKU",
        )

        conflicts = detect_conflicting_mappings(shop=self.shop_a, integration=self.integration_a)
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]["sku"], "COLLIDING-SKU")

    def test_api_permission_failures(self):
        """Cashier role cannot create or disconnect mappings; cross-tenant access blocked."""
        # 1. Cashier attempts to create mapping -> 403 Forbidden
        url = "/api/integrations/mappings/"
        payload = {
            "integration": self.integration_a.id,
            "product": self.prod_a1.id,
            "external_product_id": "9999",
        }
        res_cashier = self.client_cashier.post(url, data=payload, format="json")
        self.assertEqual(res_cashier.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Owner A creates mapping -> 201 Created
        res_owner = self.client_a.post(url, data=payload, format="json")
        self.assertEqual(res_owner.status_code, status.HTTP_201_CREATED)
        mapping_id = res_owner.data["id"]

        # 3. Owner B attempts to view or update Owner A's mapping -> 404 Not Found
        res_b = self.client_b.get(f"/api/integrations/mappings/{mapping_id}/")
        self.assertEqual(res_b.status_code, status.HTTP_404_NOT_FOUND)

        res_b_disc = self.client_b.post(f"/api/integrations/mappings/{mapping_id}/disconnect/")
        self.assertEqual(res_b_disc.status_code, status.HTTP_404_NOT_FOUND)
