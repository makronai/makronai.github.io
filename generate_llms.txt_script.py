# generate_llms.py
# Creates an AEO-optimized llms.txt following best practices
# Run: python generate_llms.py

import os
import re
import html

BASE_URL = "https://makron.app"
SITE_NAME = "Makron"
SUMMARY = "Home of the world's best free knowledge and entertainment. Equipped with multi-purpose toolkits for everyday tasks like converting images, audio, documents, editing PDFs, images, etc. alongside indie publishing pages, blog posts, corners just like the early internet vibes. Made for everyone, regardless of age, gender, nationality."

EXCLUDED_FILES = {
    "404", "404.html", "app", "apps", "page-top.html", "page-head.html", "page-bottom.html", "header.html", 
    "template.html", "post_template.html", "coming-soon", "junk", ".git", "node_modules",
    "private", "drafts", "assets"
}

def extract_meta_description(file_path):
    """Parses the HTML to find the meta description for AI context."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            html = f.read()
            # Regex to find <meta name="description" content="...">
            match = re.search(r'<meta?\s+name=["\']description["\']\s+content=["\'](.*?)["\']', html, re.IGNORECASE)
            if match:
                return match.group(1).strip()
    except Exception:
        pass
    return None

def sanitize_text(text):
    """Cleans up quotes and special characters for safe Markdown output."""
    if not text:
        return ""
    # Remove newlines and extra spaces
    text = " ".join(text.split())
    # Convert HTML entities (like &quot;) back to normal chars then escape for Markdown
    text = html.unescape(text)
    # Escape any existing pipes or brackets if necessary, 
    # but primarily ensure quotes don't break the string
    return text.replace('"', '\\"').replace("'", "\\'")

pages = []
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

            # Title extraction
            if file == "index.html" and root != ".":
                title = os.path.basename(root).replace("-", " ").title()
            else:
                title = file.replace(".html", "").replace("-", " ").title()
            
            # Context extraction (SEO Description)
            description = extract_meta_description(full_path)
            
            pages.append({
                "title": title,
                "url": url,
                "desc": sanitize_text(description)
            })

# Build llms.txt with AEO Best Practices
# Using Markdown headers and blockquotes as per llms-txt.org spec
content = f"""# {SITE_NAME}

> {SUMMARY}

## Key Pages and Resources
"""

for page in sorted(pages, key=lambda x: x['title']):
    desc_text = f": {page['desc']}" if page['desc'] else ""
    content += f"- [{page['title']}]({page['url']}){desc_text}\n"

content += f"""
## Technical Metadata
- [Homepage]({BASE_URL}/)
- [Sitemap]({BASE_URL}/sitemap.xml)
- [Robots.txt]({BASE_URL}/robots.txt)
- [LLMs.txt]({BASE_URL}/llms.txt)
- [links.txt]({BASE_URL}/links.txt)

## Resources
- [Tools]({BASE_URL}/tools/)
- [Pages]({BASE_URL}/pages/)
- [Posts]({BASE_URL}/posts/)

---
Generated for LLM efficiency. This file provides high-level context for AI agents.
"""

with open("llms.txt", "w", encoding="utf-8") as f:
    f.write(content)

print(f"✅ llms.txt created with {len(pages)} context-rich entries!")
