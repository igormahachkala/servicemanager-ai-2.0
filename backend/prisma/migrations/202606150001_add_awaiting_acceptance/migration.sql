-- Client acceptance flow: new ticket status and attachment purpose.

-- AlterEnum: add AWAITING_ACCEPTANCE between IN_PROGRESS and DONE
ALTER TYPE "TicketStatus" ADD VALUE 'AWAITING_ACCEPTANCE' AFTER 'IN_PROGRESS';

-- AlterEnum: add DECLINE_REPORT for client rejection photos
ALTER TYPE "TicketAttachmentPurpose" ADD VALUE 'DECLINE_REPORT';
