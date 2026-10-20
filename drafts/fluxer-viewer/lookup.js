const WORKER_URL = 'https://fluxer-lookup.makron.workers.dev/'; 

async function doFluxLookup() {
    const id = document.getElementById('targetId').value.trim();
    if (!id) return;

    try {
        const res = await fetch(`${WORKER_URL}?id=${id}`);
        const data = await res.json();

        document.getElementById('displayName').innerText = data.display_name || "[ERROR]";
        document.getElementById('pfp').src = data.avatar_url || 'https://via.placeholder.com/150';
        document.getElementById('genCount').innerText = `${data.generation_count || 0} Images Created`;
        
        const timestamp = Number((BigInt(id) >> 22n)) + 1704067200000;
        document.getElementById('createdDate').innerText = new Date(timestamp).toLocaleDateString();

        document.getElementById('profileCard').style.display = 'block';
    } catch (e) {
        alert("Could not locate Fluxer record.");
    }
}

function copyId() {
    const id = document.getElementById('idVal').innerText;
    navigator.clipboard.writeText(id);
}