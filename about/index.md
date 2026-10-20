----
title: About
description: Makron offers fast, simple tools for image, audio, and PDF conversion and more.
keywords: makron, image converter, audio converter, pdf tools, makron web app
author: Makron
----

# About Us

Multiple ideas had been buzzing in our mental furnaces, but gathering dust due to the negligence of effort or deficiency of fame.

Thus, we now decided to let people have access to free and useful resources and tools (with a fair bit of ad space to allow the team to gain monetization opportunities to keep our bellies full, and the domain and hosting landlords satisfied). If you would like to criticize on anything, or spew out some new ideas that we have not tried out yet (without facing the embarassment of failure) then the <a href="/contact/">contact page</a> would be the right place to go.

We decided that we can do pretty much any kind of digital or creative work, so our team has been growing ever since with many volunteers from around the spherical world. Check out our [services](/services/) page for further info.

Makron is a subsidiary of Senturisk.

<hr>

<!-- =====================================================================
     PART 1 of 3 — Paste inside <head>, after <link rel="stylesheet" href="/theme.css">
     Flag icon library: flag-icons (SVG flags, no emojis)
     ===================================================================== -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/css/flag-icons.min.css">


<!-- =====================================================================
     PART 2 of 3 — Paste inside <head> (or move into theme.css)
     Builds on theme.css variables and the existing .social-icon styles.
     ===================================================================== -->
<style>
    .mux-team { padding: 0; margin: 40px 0; }

    .mux-section-title {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin: 48px 0 24px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border);
    }
    .mux-section-title h3 { margin: 0; font-size: 1.5rem; }
    .mux-count { color: var(--text-muted); font-size: 0.95rem; }

    /* Current staff cards */
    .mux-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
        gap: 20px;
    }
    .mux-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 24px;
        background: var(--bg-light);
        border: 1px solid var(--border);
        border-left: 4px solid var(--primary);
        border-radius: var(--radius);
    }
    .mux-card h4 { margin: 0; font-size: 1.25rem; letter-spacing: -0.01em; }
    .mux-card p { margin: 0; font-size: 1rem; }
    .mux-domain {
        align-self: flex-start;
        padding: 2px 10px;
        background: var(--bg-alt);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--primary);
        font-size: 0.85rem;
        font-weight: 600;
    }

    /* Location + flag */
    .mux-loc {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--text-muted);
        font-size: 0.95rem;
    }
    .mux-loc .fi { border-radius: 2px; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12); }

    /* Social links (reuses .social-icon hover colours from theme.css) */
    .mux-social { display: flex; align-items: center; gap: 14px; margin-top: auto; padding-top: 4px; }
    .mux-social .social-icon svg { width: 20px; height: 20px; }

    /* Ex-staff, grouped by domain */
    .mux-alumni-group { margin-bottom: 32px; }
    .mux-alumni-group h4 {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin: 0 0 4px;
        font-size: 1.1rem;
    }
    .mux-alumni-group h4 .mux-count { font-size: 0.85rem; font-weight: 400; }
    .mux-alumni-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
        column-gap: 32px;
    }
    .mux-alumni-list li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid var(--border);
    }
    .mux-alumni-who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .mux-name { font-weight: 600; color: var(--text-main); overflow-wrap: anywhere; }
    .mux-alumni-list .mux-social { margin-top: 0; padding-top: 0; gap: 10px; flex-shrink: 0; }
    .mux-alumni-list .mux-social .social-icon svg { width: 18px; height: 18px; }

    .mux-social .social-icon:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; border-radius: 2px; }
</style>


<!-- =====================================================================
     PART 3 of 3 — Paste inside <main>, e.g. right after the first <hr>
     (before the "Btw if you can hear music…" paragraph)
     ===================================================================== -->
<section id="team" class="mux-team" aria-labelledby="mux-team-heading">
    <h2 id="mux-team-heading">The Makron Team</h2>

    <div class="aeo-bluf">
        <p><strong>Makron operates under a non-traditional organizational philosophy: this business doesn't define roles, but instead domains of work.</strong></p>
        <p style="margin-bottom:0">Rather than rigid corporate job titles or siloed hierarchies, our members command complete stewardship over mission-critical domains.</p>
    </div>

    <div id="mux-team-roster">
        <noscript><p>Enable JavaScript to see the team roster.</p></noscript>
    </div>
