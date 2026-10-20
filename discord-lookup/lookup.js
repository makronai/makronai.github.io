const WORKER_URL = 'https://discord-lookup.makron.workers.dev/'; 
let currentUrls = { pfp: '', banner: '' };

function getCustomToken() {
    return localStorage.getItem('customDiscordBotToken') || null;
}

function saveCustomToken() {
    const token = document.getElementById('customToken').value.trim();
    if (token) {
        localStorage.setItem('customDiscordBotToken', token);
        alert('Custom bot token saved! Your lookups will now use it (no cooldown).');
    }
}

function clearCustomToken() {
    if (confirm('Clear saved bot token?')) {
        localStorage.removeItem('customDiscordBotToken');
        document.getElementById('customToken').value = '';
        alert('Token cleared. Using public service again.');
    }
}

const BADGE_FLAGS = {
    1: "Staff", 2: "Partner", 4: "HypeSquad Events", 8: "Bug Hunter Lvl 1",
    64: "Bravery", 128: "Brilliance", 256: "Balance", 512: "Early Supporter",
    16384: "Bug Hunter Lvl 2", 131072: "Verified Dev", 4194304: "Active Developer"
};

const BADGE_ICONS = {
    1: { name: "Staff", icon: "https://cdn.discordapp.com/attachments/STAFF_BADGE_URL.png" },
    2: { name: "Partner", icon: "https://cdn.discordapp.com/attachments/PARTNER_BADGE_URL.png" },
    4: { name: "HypeSquad Events", icon: "https://cdn.discordapp.com/attachments/HYPESQUAD_EVENTS_URL.png" },
    8: { name: "Bug Hunter Lvl 1", icon: "https://cdn.discordapp.com/attachments/BUGHUNTER1_URL.png" },
    64: { name: "HypeSquad Bravery", icon: "https://cdn.discordapp.com/attachments/BRAVERY_URL.png" },
    128: { name: "HypeSquad Brilliance", icon: "https://cdn.discordapp.com/attachments/BRILLIANCE_URL.png" },
    256: { name: "HypeSquad Balance", icon: "https://cdn.discordapp.com/attachments/BALANCE_URL.png" },
    512: { name: "Early Supporter", icon: "https://cdn.discordapp.com/attachments/EARLY_SUPPORTER_URL.png" },
    16384: { name: "Bug Hunter Lvl 2", icon: "https://cdn.discordapp.com/attachments/BUGHUNTER2_URL.png" },
    131072: { name: "Verified Developer", icon: "https://cdn.discordapp.com/attachments/VERIFIED_DEV_URL.png" },
    4194304: { name: "Active Developer", icon: "https://cdn.discordapp.com/attachments/ACTIVE_DEV_URL.png" }
};

function getCooldownData() {
    const data = localStorage.getItem('lookup_cooldown');
    return data ? JSON.parse(data) : { count: 0, lastFetch: 0 };
}

function updateCooldown() {
    const customToken = getCustomToken();
    if (customToken) {
        document.getElementById('searchBtn').disabled = false;
        document.getElementById('cooldownMsg').innerText = "Using your custom token (no cooldown)";
        return;
    }

    const data = getCooldownData();
    const nextWait = Math.min((data.count + 1) * 5000, 5000); // (5 second increments, max seconds)
    const remaining = (data.lastFetch + nextWait) - Date.now();

    if (remaining > 0) {
        document.getElementById('searchBtn').disabled = true;
        document.getElementById('cooldownMsg').innerText = `Cooldown: Wait ${Math.ceil(remaining/1000)}s`;
        setTimeout(updateCooldown, 1000);
    } else {
        document.getElementById('searchBtn').disabled = false;
        document.getElementById('cooldownMsg').innerText = "";
    }
}

