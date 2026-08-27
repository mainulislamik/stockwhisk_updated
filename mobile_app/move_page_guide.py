import os
import re
import glob

# Find all screens
for filepath in glob.glob('src/screens/*.tsx'):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # We want to find:
    # <PageGuideButton pageKey="..." />
    # (optional whitespace)
    # <Appbar.Content ... />
    
    # And swap them.
    pattern = re.compile(r'(<PageGuideButton\s+pageKey="[^"]*"\s*/>)(\s*)(<Appbar\.Content[^>]*/>)')
    new_content = pattern.sub(r'\3\2\1', content)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

print("Done")
