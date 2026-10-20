window.NexusAuth = {
    init: async () => {
        await NexusAuth.checkSession();
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') NexusAuth.checkSession();
        });
    },

    checkSession: async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            NexusAPI.currentUser = session.user;
            document.getElementById('view-auth').classList.add('hidden');
            document.getElementById('app-layout').classList.remove('hidden');
            
            // Boot up other modules
            NexusProfile.loadMiniProfile();
            NexusFeed.init();
            NexusChat.init();
        } else {
            NexusAPI.currentUser = null;
            document.getElementById('app-layout').classList.add('hidden');
            document.getElementById('view-auth').classList.remove('hidden');
        }
    },

    signIn: async () => {
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const err = document.getElementById('auth-error');
        
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            err.textContent = error.message;
            err.classList.remove('hidden');
        }
    },

    signOut: async () => await supabaseClient.auth.signOut()
};

document.addEventListener('DOMContentLoaded', NexusAuth.init);