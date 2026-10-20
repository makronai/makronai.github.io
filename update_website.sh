#!/bin/bash

# Function to handle errors
halt_on_error() {
    if [ $? -ne 0 ]; then
        echo -e "\n\033[0;31m!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo "   ERROR: $1 failed!"
        echo "   Process halted."
        echo -e "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\033[0m"
        read -p "Press Enter to exit..."
        exit 1
    fi
}

echo "=========================================="
echo "      Makron Static Site Generator"
echo "=========================================="

# 1: Core Page Generation
echo "(1/7) Running generate.py..."
python3 generate.py
halt_on_error "generate.py"

# 2: Core Page Generation
echo "(2/7) Running generate_posts.py..."
python3 generate_posts.py
halt_on_error "generate_posts.py"

# 3: URL List
echo "(3/7) Running generate_links.py..."
python3 generate_links.txt_script.py
halt_on_error "generate_links.py"

# 4: LLMS context
echo "(4/7) Running generate_llms.py..."
python3 generate_llms.txt_script.py
halt_on_error "generate_llms.py"

# 5: Robots.txt
echo "(5/7) Running generate_robots.py..."
python3 generate_robots.txt_script.py
halt_on_error "generate_robots.py"

# 6: RSS Feed
echo "(6/7) Running generate_rss.py..."
python3 generate_rss.xml_script.py
halt_on_error "generate_rss.py"

# 7: Sitemap
echo "(7/7) Running generate_sitemap.py..."
python3 generate_sitemap.xml_script.py
halt_on_error "generate_sitemap.py"

echo -e "\n=========================================="
echo -e "   \033[0;32mSUCCESS: All tasks completed!\033[0m"
echo "=========================================="
read -p "Press Enter to exit..."