-- Hand-written: drizzle-kit cannot express EXCLUDE constraints.
-- btree_gist is a trusted extension: it lets a GiST index compare uuids with `=`.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- A person has at most one manager at any instant; periods are [started_at, ended_at), open when ended_at is null.
ALTER TABLE "core"."manager_attachment" ADD CONSTRAINT "manager_attachment_no_overlap" EXCLUDE USING gist ("person_id" WITH =, tstzrange("started_at", "ended_at") WITH &&);
--> statement-breakpoint
-- A person is in the same team at most once at any instant.
ALTER TABLE "core"."team_membership" ADD CONSTRAINT "team_membership_no_overlap" EXCLUDE USING gist ("team_id" WITH =, "person_id" WITH =, tstzrange("started_at", "ended_at") WITH &&);
