import os
import re
from datetime import datetime
import email.utils # For RFC 822 date formatting

# Configuration (Mirrors your autogen.py structure)
POSTS_ROOT = os.path.dirname(os.path.abspath(__file__))
SITE_ROOT = os.path.dirname(POSTS_ROOT)
RSS_OUTPUT = os.path.join(POSTS_ROOT, "rss.xml")
SITE_URL = "https://makron.app" # Change this to your actual production URL
SITE_NAME = "Makron"
SITE_DESC = "The latest updates and articles from Makron."

def get_post_data(file_path):
    """Extracts metadata from content.md (Logic from autogen.py)"""
    meta = {}
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            content = f.read()
            match = re.search(r"----\s*(.*?)\s*----\s*(.*)", content, re.DOTALL)
            if match:
                raw_meta = match.group(1)
                for line in raw_meta.strip().split('\n'):
                    if ':' in line:
                        key, val = line.split(':', 1)
                        meta[key.strip().lower()] = val.strip()
                return meta
    except Exception as e:
        print(f"❌ Error reading {file_path}: {e}")
    return None

def format_date(date_str):
    """Converts YYYY-MM-DD to RFC 822 format for RSS readers."""
    try:
        dt = datetime.strptime(date_str, '%Y-%m-%d')
        return email.utils.format_datetime(dt)
    except:
        # Fallback to current time if date is missing or malformed
        return email.utils.format_datetime(datetime.now())

def generate_rss():
    print("--- Generating RSS Feed ---")
    posts_found = []

    for root, _, files in os.walk(POSTS_ROOT):
        if "content.md" in files:
            rel_path = os.path.relpath(root, POSTS_ROOT)
            if rel_path == ".": continue

            md_path = os.path.join(root, "content.md")
            meta = get_post_data(md_path)

            if meta:
                posts_found.append({
                    "title": meta.get("title", "Untitled"),
                    "description": meta.get("description", ""),
                    "author": meta.get("author", "Unknown"),
                    "date": meta.get("time", "2026-01-01"),
                    "link": f"{SITE_URL}/{rel_path.replace(os.sep, '/')}/"
                })

    # Sort posts by date descending (Newest first)
    posts_found.sort(key=lambda x: x['date'], reverse=True)

    # Build the XML String
    rss_items = ""
    for p in posts_found:
        rss_items += f"""
        <item>
            <title>{p['title']}</title>
            <link>{p['link']}</link>
            <description>{p['description']}</description>
            <pubDate>{format_date(p['date'])}</pubDate>
            <author>{p['author']}</author>
            <guid isPermaLink="true">{p['link']}</guid>
        </item>"""

    rss_xml = f"""<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>{SITE_NAME}</title>
    <link>{SITE_URL}</link>
    <description>{SITE_DESC}</description>
    <language>en-us</language>
    <lastBuildDate>{email.utils.format_datetime(datetime.now())}</lastBuildDate>
    <atom:link href="{SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    {rss_items}
</channel>
</rss>"""

    with open(RSS_OUTPUT, 'w', encoding='utf-8') as f:
        f.write(rss_xml.strip())
    
    print(f"✅ RSS Feed generated at: {RSS_OUTPUT}")

if __name__ == "__main__":
    generate_rss()