-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Define Storage Buckets (Run these in the Supabase Dashboard or via API)
-- buckets: 'avatars', 'banners', 'posts', 'chats', 'stories'
insert into storage.buckets (id, name, public) values ('media', 'media', true);

create type user_status as enum ('online', 'idle', 'dnd', 'offline');

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  bio text,
  avatar_url text, -- Supports manual upload path or external link
  banner_url text,
  status_emoji text,
  status_text text,
  presence user_status default 'offline',
  
  -- Discord-style customization
  customization jsonb default '{
    "theme_gradient": ["#8ecae6", "#219ebc"],
    "font_family": "Inter",
    "is_animated_avatar": false,
    "border_color": null
  }',
  
  updated_at timestamptz default now()
);

create table communities (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique not null,
  description text,
  icon_url text,
  owner_id uuid references profiles(id),
  created_at timestamptz default now()
);

create table channels (
  id uuid default uuid_generate_v4() primary key,
  community_id uuid references communities(id) on delete cascade,
  name text not null,
  channel_type text default 'text', -- 'text', 'voice', 'announcement'
  is_private boolean default false,
  created_at timestamptz default now()
);

create table community_members (
  id uuid default uuid_generate_v4() primary key,
  community_id uuid references communities(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member', -- 'owner', 'admin', 'moderator', 'member'
  joined_at timestamptz default now(),
  unique(community_id, user_id)
);

create type post_type as enum ('tweet', 'story', 'note');

create table posts (
  id uuid default uuid_generate_v4() primary key,
  author_id uuid references profiles(id) on delete cascade,
  content text,
  post_type post_type default 'tweet',
  
  -- The secret to Twitter-style threads:
  parent_id uuid references posts(id) on delete cascade, 
  
  -- Media handling (Array of URLs or storage paths)
  media_attachments jsonb default '[]', -- e.g., [{"type": "video", "url": "...", "source": "manual"}]
  
  -- For Instagram Stories
  expires_at timestamptz, 
  
  created_at timestamptz default now()
);

create table reactions (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  emoji text not null, -- Supports Tenor/Giphy references or standard emoji
  unique(post_id, user_id, emoji)
);

create table chat_rooms (
  id uuid default uuid_generate_v4() primary key,
  is_group boolean default false,
  group_name text,
  group_icon text,
  created_at timestamptz default now()
);

create table chat_participants (
  chat_id uuid references chat_rooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (chat_id, user_id)
);

create table messages (
  id uuid default uuid_generate_v4() primary key,
  chat_id uuid references chat_rooms(id) on delete cascade,
  sender_id uuid references profiles(id),
  content text,
  media_url text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create table notifications (
  id uuid default uuid_generate_v4() primary key,
  recipient_id uuid references profiles(id) on delete cascade,
  sender_id uuid references profiles(id),
  type text not null, -- 'mention', 'reply', 'reaction', 'message'
  post_id uuid references posts(id),
  is_seen boolean default false,
  created_at timestamptz default now()
);

create table blocks (
  blocker_id uuid references profiles(id) on delete cascade,
  blocked_id uuid references profiles(id) on delete cascade,
  primary key (blocker_id, blocked_id)
);

-- Enable RLS
alter table profiles enable row level security;
alter table posts enable row level security;
alter table messages enable row level security;
alter table community_members enable row level security;

-- Profiles: Anyone can view, only owner can edit
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update their own profile" on profiles for update using (auth.uid() = id);

-- Posts: Viewable if not blocked, only author can delete
create policy "Posts are viewable by non-blocked users" on posts for select
  using (not exists (select 1 from blocks where blocker_id = posts.author_id and blocked_id = auth.uid()));

create policy "Users can create posts" on posts for insert with check (auth.uid() = author_id);

-- Messages: Only participants can see messages
create policy "Participants can view their messages" on messages for select
  using (exists (select 1 from chat_participants where chat_id = messages.chat_id and user_id = auth.uid()));

-- Communities: Only members can see private channels
create policy "Members can view community channels" on channels for select
  using (
    not is_private or 
    exists (select 1 from community_members where community_id = channels.community_id and user_id = auth.uid())
  );

-- #####################################################################################
-- 2
-- #####################################################################################
-- Function to automatically create a profile for a new user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id, 
    -- Generate a default username from their email
    split_part(new.email, '@', 1) || '_' || substr(md5(random()::text), 1, 6),
    split_part(new.email, '@', 1)
  );
  return new;
end;
$$;

-- Trigger that fires every time a user signs up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();