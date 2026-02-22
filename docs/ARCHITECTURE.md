# ARCHITECTURE — ServiceManager.AI

## Modules (NestJS)
- AuthModule
- UsersModule
- CompanyModule
- SpecializationsModule
- ProblemCategoriesModule
- TechniciansModule
- TicketsModule
- PrismaModule

## Multi-tenant
All domain data is scoped by companyId.
JWT payload includes companyId; controllers use req.user.companyId for queries.

## DB entities (Prisma)
- Company: { id, name, autoAssignEnabled }
- User: { id, companyId, email, password, role }
- Specialization: { id, companyId, name, isActive }
- ProblemCategory: { id, companyId, name, instructions, isActive }
- ProblemCategorySpecialization (M:N)
- TechnicianSpecialization (M:N between User and Specialization)
- Ticket: { id, companyId, parentId?, requesterName, requesterPhone, address, pointName, problemCategoryId, problemText, urgency, status, slaMinutes, assignedTechnicianId? }

## Ticket assignment
1) Find ProblemCategory -> specializationIds
2) Find technicians who have any of those specializationIds
3) If company.autoAssignEnabled and candidates exist -> assign first candidate (deterministic for MVP)
4) Otherwise ticket remains NEW, candidates returned for dispatcher selection

## Parent/Child tickets
Child ticket:
- has parentId
- copies requesterName/requesterPhone/address/pointName from parent
- independent status and SLA
