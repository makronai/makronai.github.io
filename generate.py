import os
import re
import markdown
import concurrent.futures

# --- Configuration ---
BASE_URL = "https://makron.app"
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

# Array of folders/paths to block from generation
IGNORE_DIRS = {
    ".git", "node_modules", "drafts", "private", "app", "apps", "assets", "category", "files", "__pycache__"
}

# Template paths
TEMPLATE_HEAD = os.path.join(ROOT_DIR, "page-head.html")
TEMPLATE_TOP = os.path.join(ROOT_DIR, "page-top.html")
TEMPLATE_BOTTOM = os.path.join(ROOT_DIR, "page-bottom.html")

def load_templates():
    """Loads all HTML template fragments into memory."""
    try:
        with open(TEMPLATE_HEAD, 'r', encoding='utf-8') as f:
            head = f.read()
        with open(TEMPLATE_TOP, 'r', encoding='utf-8') as f:
            top = f.read()
        with open(TEMPLATE_BOTTOM, 'r', encoding='utf-8') as f:
            bottom = f.read()
        return head, top, bottom
    except FileNotFoundError as e:
        print(f"❌ Missing template file: {e}")
        return None, None, None

def get_page_data(file_path):
    """Extracts 'key: value' metadata and the markdown body."""
    meta = {}
    body = ""
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

def process_file(md_path, head_tpl, top_tpl, bottom_tpl):
    """Processes a single index.md file into index.html."""
    dir_path = os.path.dirname(md_path)
    rel_dir = os.path.relpath(dir_path, ROOT_DIR).replace("\\", "/")
    
    # Handle the root directory case
    if rel_dir == ".":
        canonical_url = f"{BASE_URL}/"
        image_base_path = ""
    else:
        canonical_url = f"{BASE_URL}/{rel_dir}/"
        image_base_path = f"/{rel_dir}"

    meta, markdown_body = get_page_data(md_path)
    
    if not meta or markdown_body is None:
        return False

    # Check for OG Image
    og_image_url = f"{BASE_URL}/assets/default-og.jpg" # Fallback default
    for ext in ["jpg", "png"]:
        if os.path.exists(os.path.join(dir_path, f"ogimage.{ext}")):
            og_image_url = f"{BASE_URL}{image_base_path}/ogimage.{ext}"
            break

    # 1. Prepare SEO Head
    html_head = head_tpl
    if rel_dir == ".":
        page_title = meta.get('title', 'Makron - Tools, Content, Resources, Services Online')
    else:
        page_title = f"{meta.get('title', 'Makron')} | Makron"
    html_head = html_head.replace("aeotitle", page_title)
    html_head = html_head.replace("aeodescription", meta.get("description", ""))
    html_head = html_head.replace("aeokeywords", meta.get("keywords", ""))
    html_head = html_head.replace("aeoauthor", meta.get("author", "Makron"))
    html_head = html_head.replace("aeocanonical", canonical_url)
    html_head = html_head.replace("aeoimage", og_image_url)

    # 2. Convert Markdown to HTML
    html_body = markdown.markdown(markdown_body, extensions=['fenced_code', 'tables'])

    # Check for optional index.source and append raw HTML
    source_path = os.path.join(dir_path, "index.source")
    if os.path.exists(source_path):
        try:
            with open(source_path, 'r', encoding='utf-8') as sf:
                extra_html = sf.read()
                html_body += f"\n\n{extra_html}"
        except Exception as e:
            print(f"⚠️ Could not read source file at {source_path}: {e}")

    # 3. Stitch it all together
    final_html = f"""{html_head}
    
{top_tpl}
    

    <main id="main-content">
{html_body}
    </main>

    <footer id="bottom-module">
{bottom_tpl}
    </footer>
</body>
</html>"""

    # 4. Write Output
    if rel_dir == "404":
        # Exception: Write directly to root as 404.html
        target_path = os.path.join(ROOT_DIR, "404.html")
    else:
        target_path = os.path.join(dir_path, "index.html")
        
    with open(target_path, 'w', encoding='utf-8') as f:
        f.write(final_html)
    
    print(f"✅ Generated: {target_path}")
    return True

def generate():
    head_tpl, top_tpl, bottom_tpl = load_templates()
    if not head_tpl:
        return

    print("--- Starting Multithreaded Page Generation ---")
    
    # Gather all index.md files
    md_files = []
    for root, dirs, files in os.walk(ROOT_DIR):
        # Filter ignored directories in-place
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith('.')]
        
        if "index.md" in files:
            md_files.append(os.path.join(root, "index.md"))

    # Process files concurrently using threading
    success_count = 0
    with concurrent.futures.ThreadPoolExecutor() as executor:
        # Map submits the function and arguments to the thread pool
        futures = {executor.submit(process_file, path, head_tpl, top_tpl, bottom_tpl): path for path in md_files}
        
        for future in concurrent.futures.as_completed(futures):
            if future.result():
                success_count += 1

    print(f"\n🎉 Done! Successfully generated {success_count} pages.")

if __name__ == "__main__":
    generate()
