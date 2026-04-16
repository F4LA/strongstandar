import os
import re

FAVICON_TAG = '<link rel="icon" href="/favicon.svg" type="image/svg+xml">'

# Find all HTML files in the repo
html_files = []
for root, dirs, files in os.walk('.'):
    # Skip .git folder
    dirs[:] = [d for d in dirs if d != '.git']
    for file in files:
        if file.endswith('.html'):
            html_files.append(os.path.join(root, file))

updated = 0
skipped = 0

for path in html_files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if favicon already present
    if 'favicon.svg' in content:
        print(f"SKIP (already has favicon): {path}")
        skipped += 1
        continue

    # Replace existing favicon link if present
    if 'rel="icon"' in content:
        new_content = re.sub(r'<link[^>]*rel="icon"[^>]*>', FAVICON_TAG, content)
    # Otherwise inject before </head>
    elif '</head>' in content:
        new_content = content.replace('</head>', f'  {FAVICON_TAG}\n</head>', 1)
    else:
        print(f"SKIP (no </head> found): {path}")
        skipped += 1
        continue

    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"UPDATED: {path}")
    updated += 1

print(f"\nDone. Updated: {updated} | Skipped: {skipped}")
