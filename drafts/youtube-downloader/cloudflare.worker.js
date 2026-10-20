addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  let videoId = url.searchParams.get("v");

  // Extract video ID if full URL was pasted
  if (videoId && videoId.includes("youtu")) {
    const match = videoId.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    if (match) videoId = match[1];
  }

  if (!videoId || videoId.length !== 11) {
    return new Response("Error: Missing or invalid video ID. Use the frontend form.", { status: 400 });
  }

  const type = url.searchParams.get("type") || "video";

  try {
    // === NEW: Direct Innertube API call (stable in 2026) ===
    const apiUrl = "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

    const payload = {
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20260417.01.00"   // current as of April 2026
        }
      },
      videoId: videoId
    };

    const apiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      body: JSON.stringify(payload)
    });

    const playerResponse = await apiResponse.json();

    if (playerResponse.playabilityStatus?.status !== "OK") {
      throw new Error(playerResponse.playabilityStatus?.reason || "Video not available");
    }

    const formats = [
      ...(playerResponse.streamingData?.adaptiveFormats || []),
      ...(playerResponse.streamingData?.formats || [])
    ];

    let chosen;
    if (type === "audio") {
      // Best audio-only
      chosen = formats
        .filter(f => f.mimeType && f.mimeType.includes("audio"))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    } else {
      // Best video
      chosen = formats
        .filter(f => f.mimeType && f.mimeType.includes("video"))
        .sort((a, b) => (b.height || 0) - (a.height || 0) || (b.bitrate || 0) - (a.bitrate || 0))[0];
    }

    if (!chosen || !chosen.url) throw new Error("No downloadable format found");

    const streamUrl = chosen.url;
    const title = (playerResponse.videoDetails?.title || "youtube-video")
      .replace(/[^a-zA-Z0-9.-]/g, "_");
    const ext = type === "audio" ? "m4a" : "mp4";
    const filename = `${title}.${ext}`;

    const fileResponse = await fetch(streamUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    return new Response(fileResponse.body, {
      headers: {
        "Content-Type": chosen.mimeType.split(";")[0] || (type === "audio" ? "audio/mp4" : "video/mp4"),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });

  } catch (e) {
    return new Response(`Download failed: ${e.message}\n\nTry again later or check if the video is age-restricted/private.`, { status: 500 });
  }
}