window.NexusProfile = {
    loadMiniProfile: async () => {
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', NexusAPI.currentUser.id)
            .single();

        if (profile) {
            document.getElementById('nav-username').innerText = profile.display_name || profile.username;
            document.getElementById('nav-handle').innerText = `@${profile.username}`;
            
            if (profile.avatar_url) {
                document.getElementById('nav-avatar').style.backgroundImage = `url('${profile.avatar_url}')`;
                document.getElementById('composer-avatar').style.backgroundImage = `url('${profile.avatar_url}')`;
            }
            
            // Example of using the customization JSON from your DB schema
            if (profile.customization && profile.customization.theme_gradient) {
                 // You could apply this gradient to their profile header
                 console.log("User theme gradient:", profile.customization.theme_gradient);
            }
        }
    }
};