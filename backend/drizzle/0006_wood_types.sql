-- One spelling per wood type (see backend/src/common/wood-types.ts).
-- 1. Tidy spaces everywhere a wood type is stored.
-- 2. Per mill, spellings that differ only in case ("teak", "Teak") become the one used on most
--    import loads (ties: capitalised first), so stock, production and reports stop splitting.
-- 3. Mills without a list get one from the wood types now in use.
UPDATE "import_loads" SET "wood_type" = regexp_replace(btrim("wood_type"), '\s+', ' ', 'g') WHERE "wood_type" <> regexp_replace(btrim("wood_type"), '\s+', ' ', 'g');--> statement-breakpoint
UPDATE "production_runs" SET "wood_type" = regexp_replace(btrim("wood_type"), '\s+', ' ', 'g') WHERE "wood_type" <> regexp_replace(btrim("wood_type"), '\s+', ' ', 'g');--> statement-breakpoint
UPDATE "stock_movements" SET "wood_type" = regexp_replace(btrim("wood_type"), '\s+', ' ', 'g') WHERE "wood_type" <> regexp_replace(btrim("wood_type"), '\s+', ' ', 'g');--> statement-breakpoint
UPDATE "stock_adjustments" SET "wood_type" = regexp_replace(btrim("wood_type"), '\s+', ' ', 'g') WHERE "wood_type" <> regexp_replace(btrim("wood_type"), '\s+', ' ', 'g');--> statement-breakpoint
UPDATE "export_loads" SET "wood_type" = regexp_replace(btrim("wood_type"), '\s+', ' ', 'g') WHERE "wood_type" <> regexp_replace(btrim("wood_type"), '\s+', ' ', 'g');--> statement-breakpoint
CREATE TEMP TABLE "wood_canon" ON COMMIT DROP AS
SELECT DISTINCT ON ("mill_id", "k") "mill_id", "k", "name"
FROM (
  SELECT "mill_id", lower("wood_type") AS "k", "wood_type" AS "name", count(*) AS "n"
  FROM "import_loads" GROUP BY "mill_id", lower("wood_type"), "wood_type"
) x
ORDER BY "mill_id", "k", "n" DESC, "name";--> statement-breakpoint
UPDATE "import_loads" t SET "wood_type" = c."name" FROM "wood_canon" c WHERE c."mill_id" = t."mill_id" AND c."k" = lower(t."wood_type") AND t."wood_type" <> c."name";--> statement-breakpoint
UPDATE "production_runs" t SET "wood_type" = c."name" FROM "wood_canon" c WHERE c."mill_id" = t."mill_id" AND c."k" = lower(t."wood_type") AND t."wood_type" <> c."name";--> statement-breakpoint
UPDATE "stock_movements" t SET "wood_type" = c."name" FROM "wood_canon" c WHERE c."mill_id" = t."mill_id" AND c."k" = lower(t."wood_type") AND t."wood_type" <> c."name";--> statement-breakpoint
UPDATE "stock_adjustments" t SET "wood_type" = c."name" FROM "wood_canon" c WHERE c."mill_id" = t."mill_id" AND c."k" = lower(t."wood_type") AND t."wood_type" <> c."name";--> statement-breakpoint
UPDATE "export_loads" t SET "wood_type" = c."name" FROM "wood_canon" c WHERE c."mill_id" = t."mill_id" AND c."k" = lower(t."wood_type") AND t."wood_type" <> c."name";--> statement-breakpoint
UPDATE "mills" m
SET "settings" = m."settings" || jsonb_build_object('woodTypes', (SELECT jsonb_agg(c."name" ORDER BY lower(c."name")) FROM "wood_canon" c WHERE c."mill_id" = m."id"))
WHERE NOT (m."settings" ? 'woodTypes') AND EXISTS (SELECT 1 FROM "wood_canon" c WHERE c."mill_id" = m."id");--> statement-breakpoint
DROP TABLE "wood_canon";
