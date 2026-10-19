-- Lock the app's tables away from Supabase's auto-generated Data API (PostgREST).
--
-- Aurelle talks to the database only through its own API, connecting as the table owner, which bypasses row-level
-- security. Supabase additionally exposes the "public" schema to the "anon" and "authenticated" roles, so without
-- this anyone holding the project's anon key could read tables such as "User" (including password hashes).
--
-- 1. Enable RLS with no policies: the Data API roles see nothing; the app (table owner) is unaffected.
-- 2. Revoke those roles' privileges outright, where the roles exist (they do on Supabase, not on plain PostgreSQL).

ALTER TABLE "User"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductVariant"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cart"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CartItem"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderEvent"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevokedToken"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END $$;
