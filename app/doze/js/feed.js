window.NexusFeed = {
    init: async () => {
        await NexusFeed.loadPosts();
        NexusFeed.subscribeToNewPosts();
    },

    createPost: async () => {
        const input = document.getElementById('post-input');
        const content = input.value.trim();
        if (!content) return;

        // Based on your DB: author_id is handled by RLS, but we pass it anyway
        await supabaseClient.from('posts').insert([{ 
            author_id: NexusAPI.currentUser.id, 
            content: content,
            post_type: 'tweet'
        }]);
        
        input.value = '';
    },

    loadPosts: async () => {
        const { data: posts } = await supabaseClient
            .from('posts')
            .select('*, profiles(username, display_name, avatar_url)')
            .is('parent_id', null) // Only get main threads
            .order('created_at', { ascending: false })
            .limit(20);
            
        const stream = document.getElementById('feed-stream');
        stream.innerHTML = '';
        if (posts) posts.forEach(p => NexusFeed.renderPost(p, stream));
    },

    renderPost: (post, container) => {
        // Heavy use of our CSS layout utilities
        const el = document.createElement('div');
        el.className = 'flex row gap-4 p-4 border-b hover-bg transition cursor-pointer';
        
        const avatar = post.profiles?.avatar_url || '';
        const name = post.profiles?.display_name || post.profiles?.username || 'Unknown';
        const handle = post.profiles?.username || 'unknown';

        el.innerHTML = `
            <div class="avatar rounded-full" style="background-image: url('${avatar}')"></div>
            <div class="flex col flex-1 gap-1">
                <div class="flex row items-center gap-2">
                    <span class="font-bold">${name}</span>
                    <span class="text-muted">@${handle}</span>
                </div>
                <div class="text-main">${post.content}</div>
                <div class="flex row gap-4 mt-2 text-muted">
                    <span class="cursor-pointer hover:text-accent">💬 Reply</span>
                    <span class="cursor-pointer hover:text-accent">🔁 Repost</span>
                    <span class="cursor-pointer hover:text-accent">❤️ Like</span>
                </div>
            </div>
        `;
        container.appendChild(el);
    },

    subscribeToNewPosts: () => {
        supabaseClient.channel('public:posts')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
                // Fetch joined profile data for new post then render at top
                NexusFeed.loadPosts(); // Simplified for now, ideal way is to fetch specific profile
            }).subscribe();
    }
};