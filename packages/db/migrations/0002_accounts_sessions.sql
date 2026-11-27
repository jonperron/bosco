CREATE TABLE "core"."account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"oidc_subject" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_oidc_subject_unique" UNIQUE("oidc_subject")
);
--> statement-breakpoint
CREATE TABLE "core"."session" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "session_expires_after_created" CHECK ("core"."session"."expires_at" > "core"."session"."created_at")
);
--> statement-breakpoint
ALTER TABLE "core"."session" ADD CONSTRAINT "session_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "core"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_email_lower_unique" ON "core"."account" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "session_account_id_index" ON "core"."session" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_index" ON "core"."session" USING btree ("expires_at");