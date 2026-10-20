export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      // 2. Parse multipart FormData (frontend sends FormData, not JSON)
      const formData = await request.formData();

      const service = formData.get("service") || "Not specified";
      const details = formData.get("details") || "No details provided";
      const source  = formData.get("source")  || "unknown";

      // Collect attached files (actual File/Blob objects)
      const fileEntries = formData.getAll("files");
      const validFiles = fileEntries.filter(f => f && typeof f === "object" && f.name && f.size > 0);

      // 3. Construct the Discord Embed
      const fields = [
        { name: "Service Type", value: service, inline: true },
        { name: "Source", value: source, inline: true },
        { name: "Project Details", value: details.slice(0, 1024) || "—" },
      ];

      const discordPayload = {
        username: "Makron Service Bot",
        avatar_url: "https://makron.app/assets/logo.png",
        embeds: [
          {
            title: "🚀 New Service Request",
            color: 0x5b74b3,
            fields,
            timestamp: new Date().toISOString(),
            footer: { text: "makron.app — Service Console" },
          },
        ],
      };

      // 4. Send to Discord Webhook — multipart if files present, JSON otherwise
      let discordResponse;

      if (validFiles.length > 0) {
        // Discord supports up to 10 attachments per message via multipart/form-data.
        // The JSON payload goes in the "payload_json" field; files go as "files[N]".
        const discordForm = new FormData();
        discordForm.append("payload_json", JSON.stringify(discordPayload));
        validFiles.slice(0, 10).forEach((file, i) => {
          discordForm.append(`files[${i}]`, file, file.name);
        });

        discordResponse = await fetch(env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          body: discordForm,
          // Do NOT set Content-Type manually — the runtime sets the correct
          // multipart boundary automatically when body is a FormData instance.
        });
      } else {
        discordResponse = await fetch(env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordPayload),
        });
      }

      if (!discordResponse.ok) {
        const errText = await discordResponse.text();
        throw new Error(`Discord responded ${discordResponse.status}: ${errText}`);
      }

      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });

    } catch (err) {
      console.error("Worker error:", err.message);
      return new Response(JSON.stringify({ status: "error", message: err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};