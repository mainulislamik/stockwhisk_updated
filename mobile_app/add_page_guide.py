import os
import re

mapping = {
    'POSScreen.tsx': '/app/pos',
    'ProductsScreen.tsx': '/app/products',
    'AccountingScreen.tsx': '/app/accounting',
    'SalesScreen.tsx': '/app/sales',
    'InventoryScreen.tsx': '/app/inventory',
    'BarcodesScreen.tsx': '/app/barcodes',
    'CustomersScreen.tsx': '/app/customers',
    'DuesScreen.tsx': '/app/dues',
    'EMIScreen.tsx': '/app/emi',
    'ExpensesScreen.tsx': '/app/expenses',
    'PurchasesScreen.tsx': '/app/products/purchase',
    'ReportsScreen.tsx': '/app/reports',
    'ServiceTicketsScreen.tsx': '/app/service/tickets',
    'SettlementScreen.tsx': '/app/accounting/settlement',
    'SuppliersScreen.tsx': '/app/suppliers',
    'SettingsScreen.tsx': '/app/settings'
}

for filename, page_key in mapping.items():
    filepath = os.path.join('src/screens', filename)
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 'PageGuideButton' in content:
        continue
        
    # Add import
    import_match = re.search(r"import .* from 'react-native-paper';", content)
    if import_match:
        content = content[:import_match.end()] + "\nimport PageGuideButton from '../components/PageGuideButton';" + content[import_match.end():]
    else:
        # Fallback to after first import
        content = re.sub(r"(import .*?;\n)", r"\1import PageGuideButton from '../components/PageGuideButton';\n", content, count=1)
        
    # Add button to Appbar.Header before Appbar.Content or just inside Appbar.Header
    # Find Appbar.Content and insert the button right before it
    content = re.sub(r'(<Appbar\.Content[^>]*/>)', f'<PageGuideButton pageKey="{page_key}" />\n        \\1', content)
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Done")
