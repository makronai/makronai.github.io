export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || 'untagged-canary';

    // Extract everything from Cloudflare's edge
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const ua = request.headers.get('user-agent') || 'unknown';
    const referer = request.headers.get('referer') || 'direct / no referer';

    const cf = request.cf || {};
    const latitude = cf.latitude || 'unknown';
    const longitude = cf.longitude || 'unknown';
    const city = cf.city || 'unknown';
    const country = cf.country || 'unknown';
    const region = cf.region || 'unknown';
    const timezone = cf.timezone || 'unknown';
    const asn = cf.asn || 'unknown';
    const isp = cf.asOrganization || 'unknown';

    // Discord rich embed payload
    const embed = {
      title: `🚨 Tracker Triggered`,
      description: `Token: **${token}**`,
      color: 0xFF0000, // red for alert
      timestamp: new Date().toISOString(),
      fields: [
        { name: "IP Address", value: `\`${ip}\``, inline: true },
        { name: "Location", value: `${city}, ${region}, ${country}\nLat/Lon: ${latitude}, ${longitude}\nTimezone: ${timezone}`, inline: true },
        { name: "ASN / ISP", value: `ASN: ${asn}\nOrg/ISP: ${isp}`, inline: true },
        { name: "User-Agent (Device/Browser)", value: `\`\`\`${ua.substring(0, 300)}\`\`\``, inline: false },
        { name: "Referer / Trigger Site", value: referer, inline: false }
      ],
      footer: { text: "Cloudflare Worker • Makron Tracker" }
    };

    const payload = {
      username: "Makron Tracker",
      embeds: [embed]
    };

    // Send to Discord (using secret you set below)
    if (env.DISCORD_WEBHOOK_URL) {
      try {
        await fetch(env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        console.error("Discord send failed", e);
      }
    }

    // Return a real 1x1 transparent GIF so <img> tags load cleanly
    const gifBase64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const gifArray = Uint8Array.from(atob(gifBase64), c => c.charCodeAt(0));

    return new Response(gifArray, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache",
        "Pragma": "no-cache"
      }
    });
  }
};