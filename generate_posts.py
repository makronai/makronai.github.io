import os
import re
import markdown
import json
import concurrent.futures
from datetime import datetime

# --- Configuration ---
BASE_URL = "https://makron.app"
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
POSTS_ROOT = os.path.join(ROOT_DIR, "posts")
MASTER_INDEX = os.path.join(POSTS_ROOT, "index.html")

# Template Paths
TEMPLATE_HEAD = os.path.join(ROOT_DIR, "page-head.html")
TEMPLATE_TOP = os.path.join(ROOT_DIR, "page-top.html")
TEMPLATE_BOTTOM = os.path.join(ROOT_DIR, "page-bottom.html")

def load_templates():
    try:
        with open(TEMPLATE_HEAD, 'r', encoding='utf-8') as f: head = f.read()
        with open(TEMPLATE_TOP, 'r', encoding='utf-8') as f: top = f.read()
        with open(TEMPLATE_BOTTOM, 'r', encoding='utf-8') as f: bottom = f.read()
        return head, top, bottom
    except FileNotFoundError as e:
        print(f"❌ Template error: {e}")
        return None, None, None

def get_post_data(file_path):
    """Extracts metadata and markdown body."""
    meta = {}
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            content = f.read()
            # Looks for metadata enclosed in ----
            match = re.search(r"----\s*(.*?)\s*----\s*(.*)", content, re.DOTALL)
            
            if match:
                raw_meta = match.group(1)
                body = match.group(2)
                for line in raw_meta.strip().split('\n'):
                    if ':' in line:
                        key, val = line.split(':', 1)
                        meta[key.strip().lower()] = val.strip() # Lowercase keys for consistency
                return meta, body
            else:
                print(f"⚠️ Skipping: No valid metadata block found in {file_path}")
    except Exception as e:
        print(f"❌ Error reading {file_path}: {e}")
    return None, None

def generate_json_ld(meta, url):
    schema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": meta.get("title", "Untitled"),
        "description": meta.get("description", ""),
        "category": meta.get("category", "General"),
        "author": {"@type": "Person", "name": meta.get("author", "Makron")},
        "datePublished": meta.get("time", datetime.now().strftime("%Y-%m-%d")),
        "url": url,
        "image": meta.get("image", "")
    }
    return f'<script type="application/ld+json">\n{json.dumps(schema, indent=2)}\n</script>'

def process_post(file_path, head_tpl, top_tpl, bottom_tpl):
    meta, body = get_post_data(file_path)
    if not meta: return None

    dir_path = os.path.dirname(file_path)
    # Determine the URL relative to the /posts/ directory
    rel_path = os.path.relpath(dir_path, POSTS_ROOT).replace(os.sep, '/')
    
    # Avoid processing the root /posts/ folder itself
    if rel_path == ".": return None

    post_url = f"{BASE_URL}/posts/{rel_path}/"
    html_body = markdown.markdown(body, extensions=['fenced_code', 'tables', 'attr_list'])
    json_ld = generate_json_ld(meta, post_url)

    og_image_url = f"{post_url}ogimage.jpg" # Fallback default
    for ext in ["png", "jpg", "jpeg"]:
        if os.path.exists(os.path.join(dir_path, f"ogimage.{ext}")):
            og_image_url = f"{post_url}ogimage.{ext}"
            break

    cat = meta.get('category', 'General')
    cat_slug = cat.lower().replace(' ', '-')
    core_kw = meta.get('core_keyword', meta.get('title', 'Topic'))
    post_date = meta.get('time', '2026-01-01')
    
    breadcrumbs = (
        f'<nav aria-label="Breadcrumb">'
        f'<ol class="seo-breadcrumb">'
        f'<li><a href="/">Home</a></li><li>&gt;</li>'
        f'<li>{cat}</li><li>&gt;</li>'
        f'<li aria-current="page">{core_kw}</li>'
        f'</ol></nav>'
    )
    
    bluf_html = (
        f'<section class="aeo-bluf">'
        f'<h2>{core_kw}</h2>'
        f'<p>{meta.get("bluf", "")}</p>'
        f'</section>'
    ) if meta.get("bluf") else ""

    # 1. Customize the Head Fragment
    head = head_tpl
    head = head.replace("aeotitle", f"{meta.get('title', 'Untitled')} | Makron")
    head = head.replace("aeodescription", meta.get('description', ''))
    head = head.replace("aeokeywords", meta.get('keywords', ''))
    head = head.replace("aeoauthor", meta.get('author', 'Makron'))
    head = head.replace("aeoimage", og_image_url)
    head = head.replace("aeocanonical", post_url)
    
    # Insert JSON-LD and switch OG type to article
    if "<!--aeojson-->" in head:
        head = head.replace("<!--aeojson-->", json_ld)
    else:
        head = head.replace("</head>", f"{json_ld}\n</head>")
        
    head = head.replace('property="og:type" content="website"', 'property="og:type" content="article"')

    # 2. Assemble the full page using universal fragments
    final_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
{head}
</head>
<body>
{top_tpl}
    <main class="post-content container">
        <article>
            {breadcrumbs}
            <header class="post-header">
                <h1>{meta.get('title', 'Untitled')}</h1>
                <div class="post-meta">By {meta.get('author', 'Makron')} • {meta.get('time', 'Recently')}</div>
                <link rel="stylesheet" href="/assets/atom-one-dark.min.css">
                <script src="/assets/highlight.min.js"></script>
            </header>
            {bluf_html}
            <hr>
            <div class="entry-content">
                {html_body}
            </div>
        </article>
    </main>
{bottom_tpl}
</body>
</html>"""

    output_path = os.path.join(dir_path, "index.html")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(final_html)

    return {
        "title": meta.get("title", "Untitled"),
        "author": meta.get("author", "Makron"),
        "date": meta.get("time", "0000-00-00"),
        "link": f"/posts/{rel_path}/"
    }

def update_master_index(posts):
    if not os.path.exists(MASTER_INDEX):
        print(f"⚠️ Master index not found at {MASTER_INDEX}, skipping update.")
        return
        
    posts.sort(key=lambda x: x['date'], reverse=True)
    
    list_html = "<ul>\n"
    for p in posts:
        list_html += f'        <li><a href="{p["link"]}">{p["title"]}</a> by {p["author"]}, {p["date"]}</li>\n'
    list_html += "    </ul>"

    with open(MASTER_INDEX, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find the list area after the H2 header
    pattern = r"(<h1>All Posts</h1>)([\s\S]*?)(?=<p|<h|<footer|</body>)"
    if re.search(pattern, content):
        new_content = re.sub(pattern, r"\1\n" + list_html + "\n", content)
        with open(MASTER_INDEX, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("📈 Master index list updated.")
    else:
        print("⚠️ Could not find '<h1>All Posts</h1>' in /posts/index.html to insert the list.")

def run():
    head, top, bottom = load_templates()
    if not head: return

    post_files = []
    # Recursively search /posts/ and all subfolders
    for root, _, files in os.walk(POSTS_ROOT):
        if "content.md" in files:
            post_files.append(os.path.join(root, "content.md"))

    if not post_files:
        print(f"❓ No 'content.md' files found in {POSTS_ROOT}. Check your filenames.")
        return

    print(f"🚀 Found {len(post_files)} posts. Starting generation...")

    generated_posts = []
    # Multithreading for speed
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [executor.submit(process_post, p, head, top, bottom) for p in post_files]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                generated_posts.append(res)
                print(f"✅ Generated: {res['title']}")

    update_master_index(generated_posts)

if __name__ == "__main__":
    run()
