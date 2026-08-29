# Functional Test Scenarios

This document outlines detailed functional test scenarios for the StockWhisk SaaS project.

## POS & Checkout (FT-POS-xxx)

| Test ID | Test Name | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| FT-POS-001 | Barcode scan adds product | Product with barcode exists in inventory | 1. Open POS<br>2. Scan barcode | Product is added to cart with qty 1 | P1 |
| FT-POS-002 | Serial unit selection | Serialized product is added to cart | 1. Add serialized product<br>2. Open serial selector<br>3. Select a specific unit | Selected serial number is attached to the line item | P1 |
| FT-POS-003 | Zero-stock blocked | Tracked product has 0 stock | 1. Attempt to add product via scan or search | System displays error; product not added to cart | P1 |
| FT-POS-004 | Cart quantity adjustment | Product is in cart | 1. Click '+' to increase qty<br>2. Click '-' to decrease qty | Quantity updates correctly; price recalculates | P1 |
| FT-POS-005 | Multi-payment checkout | Cart has items total $100 | 1. Proceed to checkout<br>2. Enter $50 Cash and $50 Card<br>3. Complete sale | Invoice is created; payments are split correctly | P1 |
| FT-POS-006 | Quotation mode | Cart has items | 1. Select 'Save as Quotation'<br>2. Complete | Quotation is saved; stock is NOT deducted | P2 |
| FT-POS-007 | EMI checkout | Customer selected, cart has items | 1. Select EMI checkout<br>2. Enter down payment and months<br>3. Complete | Invoice created; EMI schedule generated | P1 |
| FT-POS-008 | Walk-in customer checkout | No customer selected | 1. Add items<br>2. Checkout | Sale attributed to 'Walk-in Customer' | P1 |
| FT-POS-009 | Existing customer selection | Customer exists in DB | 1. Search customer by name/phone<br>2. Select customer | Customer linked to current cart | P1 |
| FT-POS-010 | Discount application | Cart has items | 1. Apply 10% discount<br>2. Verify total | Total reflects discount correctly | P2 |
| FT-POS-011 | Delivery charge | Cart has items | 1. Add $10 delivery charge | Total increases by $10 | P2 |
| FT-POS-012 | VAT calculation | Product has 5% VAT | 1. Add product to cart | VAT is calculated and displayed on total | P1 |

## Products (FT-PRD-xxx)

| Test ID | Test Name | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| FT-PRD-001 | Create tracked product | Logged in as Admin | 1. Go to Products -> Add<br>2. Fill details, enable tracking<br>3. Save | Product created; initial stock prompt appears | P1 |
| FT-PRD-002 | Create service item | Logged in as Admin | 1. Add Product<br>2. Disable tracking, mark as Service<br>3. Save | Product created; no stock management applies | P1 |
| FT-PRD-003 | Edit product details | Product exists | 1. Edit product price<br>2. Save | New price reflects in POS | P2 |
| FT-PRD-004 | Toggle track_inventory | Product has 0 stock | 1. Edit product<br>2. Toggle tracking off | Tracking disabled; POS allows selling unlimited | P2 |
| FT-PRD-005 | Low stock badge | Product stock < alert level | 1. View product list | Low stock badge is clearly visible | P3 |
| FT-PRD-006 | Generate barcode | Product exists without barcode | 1. Select product<br>2. Click 'Generate Barcode' | Unique system barcode is generated and saved | P2 |
| FT-PRD-007 | Serial unit lifecycle | Serialized product exists | 1. Receive serial X<br>2. Sell serial X<br>3. Return serial X | Status: In Stock -> Sold -> Returned/In Stock | P1 |

## Inventory (FT-INV-xxx)

| Test ID | Test Name | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| FT-INV-001 | Stock increases on PO receive | Approved PO exists | 1. Receive 10 units<br>2. Check inventory | Stock increased by 10 | P1 |
| FT-INV-002 | Stock decreases on sale | Product has 10 stock | 1. Sell 2 units via POS | Stock decreased to 8 | P1 |
| FT-INV-003 | Stock returns on sale return | Sold invoice exists | 1. Process return for 1 unit | Stock increased by 1 | P1 |
| FT-INV-004 | Stock adjustment (Loss) | Product has 5 stock | 1. Create adjustment: -1 unit (Damage)<br>2. Save | Stock becomes 4; reason logged | P2 |
| FT-INV-005 | Movement history accuracy | Multiple transactions | 1. View product ledger | Chronological list of IN/OUT matches current stock | P1 |

## Sales & Invoices (FT-SAL-xxx)

| Test ID | Test Name | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| FT-SAL-001 | Invoice listing | Sales exist | 1. Go to Sales module | All invoices listed descending by date | P1 |
| FT-SAL-002 | Search by invoice# | Invoice INV-123 exists | 1. Enter INV-123 in search | Only INV-123 is displayed | P2 |
| FT-SAL-003 | PDF generation | Invoice exists | 1. Click Print/PDF icon | Proper A4/Thermal PDF is generated | P1 |
| FT-SAL-004 | Add payment to partial invoice | Invoice has $50 due | 1. Open invoice<br>2. Add $20 payment | Due reduces to $30; Payment logged | P1 |
| FT-SAL-005 | Invoice correction | Invoice created today | 1. Edit invoice notes<br>2. Save | Notes updated; financials unchanged | P3 |
| FT-SAL-006 | WhatsApp sharing | Invoice exists, customer has phone | 1. Click Share -> WhatsApp | Opens WA with pre-filled message and link | P2 |

