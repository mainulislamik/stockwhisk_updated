# Bug Report Template

## Bug Report Template Fields
- **Bug ID**: AUTO (e.g., BUG-2024-0001)
- **Title**: Clear, concise summary
- **Reporter**: Name & role
- **Date Reported**: YYYY-MM-DD
- **Environment**: Production / Staging / Local Dev
- **Browser/Device**: Chrome 120, Windows 11 / Safari, iPhone 15
- **Module**: POS / Products / Sales / Accounting / etc.
- **Severity**: Critical / Major / Minor / Cosmetic
- **Priority**: P1 (Blocker) / P2 (High) / P3 (Medium) / P4 (Low)
- **Status**: New / Assigned / In Progress / Fixed / Verified / Closed / Reopened

## Description Section
- **Summary**: One-line description
- **Steps to Reproduce**: Numbered step-by-step
- **Expected Result**: What should happen
- **Actual Result**: What actually happened
- **Screenshots/Videos**: Attachments (links or inline)
- **Console Errors**: Browser dev tools output
- **API Response**: If applicable, include status code and response body

## Classification

### Severity Definitions
- **Critical**: System crash, data loss, security breach, financial calculation error.
- **Major**: Feature completely broken, wrong calculations, data corruption.
- **Minor**: Feature partially broken, UI inconsistency, workaround available.
- **Cosmetic**: Visual/text issues, typos, alignment.

### Priority Definitions
- **P1 (Blocker)**: Must fix immediately (blocks business operations).
- **P2 (High)**: Fix in current sprint.
- **P3 (Medium)**: Fix in next sprint.
- **P4 (Low)**: Fix when convenient.

---

## Example Bug Reports

### Example 1: Critical Financial Error
- **Bug ID**: BUG-2024-0042
- **Title**: POS calculates incorrect tax when discount is applied
- **Reporter**: QA Lead
- **Date Reported**: 2024-10-15
- **Environment**: Staging
- **Browser/Device**: Chrome 120, Windows 11
- **Module**: POS
- **Severity**: Critical
- **Priority**: P1
- **Status**: New
- **Summary**: The tax amount is calculated on the pre-discount total instead of the post-discount total, leading to overcharging.
- **Steps to Reproduce**:
  1. Add item A ($100) to POS cart.
  2. Apply a 10% discount.
  3. Observe the calculated 10% tax.
- **Expected Result**: Tax should be $9 (10% of $90).
- **Actual Result**: Tax is $10 (10% of $100).
- **Screenshots**: [Link]
- **API Response**: `POST /api/pos/calculate` returned incorrect `tax_amount`.

### Example 2: Major Feature Failure
- **Bug ID**: BUG-2024-0043
- **Title**: Cannot upload product images in Product Creation
- **Reporter**: Content Manager
- **Date Reported**: 2024-10-16
- **Environment**: Production
- **Browser/Device**: Safari 17, macOS
- **Module**: Products
- **Severity**: Major
- **Priority**: P2
- **Status**: Assigned
- **Summary**: Uploading a PNG image throws a 500 error.
- **Steps to Reproduce**:
  1. Navigate to Products -> Add Product.
  2. Fill required fields.
  3. Select a valid PNG image under 2MB.
  4. Click Save.
- **Expected Result**: Product saves with image successfully.
- **Actual Result**: Server error 500 displayed on UI.
- **Console Errors**: `Failed to load resource: the server responded with a status of 500`
- **API Response**: `{"error": "Unsupported Media Type"}`

### Example 3: Cosmetic Issue
- **Bug ID**: BUG-2024-0044
- **Title**: Typo in "Settlement" button on Dashboard
- **Reporter**: UI/UX Designer
- **Date Reported**: 2024-10-17
- **Environment**: Local Dev
- **Browser/Device**: Firefox 115, Windows 10
- **Module**: Dashboard
- **Severity**: Cosmetic
- **Priority**: P4
- **Status**: New
- **Summary**: The button says "Setlement" instead of "Settlement".
- **Steps to Reproduce**:
  1. Login to admin dashboard.
  2. Look at the top right quick action bar.
- **Expected Result**: Button reads "Settlement".
- **Actual Result**: Button reads "Setlement".
