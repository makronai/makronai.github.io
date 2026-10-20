const supabaseUrl = 'https://xsjexzfbvqorjyjeieem.supabase.co';
const supabaseKey = 'sb_publishable_UGPvFv0u3WQ_RGEt6Z8VLg_PrZcXSuW';

window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

window.NexusAPI = {
    currentUser: null,
    
    // UI View Switcher leveraging our new CSS classes
    switchView: (viewName) => {
        ['feed', 'chat'].forEach(v => {
            document.getElementById(`view-${v}`).classList.add('hidden');
        });
        document.getElementById(`view-${viewName}`).classList.remove('hidden');
        
        // Update Glass Header Title
        const titles = { 'feed': 'Home', 'chat': 'Messages' };
        document.getElementById('view-title').innerText = titles[viewName];
    }
};

window.switchView = window.NexusAPI.switchView; // Global alias for HTML clicks