</section>

<!--
    TEAM DATA
    - Leave a social field as "" (or null) and its icon is not rendered.
    - Fill in a full URL (https://…) and the icon appears automatically.
    - "cc" is the ISO 3166-1 alpha-2 country code used by flag-icons (bd, us, ca, ua, id, hr …).
-->
<script type="application/json" id="mux-team-data">
{
  "current": [
    { "name": "Dewan Mukto", "domain": "Operations", "city": "Sylhet", "country": "Bangladesh", "cc": "bd",
      "bio": "Overseeing computational infrastructure, software production pipelines, technical publishing, and cross-functional execution across all Mux applications and releases.",
      "facebook": "https://facebook.com/dmimukto", "instagram": "https://instagram.com/dewanmukto", "linkedin": "https://www.linkedin.com/in/dewanmukto" },
    { "name": "Mahir Chowdhury", "domain": "Strategy", "city": "New York", "country": "USA", "cc": "us",
      "bio": "Directing long-term organizational trajectory, multi-sector research roadmaps, venture development, and strategic positioning within modern technology ecosystems.",
      "facebook": "https://www.facebook.com/mahirchyhasan21", "instagram": "", "linkedin": "" },
    { "name": "Abrar Ahmed", "domain": "Cybersecurity", "city": "Dhaka", "country": "Bangladesh", "cc": "bd",
      "bio": "Leading systems hardening, cryptographic protocol integrity, offensive/defensive threat modeling, runtime memory security, and client-side boundary defense.",
      "facebook": "https://www.facebook.com/abrarahmed.avi77", "instagram": "https://www.instagram.com/abrarahmedavi/", "linkedin": "" },
    { "name": "Asif Imtiaz Chowdhury", "domain": "Software/IT", "city": "Sylhet", "country": "Bangladesh", "cc": "bd",
      "bio": "Engineering distributed software systems, backend microservices, real-time data pipelines, and internal developer tooling.",
      "facebook": "https://www.facebook.com/asif.chowdhury.202538", "instagram": "", "linkedin": "" },
    { "name": "Nafis Hossain Farabi", "domain": "Software/IT", "city": "Kushtia", "country": "Bangladesh", "cc": "bd",
      "bio": "Specializing in modern frontend ecosystems, performance optimization, responsive interface pipelines, and robust TypeScript client architectures.",
      "facebook": "https://www.facebook.com/snh.farabi", "instagram": "https://www.instagram.com/syed_nafiz_hussain_/", "linkedin": "" },
    { "name": "Ahnaf bin Enam", "domain": "Marketing", "city": "Dhaka", "country": "Bangladesh", "cc": "bd",
      "bio": "Driving global distribution initiatives, ecosystem narratives, digital brand positioning, and multi-channel reach.",
      "facebook": "https://www.facebook.com/ahnaf.bin.enam", "instagram": "", "linkedin": "" },
    { "name": "Mahraf Murtoza", "domain": "Strategy", "city": "Dhaka", "country": "Bangladesh", "cc": "bd",
      "bio": "Analyzing emerging market shifts, developing cross-domain strategy, orchestrating product positioning, and aligning long-term organizational objectives.",
      "facebook": "https://www.facebook.com/mahraf.murtoza", "instagram": "https://www.instagram.com/phantom_bunny1/", "linkedin": "" }
  ],
  "former": [
    { "name": "Emily Barrera Simon", "country": "USA", "cc": "us", "domain": "Music", "facebook": "", "instagram": "https://www.instagram.com/emilybarrera___/", "linkedin": "" },
    { "name": "Tazim Ezaz", "country": "Bangladesh", "cc": "bd", "domain": "Software/IT", "facebook": "", "instagram": "https://www.instagram.com/valampz/", "linkedin": "" },
    { "name": "Shayonton Chakraborty", "country": "Bangladesh", "cc": "bd", "domain": "Strategy", "facebook": "https://www.facebook.com/chakraborty.shayon.7", "instagram": "", "linkedin": "" },
    { "name": "Barnali Debnath", "country": "Bangladesh", "cc": "bd", "domain": "Art/Design", "facebook": "https://www.facebook.com/barnali.debnath.376258", "instagram": "", "linkedin": "" },
    { "name": "Maliha Rasul", "country": "Bangladesh", "cc": "bd", "domain": "Art/Design", "facebook": "https://www.facebook.com/maliha.rasul.2025", "instagram": "", "linkedin": "" },
    { "name": "Tasneem Islam", "country": "Bangladesh", "cc": "bd", "domain": "Art/Design", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Syeda Rizwana", "country": "Bangladesh", "cc": "bd", "domain": "Art/Design", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Michael Paul Eppert", "country": "USA", "cc": "us", "domain": "Marketing", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Aryan Majid", "country": "Bangladesh", "cc": "bd", "domain": "Animation", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Daniel bin Mohsin", "country": "Bangladesh", "cc": "bd", "domain": "Strategy", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Shah Farhan Alam", "country": "Bangladesh", "cc": "bd", "domain": "Strategy", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Ashfaqul Awal Himel", "country": "Bangladesh", "cc": "bd", "domain": "Art/Design", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Dewan Mahbubul Islam", "country": "Bangladesh", "cc": "bd", "domain": "Art/Design", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Zelqad Hassan Shish", "country": "Bangladesh", "cc": "bd", "domain": "Art/Design", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Ekhtear Ahmed Fahim", "country": "Bangladesh", "cc": "bd", "domain": "Marketing", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Md Jawad Iqbal", "country": "Bangladesh", "cc": "bd", "domain": "Art/Design", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Monojit Dhar Rommyo", "country": "Bangladesh", "cc": "bd", "domain": "Strategy", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Rumman Saad", "country": "Bangladesh", "cc": "bd", "domain": "Strategy", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Tasmina Habiba", "country": "Bangladesh", "cc": "bd", "domain": "Art/Design", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Israt Jahan", "country": "Bangladesh", "cc": "bd", "domain": "Art/Design", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Julia Mendryshora", "country": "Ukraine", "cc": "ua", "domain": "Art/Design", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Bethany L.", "country": "USA", "cc": "us", "domain": "Art/Design", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Charista wari Sutiandi", "country": "Indonesia", "cc": "id", "domain": "Art/Design", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Udit Deb Ucchas", "country": "Bangladesh", "cc": "bd", "domain": "Marketing", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Rotnodwip Das Orvik", "country": "Canada", "cc": "ca", "domain": "Strategy", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Omar Sudaisi", "country": "Bangladesh", "cc": "bd", "domain": "Marketing", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Младен Цвијовић", "country": "Croatia", "cc": "hr", "domain": "Software/IT", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Al-Zawad Islam Shadman", "country": "Bangladesh", "cc": "bd", "domain": "Strategy", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Mahdi Faiyaz Okib", "country": "Canada", "cc": "ca", "domain": "Strategy", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Ashrafull Islam Shawon", "country": "Bangladesh", "cc": "bd", "domain": "Art/Design", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Ahmed Yashfi", "country": "Bangladesh", "cc": "bd", "domain": "Art/Design", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Sabyasachi Nirjhar", "country": "Bangladesh", "cc": "bd", "domain": "Strategy", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Soumitra Mithun", "country": "Bangladesh", "cc": "bd", "domain": "Strategy", "facebook": "", "instagram": "", "linkedin": "" },
    { "name": "Fahim Imtiaz", "country": "Bangladesh", "cc": "bd", "domain": "Strategy", "facebook": "", "instagram": "", "linkedin": "" }
  ]
}
</script>

<script>
(function () {
    'use strict';

    var root = document.getElementById('mux-team-roster');
    var dataEl = document.getElementById('mux-team-data');
    if (!root || !dataEl) return;

    var data;
    try {
        data = JSON.parse(dataEl.textContent);
    } catch (err) {
        console.error('Mux team data is not valid JSON.', err);
        return;
    }

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var NETWORKS = [
        { key: 'facebook', cls: 'fb', label: 'Facebook',
          d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
        { key: 'instagram', cls: 'ig', label: 'Instagram',
          d: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z' },
        { key: 'linkedin', cls: 'li', label: 'LinkedIn',
          d: 'M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z' }
    ];

    function h(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    // Returns a clean http(s) URL, or null when the value is empty, null or unsafe.
    function cleanUrl(value) {
        if (typeof value !== 'string') return null;
        value = value.trim();
        if (!value) return null;
        try {
            var u = new URL(value);
            return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
        } catch (e) {
            return null;
        }
    }

    // Returns the icon row, or null when the person has no social URLs at all.
    function socialLinks(person) {
        var wrap = null;
        NETWORKS.forEach(function (net) {
            var url = cleanUrl(person[net.key]);
            if (!url) return;
            if (!wrap) wrap = h('div', 'mux-social');

            var a = h('a', 'social-icon ' + net.cls);
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.title = net.label;
            a.setAttribute('aria-label', person.name + ' on ' + net.label);

            var svg = document.createElementNS(SVG_NS, 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('aria-hidden', 'true');
            var path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', net.d);
            svg.appendChild(path);
            a.appendChild(svg);
            wrap.appendChild(a);
        });
        return wrap;
    }

    // Flag icon (flag-icons library) followed by "City, Country".
    function place(person) {
        var span = h('span', 'mux-loc');
        if (/^[a-z]{2}$/i.test(person.cc || '')) {
            var flag = h('span', 'fi fi-' + person.cc.toLowerCase());
            flag.setAttribute('aria-hidden', 'true');
            span.appendChild(flag);
        }
        span.appendChild(h('span', null, [person.city, person.country].filter(Boolean).join(', ')));
        return span;
    }

    function sectionTitle(title, count) {
        var wrap = h('div', 'mux-section-title');
        wrap.appendChild(h('h3', null, title));
        wrap.appendChild(h('span', 'mux-count', count + (count === 1 ? ' member' : ' members')));
        return wrap;
    }

    // ---- Current staff -------------------------------------------------
    var current = data.current || [];
    root.appendChild(sectionTitle('Current staff', current.length));

    var grid = h('div', 'mux-grid');
    current.forEach(function (p) {
        var card = h('article', 'mux-card');
        card.appendChild(h('span', 'mux-domain', p.domain));
        card.appendChild(h('h4', null, p.name));
        card.appendChild(place(p));
        card.appendChild(h('p', null, p.bio));
        var social = socialLinks(p);
        if (social) card.appendChild(social);
        grid.appendChild(card);
    });
    root.appendChild(grid);

    // ---- Ex-staff, grouped by domain (largest group first) -------------
    var former = data.former || [];
    root.appendChild(sectionTitle('Ex-staff', former.length));

    var groups = {};
    var order = [];
    former.forEach(function (p) {
        if (!groups[p.domain]) { groups[p.domain] = []; order.push(p.domain); }
        groups[p.domain].push(p);
    });
    order.sort(function (a, b) { return groups[b].length - groups[a].length; });

    order.forEach(function (domain) {
        var group = h('div', 'mux-alumni-group');
        var title = h('h4', null, domain);
        title.appendChild(h('span', 'mux-count', String(groups[domain].length)));
        group.appendChild(title);

        var list = h('ul', 'mux-alumni-list');
        groups[domain].forEach(function (p) {
            var li = h('li');
            var who = h('div', 'mux-alumni-who');
            who.appendChild(h('span', 'mux-name', p.name));
            who.appendChild(place(p));
            li.appendChild(who);
            var social = socialLinks(p);
            if (social) li.appendChild(social);
            list.appendChild(li);
        });
        group.appendChild(list);
        root.appendChild(group);
    });
})();
</script>



<img src="https://tracker.makron.workers.dev/?token=about"
     width="1" height="1" style="display:none;" alt="dumb image"></img>