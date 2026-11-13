CREATE TYPE "public"."approval_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('UNPAID', 'PARTIAL', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('OWNER', 'ACCOUNTANT');--> statement-breakpoint
CREATE TYPE "public"."stock_kind" AS ENUM('RAW', 'FINISHED');--> statement-breakpoint
CREATE TYPE "public"."stock_source" AS ENUM('IMPORT', 'PRODUCTION_INPUT', 'PRODUCTION_OUTPUT', 'EXPORT', 'ADJUSTMENT');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mill_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mill_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"gst_number" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "counters" (
	"mill_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "counters_mill_id_key_pk" PRIMARY KEY("mill_id","key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mill_id" uuid NOT NULL,
	"date" date NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"import_load_id" uuid,
	"notes" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "export_financials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"export_load_id" uuid NOT NULL,
	"client_id" uuid,
	"selling_rate_per_cft" numeric(12, 2),
	"sale_amount" numeric(14, 2),
	"amount_received" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'UNPAID' NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "export_financials_export_load_id_unique" UNIQUE("export_load_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "export_loads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mill_id" uuid NOT NULL,
	"code" text NOT NULL,
	"export_date" date NOT NULL,
	"lorry_number" text NOT NULL,
	"driver_name" text,
	"driver_mobile" text,
	"lorry_owner_name" text,
	"lorry_owner_mobile" text,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"wood_type" text NOT NULL,
	"import_load_id" uuid,
	"notes" text,
	"total_pieces" integer DEFAULT 0 NOT NULL,
	"total_cft" numeric(14, 3) DEFAULT '0' NOT NULL,
	"status" "approval_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "export_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"export_load_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"import_load_id" uuid,
	"thickness_in" numeric(8, 2) NOT NULL,
	"width_in" numeric(8, 2) NOT NULL,
	"length_ft" numeric(8, 2) NOT NULL,
	"pieces" integer NOT NULL,
	"cft" numeric(12, 3) NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_financials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_load_id" uuid NOT NULL,
	"supplier_id" uuid,
	"purchase_rate_per_cft" numeric(12, 2),
	"purchase_amount" numeric(14, 2),
	"transport_charges" numeric(14, 2),
	"amount_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'UNPAID' NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_financials_import_load_id_unique" UNIQUE("import_load_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_loads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mill_id" uuid NOT NULL,
	"code" text NOT NULL,
	"arrival_at" timestamp with time zone NOT NULL,
	"lorry_number" text NOT NULL,
	"driver_name" text,
	"driver_mobile" text,
	"lorry_owner_name" text,
	"lorry_owner_mobile" text,
	"origin_location" text,
	"wood_type" text NOT NULL,
	"wood_category" text,
	"notes" text,
	"total_logs" integer DEFAULT 0 NOT NULL,
	"total_cft" numeric(14, 3) DEFAULT '0' NOT NULL,
	"status" "approval_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "log_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_load_id" uuid NOT NULL,
	"log_number" integer NOT NULL,
	"length_ft" numeric(8, 2) NOT NULL,
	"girth_in" numeric(8, 2) NOT NULL,
	"cft" numeric(12, 3) NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mills_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_run_id" uuid NOT NULL,
	"thickness_in" numeric(8, 2) NOT NULL,
	"width_in" numeric(8, 2) NOT NULL,
	"length_ft" numeric(8, 2) NOT NULL,
	"pieces" integer NOT NULL,
	"cft" numeric(12, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mill_id" uuid NOT NULL,
	"code" text NOT NULL,
	"import_load_id" uuid NOT NULL,
	"wood_type" text NOT NULL,
	"production_date" date NOT NULL,
	"cutting_machine" text,
	"machine_operator" text,
	"worker_details" text,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"input_cft" numeric(14, 3),
	"output_cft" numeric(14, 3) DEFAULT '0' NOT NULL,
	"waste_cft" numeric(14, 3),
	"waste_notes" text,
	"status" "approval_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mill_id" uuid NOT NULL,
	"code" text NOT NULL,
	"kind" "stock_kind" NOT NULL,
	"wood_type" text NOT NULL,
	"import_load_id" uuid NOT NULL,
	"thickness_in" numeric(8, 2),
	"width_in" numeric(8, 2),
	"length_ft" numeric(8, 2),
	"pieces_delta" integer DEFAULT 0 NOT NULL,
	"cft_delta" numeric(14, 3) NOT NULL,
	"reason" text NOT NULL,
	"status" "approval_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mill_id" uuid NOT NULL,
	"kind" "stock_kind" NOT NULL,
	"wood_type" text NOT NULL,
	"import_load_id" uuid NOT NULL,
	"thickness_in" numeric(8, 2),
	"width_in" numeric(8, 2),
	"length_ft" numeric(8, 2),
	"pieces_delta" integer DEFAULT 0 NOT NULL,
	"cft_delta" numeric(14, 3) NOT NULL,
	"source" "stock_source" NOT NULL,
	"source_id" uuid NOT NULL,
	"posted_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mill_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"gst_number" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unloading_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_load_id" uuid NOT NULL,
	"vehicle_number" text NOT NULL,
	"driver_name" text,
	"driver_mobile" text,
	"vehicle_owner_name" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"duration_minutes" integer,
	"rate_per_hour" numeric(12, 2),
	"total_charges" numeric(14, 2),
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mill_id" uuid NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"preferred_language" text DEFAULT 'en' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_mill_id_mills_id_fk" FOREIGN KEY ("mill_id") REFERENCES "public"."mills"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clients" ADD CONSTRAINT "clients_mill_id_mills_id_fk" FOREIGN KEY ("mill_id") REFERENCES "public"."mills"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "counters" ADD CONSTRAINT "counters_mill_id_mills_id_fk" FOREIGN KEY ("mill_id") REFERENCES "public"."mills"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_mill_id_mills_id_fk" FOREIGN KEY ("mill_id") REFERENCES "public"."mills"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_import_load_id_import_loads_id_fk" FOREIGN KEY ("import_load_id") REFERENCES "public"."import_loads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_financials" ADD CONSTRAINT "export_financials_export_load_id_export_loads_id_fk" FOREIGN KEY ("export_load_id") REFERENCES "public"."export_loads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_financials" ADD CONSTRAINT "export_financials_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_loads" ADD CONSTRAINT "export_loads_mill_id_mills_id_fk" FOREIGN KEY ("mill_id") REFERENCES "public"."mills"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_loads" ADD CONSTRAINT "export_loads_import_load_id_import_loads_id_fk" FOREIGN KEY ("import_load_id") REFERENCES "public"."import_loads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_loads" ADD CONSTRAINT "export_loads_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_loads" ADD CONSTRAINT "export_loads_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_measurements" ADD CONSTRAINT "export_measurements_export_load_id_export_loads_id_fk" FOREIGN KEY ("export_load_id") REFERENCES "public"."export_loads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_measurements" ADD CONSTRAINT "export_measurements_import_load_id_import_loads_id_fk" FOREIGN KEY ("import_load_id") REFERENCES "public"."import_loads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_measurements" ADD CONSTRAINT "export_measurements_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import_financials" ADD CONSTRAINT "import_financials_import_load_id_import_loads_id_fk" FOREIGN KEY ("import_load_id") REFERENCES "public"."import_loads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import_financials" ADD CONSTRAINT "import_financials_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import_loads" ADD CONSTRAINT "import_loads_mill_id_mills_id_fk" FOREIGN KEY ("mill_id") REFERENCES "public"."mills"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import_loads" ADD CONSTRAINT "import_loads_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import_loads" ADD CONSTRAINT "import_loads_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "log_measurements" ADD CONSTRAINT "log_measurements_import_load_id_import_loads_id_fk" FOREIGN KEY ("import_load_id") REFERENCES "public"."import_loads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "log_measurements" ADD CONSTRAINT "log_measurements_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_production_run_id_production_runs_id_fk" FOREIGN KEY ("production_run_id") REFERENCES "public"."production_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_mill_id_mills_id_fk" FOREIGN KEY ("mill_id") REFERENCES "public"."mills"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_import_load_id_import_loads_id_fk" FOREIGN KEY ("import_load_id") REFERENCES "public"."import_loads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_mill_id_mills_id_fk" FOREIGN KEY ("mill_id") REFERENCES "public"."mills"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_import_load_id_import_loads_id_fk" FOREIGN KEY ("import_load_id") REFERENCES "public"."import_loads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_mill_id_mills_id_fk" FOREIGN KEY ("mill_id") REFERENCES "public"."mills"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_import_load_id_import_loads_id_fk" FOREIGN KEY ("import_load_id") REFERENCES "public"."import_loads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_posted_by_id_users_id_fk" FOREIGN KEY ("posted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_mill_id_mills_id_fk" FOREIGN KEY ("mill_id") REFERENCES "public"."mills"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unloading_entries" ADD CONSTRAINT "unloading_entries_import_load_id_import_loads_id_fk" FOREIGN KEY ("import_load_id") REFERENCES "public"."import_loads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unloading_entries" ADD CONSTRAINT "unloading_entries_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_mill_id_mills_id_fk" FOREIGN KEY ("mill_id") REFERENCES "public"."mills"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_mill_created_idx" ON "audit_logs" USING btree ("mill_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_mill_idx" ON "clients" USING btree ("mill_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_mill_date_idx" ON "expenses" USING btree ("mill_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "export_loads_mill_code_uq" ON "export_loads" USING btree ("mill_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "export_loads_mill_status_idx" ON "export_loads" USING btree ("mill_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "export_loads_mill_date_idx" ON "export_loads" USING btree ("mill_id","export_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "export_loads_created_by_idx" ON "export_loads" USING btree ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "export_measurements_load_line_uq" ON "export_measurements" USING btree ("export_load_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "import_loads_mill_code_uq" ON "import_loads" USING btree ("mill_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_loads_mill_status_idx" ON "import_loads" USING btree ("mill_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_loads_mill_arrival_idx" ON "import_loads" USING btree ("mill_id","arrival_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_loads_created_by_idx" ON "import_loads" USING btree ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "log_measurements_load_number_uq" ON "log_measurements" USING btree ("import_load_id","log_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "production_runs_mill_code_uq" ON "production_runs" USING btree ("mill_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_runs_mill_status_idx" ON "production_runs" USING btree ("mill_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_runs_import_idx" ON "production_runs" USING btree ("import_load_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_adjustments_mill_code_uq" ON "stock_adjustments" USING btree ("mill_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_adjustments_mill_status_idx" ON "stock_adjustments" USING btree ("mill_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_mill_kind_wood_idx" ON "stock_movements" USING btree ("mill_id","kind","wood_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_import_idx" ON "stock_movements" USING btree ("import_load_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_source_idx" ON "stock_movements" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_mill_idx" ON "suppliers" USING btree ("mill_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unloading_import_idx" ON "unloading_entries" USING btree ("import_load_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_mill_role_idx" ON "users" USING btree ("mill_id","role");