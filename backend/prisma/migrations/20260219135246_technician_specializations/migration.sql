-- CreateTable
CREATE TABLE "TechnicianSpecialization" (
    "userId" TEXT NOT NULL,
    "specializationId" TEXT NOT NULL,

    CONSTRAINT "TechnicianSpecialization_pkey" PRIMARY KEY ("userId","specializationId")
);

-- AddForeignKey
ALTER TABLE "TechnicianSpecialization" ADD CONSTRAINT "TechnicianSpecialization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianSpecialization" ADD CONSTRAINT "TechnicianSpecialization_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES "Specialization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
