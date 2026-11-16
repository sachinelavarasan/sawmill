CREATE INDEX "log_measurements_created_by_idx" ON "log_measurements" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "production_outputs_run_idx" ON "production_outputs" USING btree ("production_run_id");--> statement-breakpoint
CREATE INDEX "production_runs_created_by_idx" ON "production_runs" USING btree ("created_by_id");