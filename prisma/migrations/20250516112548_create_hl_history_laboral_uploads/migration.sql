-- CreateTable
CREATE TABLE "BaseModel" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaseModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hl_history_laboral_uploads" (
    "id" SERIAL NOT NULL,
    "uu" VARCHAR(36) NOT NULL DEFAULT optipension.generate_uuid(),
    "userId" VARCHAR(64) NOT NULL,
    "documentType" VARCHAR(2) NOT NULL,
    "documentNumber" VARCHAR(12) NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "spacesKey" VARCHAR(255) NOT NULL,
    "spacesUrl" VARCHAR(512) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" VARCHAR(64),
    "updated_by" VARCHAR(64),

    CONSTRAINT "hl_history_laboral_uploads_pkey" PRIMARY KEY ("id")
);
