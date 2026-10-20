export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");

    if (!userId) return new Response("Missing ID", { status: 400, headers: corsHeaders });

    let botToken = env.BOT_TOKEN; // default public token

    // If POST request with custom token in body, use it
    if (request.method === "POST") {
      try {
        const body = await request.json();
        if (body.customToken && typeof body.customToken === "string") {
          botToken = body.customToken;
        }
      } catch (e) {
        // ignore invalid body, fall back to env token
      }
    }

    try {
      const response = await fetch(`https://discord.com/api/v10/users/${userId}`, {
        headers: { 
          "Authorization": `Bot ${botToken}`,
          'Content-Type': 'application/json' 
        }
      });
      
      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Discord API error" }), { 
          status: response.status, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response("Discord API Error", { status: 500, headers: corsHeaders });
    }
  }
};