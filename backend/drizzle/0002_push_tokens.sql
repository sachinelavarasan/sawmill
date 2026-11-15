CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mill_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_mill_id_mills_id_fk" FOREIGN KEY ("mill_id") REFERENCES "public"."mills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_tokens_user_idx" ON "push_tokens" USING btree ("user_id");