-- Enable real-time for the messages table to allow chat updates.
BEGIN;
  -- Add the table to the replication set managed by Supabase
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
COMMIT;
