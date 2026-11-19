import { PrismaClient, Role, ContactStatus, DealStage, SequenceStatus, EnrollmentStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ReachFlow database seed...');

  // Clean existing data for clean demo state
  await prisma.emailMessage.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.sequenceStep.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contactTag.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Demo User
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@reachflow.io',
      passwordHash,
      firstName: 'Demo',
      lastName: 'User',
    },
  });

  // 2. Create Demo Workspace & Membership
  const demoWorkspace = await prisma.workspace.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp',
    },
  });

  await prisma.membership.create({
    data: {
      userId: demoUser.id,
      workspaceId: demoWorkspace.id,
      role: Role.OWNER,
    },
  });

  // 3. Create Tags
  const enterpriseTag = await prisma.tag.create({
    data: { workspaceId: demoWorkspace.id, name: 'Enterprise' },
  });
  const outboundTag = await prisma.tag.create({
    data: { workspaceId: demoWorkspace.id, name: 'Outbound' },
  });
  const warmTag = await prisma.tag.create({
    data: { workspaceId: demoWorkspace.id, name: 'Warm Lead' },
  });

  // 4. Create Contacts
  const alex = await prisma.contact.create({
    data: {
      workspaceId: demoWorkspace.id,
      email: 'alex.chen@innovate.io',
      firstName: 'Alex',
      lastName: 'Chen',
      company: 'Innovate AI',
      title: 'VP of Engineering',
      phone: '+1 (555) 234-5678',
      status: ContactStatus.ACTIVE,
      tags: {
        create: [{ tagId: enterpriseTag.id }, { tagId: outboundTag.id }],
      },
    },
  });

  const sarah = await prisma.contact.create({
    data: {
      workspaceId: demoWorkspace.id,
      email: 'sarah.jenkins@datadrive.com',
      firstName: 'Sarah',
      lastName: 'Jenkins',
      company: 'DataDrive Systems',
      title: 'Head of Sales',
      phone: '+1 (555) 345-6789',
      status: ContactStatus.ACTIVE,
      tags: {
        create: [{ tagId: warmTag.id }],
      },
    },
  });

  const marcus = await prisma.contact.create({
    data: {
      workspaceId: demoWorkspace.id,
      email: 'marcus.vance@cloudscale.net',
      firstName: 'Marcus',
      lastName: 'Vance',
      company: 'CloudScale Networks',
      title: 'CTO',
      phone: '+1 (555) 456-7890',
      status: ContactStatus.ACTIVE,
      tags: {
        create: [{ tagId: enterpriseTag.id }],
      },
    },
  });

  const elena = await prisma.contact.create({
    data: {
      workspaceId: demoWorkspace.id,
      email: 'elena.rostova@finpulse.io',
      firstName: 'Elena',
      lastName: 'Rostova',
      company: 'FinPulse Inc',
      title: 'Director of Operations',
      phone: '+1 (555) 567-8901',
      status: ContactStatus.ACTIVE,
      tags: {
        create: [{ tagId: outboundTag.id }, { tagId: warmTag.id }],
      },
    },
  });

  // 5. Create Deals across Kanban stages
  await prisma.deal.createMany({
    data: [
      {
        workspaceId: demoWorkspace.id,
        contactId: alex.id,
        title: 'Enterprise Annual License - Innovate AI',
        value: 36000,
        stage: DealStage.DEMO,
        position: 0,
        company: 'Innovate AI',
      },
      {
        workspaceId: demoWorkspace.id,
        contactId: sarah.id,
        title: 'Pilot Agreement - DataDrive Systems',
        value: 12000,
        stage: DealStage.QUALIFIED,
        position: 0,
        company: 'DataDrive Systems',
      },
      {
        workspaceId: demoWorkspace.id,
        contactId: elena.id,
        title: 'Expansion Tier - FinPulse Inc',
        value: 48000,
        stage: DealStage.NEGOTIATION,
        position: 0,
        company: 'FinPulse Inc',
      },
      {
        workspaceId: demoWorkspace.id,
        contactId: marcus.id,
        title: 'Security Add-on - CloudScale Networks',
        value: 15000,
        stage: DealStage.WON,
        position: 0,
        company: 'CloudScale Networks',
      },
      {
        workspaceId: demoWorkspace.id,
        title: 'Inbound Discovery - Apex Global',
        value: 8000,
        stage: DealStage.LEAD,
        position: 0,
        company: 'Apex Global',
      },
    ],
  });

  // 6. Create Outbound Sequence with Steps
  const sequence = await prisma.sequence.create({
    data: {
      workspaceId: demoWorkspace.id,
      name: 'High-Touch Executive Drip',
      status: SequenceStatus.ACTIVE,
      steps: {
        create: [
          {
            stepOrder: 1,
            delayHours: 0,
            subject: 'Quick question regarding your outbound stack',
            body: 'Hi {{firstName}},\n\nI noticed {{company}} is rapidly expanding its GTM team. How are you currently managing outbound sequence deliverability?\n\nBest,\nDemo User',
          },
          {
            stepOrder: 2,
            delayHours: 48,
            subject: 'Following up on my previous note',
            body: 'Hi {{firstName}},\n\nChecking back to see if you had a moment to review my prior note. Would love to share some insights on how peers in {{company}} are automating their sales pipelines.\n\nCheers,\nDemo User',
          },
          {
            stepOrder: 3,
            delayHours: 72,
            subject: 'Resource on scaling outbound conversions',
            body: 'Hi {{firstName}},\n\nSharing a quick benchmark report on outbound metrics. If this is not relevant right now, feel free to let me know!\n\nBest,\nDemo User',
          },
        ],
      },
    },
    include: {
      steps: true,
    },
  });

  // 7. Enroll Alex Chen in the Sequence
  await prisma.enrollment.create({
    data: {
      workspaceId: demoWorkspace.id,
      sequenceId: sequence.id,
      contactId: alex.id,
      currentStepOrder: 1,
      status: EnrollmentStatus.ACTIVE,
      nextRunAt: new Date(), // due immediately for demo execution
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log('Demo Login: demo@reachflow.io / Password123!');
  console.log(`Demo Workspace: ${demoWorkspace.name} (${demoWorkspace.slug})`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
