# generate_sitemap.py
# Scans all .html files (ignores folders you list)
# Run: python generate_sitemap.py

import os
from datetime import datetime

BASE_URL = "https://makron.app"
# Added common template/system files to the ignore list
IGNORE_DIRS = {
    ".git", "node_modules", "files", "drafts", "assets", "app", "apps", 
    "page-top.html", "page-head.html","page-bottom.html", "template.html", "post_template.html",
    "coming-soon", "__pycache__", "autogen.py", "404", "404.html", "junk"
}

def get_lastmod(file_path):
    # W3C Datetime format (YYYY-MM-DDThh:mm:ssTZD) is preferred by modern crawlers
    timestamp = os.path.getmtime(file_path)
    return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%dT%H:%M:%S+00:00")

urls = []

for root, dirs, files in os.walk("."):
    # Skip ignored directories in-place
    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
    
    for file in files:
        if file in IGNORE_DIRS or file.startswith('.'):
            continue
            
        if file.endswith(".html"):
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, ".")
            
            # Clean up the URL path
            # 1. Convert Windows backslashes to forward slashes
            clean_path = rel_path.replace("\\", "/")
            
            # 2. Handle index.html and root pathing
            if clean_path == "index.html":
                url = f"{BASE_URL}/"
            elif clean_path.endswith("/index.html"):
                # Represent /path/to/index.html as /path/to/
                url = f"{BASE_URL}/{clean_path[:-10]}"
            else:
                url = f"{BASE_URL}/{clean_path}"

            lastmod = get_lastmod(file_path)
            urls.append((url, lastmod))

# Build XML with proper header and encoding
xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

# Sort by URL for a clean, professional file structure
for url, lastmod in sorted(urls):
    # Determine priority: homepage gets 1.0, others 0.8
    priority = "1.0" if url == f"{BASE_URL}/" else "0.8"
    
    xml += f"  <url>\n"
    xml += f"    <loc>{url}</loc>\n"
    xml += f"    <lastmod>{lastmod}</lastmod>\n"
    xml += f"    <changefreq>weekly</changefreq>\n"
    xml += f"    <priority>{priority}</priority>\n"
    xml += f"  </url>\n"

xml += "</urlset>"

with open("sitemap.xml", "w", encoding="utf-8") as f:
    f.write(xml)

print(f"✅ sitemap.xml created with {len(urls)} URLs!")