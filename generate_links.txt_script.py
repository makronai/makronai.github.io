# generate_links.py
# Crawls the directory and outputs a plain list of URLs
# Run: python generate_links.py

import os

BASE_URL = "https://makron.app"
EXCLUDED_FILES = {
    "404", "page-top.html", "page-head.html","page-bottom.html", "header.html", 
    "template.html", "post_template.html", "coming-soon", ".git", "node_modules", 
    "private", "drafts", "assets"
}

urls = []

for root, dirs, files in os.walk("."):
    # Filter out system and private directories
    dirs[:] = [d for d in dirs if d not in EXCLUDED_FILES]
    
    for file in files:
        if file in EXCLUDED_FILES or file.startswith('.'):
            continue
            
        if file.endswith(".html"):
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, ".")
            
            # Clean URL logic
            clean_path = rel_path.replace("\\", "/")
            if clean_path == "index.html":
                url = f"{BASE_URL}/"
            elif clean_path.endswith("/index.html"):
                url = f"{BASE_URL}/{clean_path[:-10]}"
            else:
                url = f"{BASE_URL}/{clean_path}"
            
            urls.append(url)

# Sort and write to file
urls.sort()
with open("links.txt", "w", encoding="utf-8") as f:
    for url in urls:
        f.write(f"{url}\n")

print(f"✅ Created urls.txt with {len(urls)} links!")