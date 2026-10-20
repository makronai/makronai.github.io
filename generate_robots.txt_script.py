# generate_robots.py
# Run: python generate_robots.py

BASE_URL = "https://makron.app"   # ← CHANGE THIS

content = f"""User-agent: *
Allow: /

# Block any private folders (add more as needed)
Disallow: /files/
Disallow: /drafts/
Disallow: /admin/

Sitemap: {BASE_URL}/sitemap.xml
"""

with open("robots.txt", "w", encoding="utf-8") as f:
    f.write(content)

print("✅ robots.txt created!")