# Final QA Acceptance Criteria

## Release Readiness Checklist

### 1. Functional Acceptance
- [ ] All P1 functional test scenarios pass
- [ ] All P2 functional test scenarios pass (95%+ pass rate)
- [ ] POS checkout flow works end-to-end (scan → payment → invoice print)
- [ ] Financial calculations are accurate (cash flow, P&L, settlement)
- [ ] EMI calculations match specification
- [ ] Returns/refunds correctly update stock and cash
- [ ] Due collection correctly updates customer balance without duplicating revenue
- [ ] Multi-tenant isolation verified (Shop A cannot see Shop B data)
- [ ] All user roles have correct access permissions
- [ ] Bangla and English translations work correctly on all pages

### 2. Security Acceptance
- [ ] All security test scenarios pass
- [ ] No cross-tenant data leakage
- [ ] JWT authentication working correctly
- [ ] Rate limiting enforced
- [ ] Demo mode properly restricts write operations
- [ ] Input validation prevents injection attacks

### 3. Performance Acceptance
- [ ] POS barcode scan responds within 200ms
- [ ] Dashboard loads within 3 seconds
- [ ] Checkout completes within 2 seconds
- [ ] System handles 50+ concurrent POS sessions
- [ ] No N+1 query issues in critical paths

### 4. UI/UX Acceptance
- [ ] Responsive design works on mobile, tablet, desktop
- [ ] Dark mode and light mode both render correctly
- [ ] All popover/modal components display properly
- [ ] Print layouts (thermal 80mm and A4) format correctly
- [ ] Navigation and sidebar work correctly

### 5. Data Integrity Acceptance
- [ ] Product stock matches StockMovement ledger sum
- [ ] Customer due balance matches unpaid invoice totals
- [ ] Cash balance matches LedgerEntry calculations
- [ ] Supplier payable matches unpaid PO totals
- [ ] Settlement expected cash matches ledger-derived value

### 6. Deployment Acceptance
- [ ] Docker build succeeds without errors
- [ ] Database migrations run cleanly
- [ ] Static assets build and serve correctly
- [ ] Caddy SSL certificates valid
- [ ] Celery worker and beat running
- [ ] Backup system functional

## Sign-Off

- **QA Lead Approval**: ________________________ Date: __________
- **Product Owner Approval**: ________________________ Date: __________
- **Technical Lead Approval**: ________________________ Date: __________
- **Deployment Date and Version**: ________________________
