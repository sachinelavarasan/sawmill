CREATE TYPE "public"."payment_mode" AS ENUM('CASH', 'UPI', 'BANK', 'CHEQUE', 'OTHER');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mill_id" uuid NOT NULL,
	"import_load_id" uuid,
	"export_load_id" uuid,
	"date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"mode" "payment_mode" NOT NULL,
	"reference" text,
	"notes" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_one_load_ck" CHECK (("payments"."import_load_id" is null) <> ("payments"."export_load_id" is null)),
	CONSTRAINT "payments_amount_ck" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_mill_id_mills_id_fk" FOREIGN KEY ("mill_id") REFERENCES "public"."mills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_import_load_id_import_loads_id_fk" FOREIGN KEY ("import_load_id") REFERENCES "public"."import_loads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_export_load_id_export_loads_id_fk" FOREIGN KEY ("export_load_id") REFERENCES "public"."export_loads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_import_idx" ON "payments" USING btree ("import_load_id");--> statement-breakpoint
CREATE INDEX "payments_export_idx" ON "payments" USING btree ("export_load_id");--> statement-breakpoint
CREATE INDEX "payments_mill_date_idx" ON "payments" USING btree ("mill_id","date");--> statement-breakpoint
-- Carry over what was already recorded: each load's single "amount paid / received" becomes one payment.
INSERT INTO "payments" ("mill_id", "import_load_id", "date", "amount", "mode", "notes", "created_by_id")
SELECT l."mill_id", l."id", f."updated_at"::date, f."amount_paid", 'OTHER', 'Recorded before payment history', l."created_by_id"
FROM "import_financials" f JOIN "import_loads" l ON l."id" = f."import_load_id"
WHERE f."amount_paid" > 0;--> statement-breakpoint
INSERT INTO "payments" ("mill_id", "export_load_id", "date", "amount", "mode", "notes", "created_by_id")
SELECT l."mill_id", l."id", f."updated_at"::date, f."amount_received", 'OTHER', 'Recorded before payment history', l."created_by_id"
FROM "export_financials" f JOIN "export_loads" l ON l."id" = f."export_load_id"
WHERE f."amount_received" > 0;
