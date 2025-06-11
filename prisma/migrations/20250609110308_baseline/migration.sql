-- -----------------------------------------------------------------------------
-- WARNING: This infrastructure migration is critical for Prisma migrations. Do not modify or remove without coordination with the Architecture team.
-- -----------------------------------------------------------------------------

-- 1) Install uuid-ossp extension (if not exists)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2) Ensure optipension schema exists
CREATE SCHEMA IF NOT EXISTS optipension;

-- 3) Create generate_uuid function in the correct schema
CREATE OR REPLACE FUNCTION optipension.generate_uuid()
  RETURNS CHAR(36)
  LANGUAGE plpgsql
AS $$
BEGIN
  RETURN uuid_generate_v4()::CHAR(36);
END;
$$;

-- 4) Create audit log table (infrastructure table)
CREATE TABLE IF NOT EXISTS optipension.ad_change_logs (
    id            SERIAL       NOT NULL,
    uu            VARCHAR(36)  NOT NULL DEFAULT optipension.generate_uuid(),
    table_name    VARCHAR(100) NOT NULL,
    record_id     INTEGER      NOT NULL,
    record_action VARCHAR(1)   NOT NULL,
    old_value     JSONB,
    new_value     JSONB,
    is_active     BOOLEAN      NOT NULL DEFAULT true,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by    INTEGER      NOT NULL,
    updated_by    INTEGER,
    updated_at    TIMESTAMP,
    CONSTRAINT ad_change_logs_pkey PRIMARY KEY (id)
);

-- 5) Create unique index on uu
CREATE UNIQUE INDEX IF NOT EXISTS ad_change_logs_uu_key ON optipension.ad_change_logs(uu);

-- 6) Set owner
ALTER TABLE optipension.ad_change_logs OWNER TO sotrux; 
