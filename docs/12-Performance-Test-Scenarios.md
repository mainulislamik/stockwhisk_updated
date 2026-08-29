# Performance Test Scenarios

This document outlines detailed performance test scenarios and benchmarks for the StockWhisk SaaS project.

## Load Testing

| Test ID | Scenario | Target Metric | Notes |
|---|---|---|---|
| PT-LOAD-001 | 50 concurrent POS checkout transactions | < 2s response time | Simulates peak hour retail checkout volume across multiple tenants. |
| PT-LOAD-002 | 100 concurrent product searches | < 500ms response time | Focuses on database read replica and search indexing performance. |
| PT-LOAD-003 | Dashboard load with 10,000+ sales records | < 3s response time | Tests aggregation queries (SUM, COUNT) for daily/monthly metrics. |
| PT-LOAD-004 | Report generation with 1 year of data | < 5s response time | Tests heavy background processing or optimized materialized views. |
| PT-LOAD-005 | Barcode scan response | < 200ms response time | Critical for POS UX; requires minimal latency. |

## Stress Testing

| Test ID | Scenario | Expected Behavior under Stress |
|---|---|---|
| PT-STRESS-001 | 200 concurrent users on POS | Graceful degradation; no data corruption; latency increases but requests don't drop. |
| PT-STRESS-002 | Bulk product import (1000+ items) via CSV | Background task queue handles load; UI remains responsive; import completes within 1 minute. |
| PT-STRESS-003 | Database query spike | Connection pool handles requests without dropping; slow queries logged for review. |

## Scalability

| Test ID | Scenario | Architecture Focus |
|---|---|---|
| PT-SCALE-001 | System handles 100+ active shops | Multi-tenant routing efficiency; global cache hit rates. |
| PT-SCALE-002 | Single shop with 50,000+ products | Indexing on `tenant_id` + `product_id`; pagination efficiency. |
| PT-SCALE-003 | Single shop with 100,000+ invoices | Date-range query efficiency; storage cost optimization for PDF generation. |

## Response Time Benchmarks

The following targets must be maintained under standard load:

* **POS Barcode Scan:** < 200ms
* **Checkout Completion (Sale save):** < 2s
* **Dashboard Initial Load:** < 3s
* **Custom Report Generation:** < 5s
* **Product Search (Typeahead):** < 500ms
* **Invoice PDF Generation & Download:** < 3s

## Database Performance Requirements

* **Index Verification:** Ensure B-Tree indexes exist on all foreign keys and frequently searched columns (e.g., `barcode`, `phone`, `invoice_number`).
* **N+1 Query Prevention:** Utilize Django's `select_related` and `prefetch_related` on all listing APIs to strictly cap the query count per request (target < 5 queries per complex list).
* **Connection Pooling:** Verify PgBouncer (or similar) is configured correctly to prevent connection exhaustion during peak load.
