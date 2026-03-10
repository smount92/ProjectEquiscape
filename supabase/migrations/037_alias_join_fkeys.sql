-- ============================================================
-- Migration 037: Add FK constraints to public.users for PostgREST joins
-- Enables .select("*, actor:users!actor_id(alias_name)") patterns
-- ============================================================

-- activity_events.actor_id -> public.users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'activity_events_actor_id_users_fkey' AND table_name = 'activity_events'
  ) THEN
    ALTER TABLE activity_events ADD CONSTRAINT activity_events_actor_id_users_fkey 
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- notifications.actor_id -> public.users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'notifications_actor_id_users_fkey' AND table_name = 'notifications'
  ) THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_actor_id_users_fkey 
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- user_ratings.reviewer_id -> public.users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_ratings_reviewer_id_users_fkey' AND table_name = 'user_ratings'
  ) THEN
    ALTER TABLE user_ratings ADD CONSTRAINT user_ratings_reviewer_id_users_fkey 
      FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- horse_timeline.user_id -> public.users  
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'horse_timeline_user_id_users_fkey' AND table_name = 'horse_timeline'
  ) THEN
    ALTER TABLE horse_timeline ADD CONSTRAINT horse_timeline_user_id_users_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- show_entries.user_id -> public.users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'show_entries_user_id_users_fkey' AND table_name = 'show_entries'
  ) THEN
    ALTER TABLE show_entries ADD CONSTRAINT show_entries_user_id_users_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
