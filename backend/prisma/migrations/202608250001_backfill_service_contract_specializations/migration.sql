-- Backfill contract-level specialization scope for service contracts that were
-- created before ServiceContractSpecialization became part of Contract Context.
--
-- Existing explicit contract specialization rows are preserved as-is. This keeps
-- manually curated Stage/acceptance scopes stable and makes the migration
-- idempotent: once a contract has any explicit specialization scope, it is not
-- inferred again.
--
-- Source priority for contracts with no explicit scope:
-- 1. ProblemCategorySpecialization rows from the client company's categories.
--    These were the pre-existing category-level specialization requirements and
--    are the most precise historical source.
-- 2. Active Specialization rows owned by the client company.
-- 3. Active Specialization rows owned by the provider company.
--
-- Contracts with none of the above remain intentionally empty because there is
-- no historical specialization source to migrate.

WITH contracts_without_specializations AS (
  SELECT
    sc."id" AS service_contract_id,
    sc."clientCompanyId" AS client_company_id,
    sc."providerCompanyId" AS provider_company_id
  FROM "ServiceContract" sc
  WHERE NOT EXISTS (
    SELECT 1
    FROM "ServiceContractSpecialization" existing
    WHERE existing."serviceContractId" = sc."id"
  )
),
category_specializations AS (
  SELECT DISTINCT
    cws.service_contract_id,
    pcs."specializationId" AS specialization_id
  FROM contracts_without_specializations cws
  JOIN "ProblemCategory" pc
    ON pc."companyId" = cws.client_company_id
  JOIN "ProblemCategorySpecialization" pcs
    ON pcs."problemCategoryId" = pc."id"
),
client_specializations AS (
  SELECT DISTINCT
    cws.service_contract_id,
    s."id" AS specialization_id
  FROM contracts_without_specializations cws
  JOIN "Specialization" s
    ON s."companyId" = cws.client_company_id
   AND s."isActive" = true
  WHERE NOT EXISTS (
    SELECT 1
    FROM category_specializations cs
    WHERE cs.service_contract_id = cws.service_contract_id
  )
),
provider_specializations AS (
  SELECT DISTINCT
    cws.service_contract_id,
    s."id" AS specialization_id
  FROM contracts_without_specializations cws
  JOIN "Specialization" s
    ON s."companyId" = cws.provider_company_id
   AND s."isActive" = true
  WHERE NOT EXISTS (
    SELECT 1
    FROM category_specializations cs
    WHERE cs.service_contract_id = cws.service_contract_id
  )
    AND NOT EXISTS (
      SELECT 1
      FROM client_specializations cls
      WHERE cls.service_contract_id = cws.service_contract_id
    )
),
backfill_source AS (
  SELECT service_contract_id, specialization_id FROM category_specializations
  UNION
  SELECT service_contract_id, specialization_id FROM client_specializations
  UNION
  SELECT service_contract_id, specialization_id FROM provider_specializations
)
INSERT INTO "ServiceContractSpecialization" (
  "id",
  "serviceContractId",
  "specializationId",
  "createdAt",
  "updatedAt"
)
SELECT
  'scs_backfill_' || md5(service_contract_id || ':' || specialization_id),
  service_contract_id,
  specialization_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM backfill_source
ON CONFLICT DO NOTHING;
