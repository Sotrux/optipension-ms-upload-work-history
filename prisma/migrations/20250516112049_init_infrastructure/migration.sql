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