import { prisma } from '@reachflow/db';
import { EnrollmentStatus } from '@reachflow/shared';

export function renderTemplate(template: string, contact: { firstName?: string | null; lastName?: string | null; company?: string | null; email?: string | null }): string {
  let output = template;
  output = output.replace(/\{\{\s*firstName\s*\}\}/gi, contact.firstName || '');
  output = output.replace(/\{\{\s*first_name\s*\}\}/gi, contact.firstName || '');
  output = output.replace(/\{\{\s*lastName\s*\}\}/gi, contact.lastName || '');
  output = output.replace(/\{\{\s*last_name\s*\}\}/gi, contact.lastName || '');
  output = output.replace(/\{\{\s*company\s*\}\}/gi, contact.company || 'your team');
  output = output.replace(/\{\{\s*email\s*\}\}/gi, contact.email || '');
  return output;
}

export async function processDueEnrollments(specificWorkspaceId?: string): Promise<{ processed: number; sent: number; completed: number }> {
  const now = new Date();

  const where: any = {
    status: EnrollmentStatus.ACTIVE,
    nextRunAt: { lte: now },
  };

  if (specificWorkspaceId) {
    where.workspaceId = specificWorkspaceId;
  }

  const dueEnrollments = await prisma.enrollment.findMany({
    where,
    include: {
      contact: true,
      sequence: {
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      },
    },
    take: 50,
  });

  let sentCount = 0;
  let completedCount = 0;

  for (const enrollment of dueEnrollments) {
    // Check if enrollment status is still ACTIVE
    if (enrollment.status !== EnrollmentStatus.ACTIVE) {
      continue;
    }

    const steps = enrollment.sequence.steps;
    const currentStep = steps.find((s) => s.stepOrder === enrollment.currentStepOrder);

    if (!currentStep) {
      // No current step found; mark completed
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: EnrollmentStatus.COMPLETED },
      });
      completedCount++;
      continue;
    }

    // Deterministic Idempotency Key: guarantee this step is never sent twice
    const idempotencyKey = `enrollment_${enrollment.id}_step_${currentStep.id}`;

    // Check if already sent
    const existingMessage = await prisma.emailMessage.findUnique({
      where: { idempotencyKey },
    });

    if (existingMessage) {
      console.log(`[SequenceEngine] Step already sent for key ${idempotencyKey}. Skipping duplicate.`);
      // Advance to next step if not already advanced
      const nextStep = steps.find((s) => s.stepOrder > currentStep.stepOrder);
      if (nextStep) {
        const nextRunAt = new Date(Date.now() + nextStep.delayHours * 60 * 60 * 1000);
        await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStepOrder: nextStep.stepOrder,
            nextRunAt,
          },
        });
      } else {
        await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { status: EnrollmentStatus.COMPLETED },
        });
        completedCount++;
      }
      continue;
    }

    // Render personalized email template
    const subject = renderTemplate(currentStep.subject, enrollment.contact);
    const body = renderTemplate(currentStep.body, enrollment.contact);

    // Save EmailMessage with unique idempotencyKey
    await prisma.emailMessage.create({
      data: {
        workspaceId: enrollment.workspaceId,
        enrollmentId: enrollment.id,
        sequenceStepId: currentStep.id,
        contactId: enrollment.contactId,
        idempotencyKey,
        subject,
        body,
        sentAt: new Date(),
      },
    });

    sentCount++;
    console.log(
      `📧 [ReachFlow Outbound Send] Step ${currentStep.stepOrder} of "${enrollment.sequence.name}" sent to ${enrollment.contact.email} | Subject: "${subject}"`
    );

    // Find subsequent step
    const nextStep = steps.find((s) => s.stepOrder > currentStep.stepOrder);

    if (nextStep) {
      // Calculate delay in hours (for demo, delayHours > 0 can be set, or tested immediately)
      const nextRunAt = new Date(Date.now() + nextStep.delayHours * 60 * 60 * 1000);
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStepOrder: nextStep.stepOrder,
          nextRunAt,
        },
      });
    } else {
      // Final step completed
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: EnrollmentStatus.COMPLETED,
        },
      });
      completedCount++;
    }
  }

  return {
    processed: dueEnrollments.length,
    sent: sentCount,
    completed: completedCount,
  };
}