## Returns (FT-RET-xxx)

| Test ID | Test Name | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| FT-RET-001 | Full return with cash refund | Paid invoice exists | 1. Initiate full return<br>2. Select cash refund | Stock restored; Cash account reduced; Invoice marked Returned | P1 |
| FT-RET-002 | Partial return | Invoice has 2 items | 1. Return 1 item | Invoice updated; partial stock restored | P1 |
| FT-RET-003 | Exchange/Replacement | Serialized item sold | 1. Return Serial A<br>2. Issue Serial B | Stock swapped; financial diff is 0 | P2 |
| FT-RET-004 | Refund to correct account | Invoice paid via Card | 1. Return sale<br>2. Refund via Bank Transfer | Bank ledger reduced; Cash unchanged | P2 |
| FT-RET-005 | Serialized unit status revert | Serial X sold | 1. Return Serial X | Serial X status = Available | P1 |

## Customers & Dues (FT-CRM-xxx)

| Test ID | Test Name | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| FT-CRM-001 | Customer creation | Logged in | 1. Add customer (Name, Phone)<br>2. Save | Customer created and searchable | P1 |
| FT-CRM-002 | Due balance accuracy | Customer has multiple credit sales | 1. Check customer profile | Total due matches sum of unpaid invoices | P1 |
| FT-CRM-003 | Due collection updates balance | Customer owes $100 | 1. Collect $50 via Receive Payment | Due becomes $50; Cash increases | P1 |
| FT-CRM-004 | Due collection not counted as new sale | Collect due payment | 1. Check Daily Sales Report | Sale total unchanged; Collection total increased | P1 |
| FT-CRM-005 | Customer payment history | Payments recorded | 1. View customer ledger | All invoices and receipts listed chronologically | P2 |

## EMI (FT-EMI-xxx)

| Test ID | Test Name | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| FT-EMI-001 | EMI schedule creation | EMI sale completed | 1. View EMI details | Dates and amounts correctly distributed over X months | P1 |
| FT-EMI-002 | Installment payment | Installment is pending | 1. Pay specific installment | Installment marked Paid; Next due date updated | P1 |
| FT-EMI-003 | Overdue tracking | Installment date passed | 1. Check EMI dashboard | Installment highlighted in red as Overdue | P2 |

## Accounting (FT-ACC-xxx)

| Test ID | Test Name | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| FT-ACC-001 | Expense entry | Cash available | 1. Add $50 expense (e.g., Utility) | Cash reduced by $50; Expense account increased | P1 |
| FT-ACC-002 | Capital investment | Owner invests money | 1. Record $1000 Capital | Cash increases; Equity increases | P2 |
| FT-ACC-003 | Drawing | Owner withdraws money | 1. Record $100 Drawing | Cash decreases; Equity decreases; Not an expense | P2 |
| FT-ACC-004 | Account transfer | Multiple bank accounts | 1. Transfer $100 Cash to Bank | Cash -100; Bank +100; Total liquid unchanged | P1 |
| FT-ACC-005 | P&L report accuracy | Sales and Expenses exist | 1. Generate P&L | Gross Profit and Net Profit calculated correctly | P1 |

## Service & Warranty (FT-SVC-xxx)

| Test ID | Test Name | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| FT-SVC-001 | Warranty verification | Serial number sold 1 month ago | 1. Enter serial in Service module | System shows Warranty Active (if 1 year warranty) | P1 |
| FT-SVC-002 | Service ticket creation | Customer reports issue | 1. Create ticket, assign technician | Ticket created in 'Open' state | P1 |
| FT-SVC-003 | Status transitions | Ticket is Open | 1. Change to In Progress<br>2. Change to Resolved | Status updates correctly; timestamps logged | P2 |
| FT-SVC-004 | Part addition | Ticket requires part replacement | 1. Add Part X to ticket | Part X stock deducted | P1 |
| FT-SVC-005 | Customer billing | Ticket resolved (Out of warranty) | 1. Generate bill from ticket | Invoice created for parts + service charge | P2 |

## Purchasing (FT-PUR-xxx)

| Test ID | Test Name | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| FT-PUR-001 | PO creation | Supplier exists | 1. Create PO for items<br>2. Save | PO generated in 'Pending' state | P1 |
| FT-PUR-002 | PO receive | Pending PO exists | 1. Receive all items | Stock increases; PO state = 'Received' | P1 |
| FT-PUR-003 | Credit purchase | Receive PO without payment | 1. Complete receive | Supplier payable increases by PO amount | P1 |
| FT-PUR-004 | Supplier payment | Supplier payable exists | 1. Pay supplier $100 | Payable reduces by $100; Cash reduces | P1 |
