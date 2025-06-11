/*
  Warnings:

  - You are about to drop the `ad_change_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "ad_change_logs";

-- CreateTable
CREATE TABLE "ad_users" (
    "id" SERIAL NOT NULL,
    "uu" VARCHAR(36) NOT NULL DEFAULT generate_uuid(),
    "external_user_id" VARCHAR(255) NOT NULL,
    "internal_user_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "ad_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hl_history_laboral_uploads" (
    "id" SERIAL NOT NULL,
    "uu" VARCHAR(36) NOT NULL DEFAULT generate_uuid(),
    "user_id" VARCHAR(255) NOT NULL,
    "document_type" VARCHAR(2) NOT NULL,
    "document_number" VARCHAR(12) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "spaces_key" VARCHAR(500) NOT NULL,
    "spaces_url" VARCHAR(1000) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "hl_history_laboral_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hl_extractions" (
    "id" SERIAL NOT NULL,
    "uu" VARCHAR(36) NOT NULL DEFAULT generate_uuid(),
    "upload_id" INTEGER NOT NULL,
    "full_name" VARCHAR(255),
    "document" VARCHAR(20),
    "total_weeks" DECIMAL(10,2),
    "high_risk_weeks" DECIMAL(10,2),
    "discrepancy_of_weeks" DECIMAL(10,2),
    "summary_json" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "extraction_meta" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "hl_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ad_users_external_user_id_key" ON "ad_users"("external_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_users_internal_user_id_key" ON "ad_users"("internal_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "hl_extractions_upload_id_key" ON "hl_extractions"("upload_id");

-- AddForeignKey
ALTER TABLE "hl_history_laboral_uploads" ADD CONSTRAINT "hl_history_laboral_uploads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "ad_users"("internal_user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hl_history_laboral_uploads" ADD CONSTRAINT "hl_history_laboral_uploads_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "ad_users"("internal_user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hl_extractions" ADD CONSTRAINT "hl_extractions_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "hl_history_laboral_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hl_extractions" ADD CONSTRAINT "hl_extractions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "ad_users"("internal_user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hl_extractions" ADD CONSTRAINT "hl_extractions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "ad_users"("internal_user_id") ON DELETE SET NULL ON UPDATE CASCADE;
