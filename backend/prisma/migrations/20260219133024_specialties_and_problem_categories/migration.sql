-- CreateTable
CREATE TABLE "Specialization" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Specialization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemCategorySpecialization" (
    "problemCategoryId" TEXT NOT NULL,
    "specializationId" TEXT NOT NULL,

    CONSTRAINT "ProblemCategorySpecialization_pkey" PRIMARY KEY ("problemCategoryId","specializationId")
);

-- AddForeignKey
ALTER TABLE "Specialization" ADD CONSTRAINT "Specialization_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemCategory" ADD CONSTRAINT "ProblemCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemCategorySpecialization" ADD CONSTRAINT "ProblemCategorySpecialization_problemCategoryId_fkey" FOREIGN KEY ("problemCategoryId") REFERENCES "ProblemCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemCategorySpecialization" ADD CONSTRAINT "ProblemCategorySpecialization_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES "Specialization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