async function doLookup() {
    const id = document.getElementById('targetId').value.trim();
    if (!id) return;

    const customToken = getCustomToken();
    const useCustomToken = !!customToken;

    // Cooldown only applies when NOT using custom token
    if (!useCustomToken) {
        const cooldownData = getCooldownData();
        const remaining = (cooldownData.lastFetch + Math.min(cooldownData.count * 5000, 60000)) - Date.now();

    }

    try {
                        let profileData;

        if (useCustomToken) {
            // Send custom token to Cloudflare Worker
            const res = await fetch(`${WORKER_URL}?id=${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customToken: customToken })
            });
            if (!res.ok) throw new Error("Worker error or invalid token");
            profileData = await res.json();
        } else {
            // Use public worker (no token)
            const res = await fetch(`${WORKER_URL}?id=${id}`);
            if (!res.ok) throw new Error("Failed to fetch");
            profileData = await res.json();
        }

        const user = profileData.user || profileData;
        const primaryGuild = profileData.primary_guild || user.primary_guild;

        // Avatar & Banner
        const avatarExt = user.avatar?.startsWith('a_') ? 'gif' : 'png';
        const bannerExt = user.banner?.startsWith('a_') ? 'gif' : 'png';

        currentUrls.pfp = user.avatar 
            ? `https://cdn.discordapp.com/avatars/${id}/${user.avatar}.${avatarExt}?size=1024`
            : `https://cdn.discordapp.com/embed/avatars/${(user.discriminator || 0) % 5}.png`;

        currentUrls.banner = user.banner 
            ? `https://cdn.discordapp.com/banners/${id}/${user.banner}.${bannerExt}?size=1024`
            : null;

        // Basic info
        document.getElementById('profileCard').style.display = 'block';
	const profileCard = document.getElementById('profileCard');

        document.getElementById('pfp').src = currentUrls.pfp;
        document.getElementById('displayName').innerText = user.global_name || user.username;
        const tagElement = document.getElementById('tag');
        if (user.bot) {
            tagElement.innerText = `@${user.username}`;
            tagElement.classList.add('bot');
            tagElement.dataset.discriminator = `#${user.discriminator || '0000'}`;
        } else {
            tagElement.innerText = `@${user.username}`;
            tagElement.classList.remove('bot');
        }

        document.getElementById('idVal').innerText = id;

        // Avatar Decoration
        const decoImg = document.getElementById('decoration');
        if (user.avatar_decoration_data?.asset) {
            decoImg.src = `https://cdn.discordapp.com/avatar-decoration-presets/${user.avatar_decoration_data.asset}.png?size=96`;
            decoImg.style.display = 'block';
        } else {
            decoImg.style.display = 'none';
        }

        // Badges
        const badgesDiv = document.getElementById('badgesVal');
        badgesDiv.innerHTML = ''; 
        if (user.public_flags) {
            for (const [flag, name] of Object.entries(BADGE_FLAGS)) {
                if ((user.public_flags & parseInt(flag)) === parseInt(flag)) {
                    badgesDiv.innerHTML += `<span>${name}</span>`;
                }
            }
        }
        if (badgesDiv.innerHTML === '') {
            badgesDiv.innerHTML = '<span style="background:#4f545c">None</span>';
        }

        // Bio
        const bioContainer = document.getElementById('bioVal');

        // Connected Accounts
        const connectionsContainer = document.getElementById('connectionsVal');
        connectionsContainer.innerHTML = `
            <div id="ipVal" class="premium-lock">
        <span class="info-val-text">(Discord API doesn't allow)</span>
    </div>
        `;

        // Clan / Guild Tag
        const clanInline = document.getElementById('clanTagInline');
        
        if (primaryGuild && primaryGuild.tag) {
            let html = primaryGuild.tag;
            if (primaryGuild.badge) {
                const badgeUrl = `https://cdn.discordapp.com/guild-tag-badges/${primaryGuild.identity_guild_id}/${primaryGuild.badge}.png`;
                html = `<img src="${badgeUrl}" style="height:18px;vertical-align:middle;margin-right:4px;">${html}`;
            }
            clanInline.innerHTML = html;
            clanInline.style.display = 'inline-block';
            
            // Hover tooltip
            clanInline.title = "This is a Guild (Clan) tag.\nTo get the same tag, find and join the associated server and set it in your profile.";
            clanInline.style.cursor = 'help';
        } else {
            clanInline.style.display = 'none';
        }

        // Account creation date
        const timestamp = Number((BigInt(id) >> 22n)) + 1420070400000;
        document.getElementById('createdDate').innerText = new Date(timestamp).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });

        // Banner
        const bannerBox = document.getElementById('bannerBox');
        const bannerOverlay = document.getElementById('bannerOverlay');
        
        const themeColors = profileData.theme_colors || user.theme_colors || profileData.user_profile?.theme_colors;

        if (themeColors && themeColors.length === 2) {
            const color1 = '#' + themeColors[0].toString(16).padStart(6, '0');
            const color2 = '#' + themeColors[1].toString(16).padStart(6, '0');
            
            profileCard.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
        } else {
            profileCard.style.background = 'var(--discord-card)';
        }
        
        if (currentUrls.banner) {
            bannerBox.style.backgroundImage = `url(${currentUrls.banner})`;
            bannerBox.style.backgroundColor = 'transparent';
            bannerOverlay.innerHTML = `<span class="view-btn" onclick="openSource('banner')">View</span>`;
        } else {
            let color = '#5865f2';
            if (profileData.banner_color) {
                color = profileData.banner_color;
            }
            bannerBox.style.backgroundImage = 'none';
            bannerBox.style.backgroundColor = color;
            bannerOverlay.innerHTML = `<span style="color:white; font-size:12px; font-weight:bold">${color.toUpperCase()}</span>`;
        }

        // Nameplate
        const nameplateContainer = document.getElementById('nameplateContainer');
        const nameplateDisplay = document.getElementById('nameplateDisplay');
        
        if (profileData.collectibles?.nameplate) {
            const np = profileData.collectibles.nameplate;
            const assetPath = np.asset.endsWith('/') ? np.asset : np.asset + '/';
            const nameplateImgUrl = `https://cdn.discordapp.com/assets/collectibles/${assetPath}img.png`;

            const previewHTML = `
                <div style="display:flex; align-items:center; gap:12px; padding:10px; border-radius:8px; background:#2b2d31; box-shadow:0 4px 12px rgba(0,0,0,0.4);">
                    <div style="position:relative; width:42px; height:42px; flex-shrink:0;">
                        <img src="${currentUrls.pfp}" style="width:100%; height:100%; border-radius:50%; border:3px solid #36393f;">
                        ${user.avatar_decoration_data?.asset 
                            ? `<img src="https://cdn.discordapp.com/avatar-decoration-presets/${user.avatar_decoration_data.asset}.png?size=48" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;">` 
                            : ''}
                    </div>
                    
                    <div style="flex:1; position:relative; min-height:42px;">
                        <img src="${nameplateImgUrl}" style="width:100%; height:42px; object-fit:cover; border-radius:6px; display:block;">
                                                <div style="position:absolute; left:14px; top:50%; transform:translateY(-50%); display:flex; align-items:center; gap:6px; color:#fff; font-weight:600; font-size:15px; text-shadow:0 1px 2px rgba(0,0,0,0.8); width:calc(100% - 28px);">
                            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${user.global_name || user.username}</span>
                            ${primaryGuild && primaryGuild.tag 
                                ? `
                                <span style="display:flex; align-items:center; gap:4px; background:rgba(55,55,55,0.25); color:#9294a1; padding:2px 8px; border-radius:4px; font-size:13px; font-weight:bold;">
                                    ${primaryGuild.badge 
                                        ? `<img src="https://cdn.discordapp.com/guild-tag-badges/${primaryGuild.identity_guild_id}/${primaryGuild.badge}.png" style="height:16px; vertical-align:middle;">` 
                                        : ''}
                                    ${primaryGuild.tag}
                                </span>` 
                                : ''}
                        </div>
                    </div>
                </div>
            `;

            nameplateDisplay.innerHTML = previewHTML;
            nameplateContainer.style.display = 'block';
        } else {
            nameplateContainer.style.display = 'none';
        }


        // Cooldown
        if (!useCustomToken) {
            const currentData = getCooldownData();
            const newCount = Math.min(currentData.count + 1, 12); // cap at ~60s
            localStorage.setItem('lookup_cooldown', JSON.stringify({
                count: newCount,
                lastFetch: Date.now()
            }));
        }
        updateCooldown();

    } catch (e) {
        console.error(e);
        alert("Error fetching profile..");
    }
}

function openSource(type) {
    if (currentUrls[type]) window.open(currentUrls[type], '_blank');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const notif = document.createElement('div');
        notif.textContent = '✅ Copied!';
        notif.style.position = 'fixed';
        notif.style.bottom = '20px';
        notif.style.left = '50%';
        notif.style.transform = 'translateX(-50%)';
        notif.style.background = '#3ba55c';
        notif.style.color = 'white';
        notif.style.padding = '8px 16px';
        notif.style.borderRadius = '4px';
        notif.style.zIndex = '10000';
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 1500);
    });
}

function showTokenHelp() {
    document.getElementById('tokenHelpPopup').style.display = 'block';
}

function hideTokenHelp() {
    document.getElementById('tokenHelpPopup').style.display = 'none';
}

function toggleHelp() {
    const modal = document.getElementById('usageModal');
    modal.style.display = (modal.style.display === 'none' || modal.style.display === '') ? 'block' : 'none';
}

window.addEventListener('load', () => {
    const savedToken = getCustomToken();
    if (savedToken) {
        const tokenInput = document.getElementById('customToken');
        if (tokenInput) tokenInput.value = savedToken;
    }
});

updateCooldown();