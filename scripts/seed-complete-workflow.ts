import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CHECKLIST_ITEMS } from "../apps/web/lib/constants.js";
import { SCHEDULE_SEED } from "../prisma/seed-data/schedule.js";
import { ACTIVITY_SEED } from "../prisma/seed-data/activity.js";
import { REVIEW_SEED } from "../prisma/seed-data/reviews.js";

try {
  loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const prisma = new PrismaClient();

const HOD_CONFIG = {
  name: "Dr.Rama Gaikwad",
  email: "rama.gaikwad@abmspcoerpune.org",
  password: process.env.SEED_HOD_PASSWORD || "hod@apcoer12",
  mobile: "9000000001",
};

const GUIDES = [
  {
    name: "Prof. Rajesh Sharma",
    email: "prof.sharma@abmspcoerpune.org",
    password: "Password@123",
    mobile: "9822001122",
  },
  {
    name: "Prof. Sunita Patil",
    email: "prof.patil@abmspcoerpune.org",
    password: "Password@123",
    mobile: "9822001133",
  },
  {
    name: "Prof. Amit Kulkarni",
    email: "prof.kulkarni@abmspcoerpune.org",
    password: "Password@123",
    mobile: "9822001144",
  },
];

const STUDENTS = [
  // Group 1 Members
  {
    name: "Shreyas Deshmukh",
    email: "shreyas.deshmukh@abmspcoerpune.org",
    rollNo: "BE-COMP-401",
    examSeatNo: "B2025001",
    mobile: "9876543210",
    teResult: "8.85 CGPA",
    contribution: "System Architecture, Deep Learning Model Training, Backend Integration",
    photoUrl: "/media/group-members/cmv0x2kup000htmhlncftdvvv-1791548407989.jpg",
    groupNo: "COMP-BE-2025-01",
    isCreator: true,
  },
  {
    name: "Aarav Joshi",
    email: "aarav.joshi@abmspcoerpune.org",
    rollNo: "BE-COMP-402",
    examSeatNo: "B2025002",
    mobile: "9876543211",
    teResult: "8.52 CGPA",
    contribution: "Frontend UI/UX, Sheet Templates, PDF Puppeteer Pipeline",
    photoUrl: "/media/group-members/cmv0x2kup000itmhl0sxcc3nf-1791548500898.jpg",
    groupNo: "COMP-BE-2025-01",
    isCreator: false,
  },
  {
    name: "Neha Kulkarni",
    email: "neha.kulkarni@abmspcoerpune.org",
    rollNo: "BE-COMP-403",
    examSeatNo: "B2025003",
    mobile: "9876543212",
    teResult: "8.70 CGPA",
    contribution: "Agricultural Dataset Curation, Data Augmentation, Model Evaluation",
    photoUrl: "/media/group-members/cmv0x2kup000jtmhla7onvof1-1791550138705.png",
    groupNo: "COMP-BE-2025-01",
    isCreator: false,
  },
  {
    name: "Rohan Shinde",
    email: "rohan.shinde@abmspcoerpune.org",
    rollNo: "BE-COMP-404",
    examSeatNo: "B2025004",
    mobile: "9876543213",
    teResult: "8.40 CGPA",
    contribution: "IoT Sensor Node Setup, Unit and Integration Testing, Documentation",
    photoUrl: "/media/group-members/cmv0x2kup000ktmhlzlpz0naf-1791550151969.png",
    groupNo: "COMP-BE-2025-01",
    isCreator: false,
  },
  // Group 2 Members
  {
    name: "Priya Sawant",
    email: "priya.sawant@abmspcoerpune.org",
    rollNo: "BE-COMP-405",
    examSeatNo: "B2025005",
    mobile: "9876543214",
    teResult: "8.90 CGPA",
    contribution: "Cloud Architecture, MQTT Broker Setup, Smart Grid API Design",
    photoUrl: "/media/group-members/cmv0x2kup000htmhlncftdvvv-1791548407989.jpg",
    groupNo: "COMP-BE-2025-02",
    isCreator: true,
  },
  {
    name: "Aditya More",
    email: "aditya.more@abmspcoerpune.org",
    rollNo: "BE-COMP-406",
    examSeatNo: "B2025006",
    mobile: "9876543215",
    teResult: "8.25 CGPA",
    contribution: "Embedded Firmware, Energy Meter Interfacing, Hardware Calibration",
    photoUrl: "/media/group-members/cmv0x2kup000itmhl0sxcc3nf-1791548500898.jpg",
    groupNo: "COMP-BE-2025-02",
    isCreator: false,
  },
  {
    name: "Tanvi Pawar",
    email: "tanvi.pawar@abmspcoerpune.org",
    rollNo: "BE-COMP-407",
    examSeatNo: "B2025007",
    mobile: "9876543216",
    teResult: "8.65 CGPA",
    contribution: "Predictive Analytics, Energy Consumption Forecasting Models",
    photoUrl: "/media/group-members/cmv0x2kup000jtmhla7onvof1-1791550138705.png",
    groupNo: "COMP-BE-2025-02",
    isCreator: false,
  },
  {
    name: "Vikram Salunkhe",
    email: "vikram.salunkhe@abmspcoerpune.org",
    rollNo: "BE-COMP-408",
    examSeatNo: "B2025008",
    mobile: "9876543217",
    teResult: "8.30 CGPA",
    contribution: "Security Auditing, Load Testing, Final Documentation & Reports",
    photoUrl: "/media/group-members/cmv0x2kup000ktmhlzlpz0naf-1791550151969.png",
    groupNo: "COMP-BE-2025-02",
    isCreator: false,
  },
];

const MONTH_DATES: Record<string, string> = {
  june: "2025-06-25",
  july: "2025-07-22",
  august: "2025-08-20",
  september: "2025-09-18",
  october: "2025-10-15",
  november: "2025-11-20",
  december: "2025-12-18",
  january: "2026-01-22",
  february: "2026-02-19",
  march: "2026-03-19",
  "may-june": "2026-05-14",
};

async function main() {
  console.log("================================================================");
  console.log("Seeding Full Complete Data for Workflow & PDF Allow/Download...");
  console.log("================================================================");

  const now = new Date();
  const demoHash = await bcrypt.hash("Password@123", 10);
  const hodHash = await bcrypt.hash(HOD_CONFIG.password, 10);

  // 1. Ensure HOD exists
  const hod = await prisma.user.upsert({
    where: { email: HOD_CONFIG.email },
    update: {
      name: HOD_CONFIG.name,
      role: "HOD",
      mobile: HOD_CONFIG.mobile,
      passwordHash: hodHash,
      active: true,
      emailVerifiedAt: now,
    },
    create: {
      name: HOD_CONFIG.name,
      email: HOD_CONFIG.email,
      role: "HOD",
      mobile: HOD_CONFIG.mobile,
      passwordHash: hodHash,
      emailVerifiedAt: now,
      createdVia: "HOD_CREATED",
      active: true,
    },
  });
  console.log(`[OK] HOD upserted: ${hod.email}`);

  // 2. Ensure Guides exist
  const guideMap = new Map<string, { id: string; name: string }>();
  for (const guide of GUIDES) {
    const user = await prisma.user.upsert({
      where: { email: guide.email },
      update: {
        name: guide.name,
        role: "GUIDE",
        mobile: guide.mobile,
        passwordHash: demoHash,
        active: true,
        emailVerifiedAt: now,
      },
      create: {
        name: guide.name,
        email: guide.email,
        role: "GUIDE",
        mobile: guide.mobile,
        passwordHash: demoHash,
        emailVerifiedAt: now,
        createdVia: "HOD_CREATED",
        active: true,
      },
    });
    guideMap.set(guide.email, { id: user.id, name: user.name });
    console.log(`[OK] Guide upserted: ${user.name} (${user.email})`);
  }

  // 3. Ensure Students exist
  const studentMap = new Map<string, { id: string; name: string; rollNo: string }>();
  for (const student of STUDENTS) {
    const user = await prisma.user.upsert({
      where: { email: student.email },
      update: {
        name: student.name,
        role: "STUDENT",
        rollNo: student.rollNo,
        mobile: student.mobile,
        passwordHash: demoHash,
        active: true,
        emailVerifiedAt: now,
      },
      create: {
        name: student.name,
        email: student.email,
        role: "STUDENT",
        rollNo: student.rollNo,
        mobile: student.mobile,
        passwordHash: demoHash,
        emailVerifiedAt: now,
        createdVia: "SELF_SIGNUP",
        active: true,
      },
    });
    studentMap.set(student.email, { id: user.id, name: user.name, rollNo: student.rollNo });
  }
  console.log(`[OK] 8 Students upserted.`);

  // 4. Ensure System Templates (Schedule, Activity, Reviews)
  const scheduleCount = await prisma.scheduleItem.count();
  if (scheduleCount === 0) {
    console.log("Seeding schedule items...");
    for (const row of SCHEDULE_SEED) {
      await prisma.scheduleItem.upsert({
        where: { term_sortOrder: { term: row.term, sortOrder: row.sortOrder } },
        update: { description: row.description },
        create: { term: row.term, sortOrder: row.sortOrder, description: row.description },
      });
    }
  }

  const activityTemplateCount = await prisma.activityTemplate.count();
  if (activityTemplateCount === 0) {
    console.log("Seeding activity templates...");
    for (const row of ACTIVITY_SEED) {
      await prisma.activityTemplate.upsert({
        where: { month_sortOrder: { month: row.month, sortOrder: row.sortOrder } },
        update: { text: row.text },
        create: { month: row.month, sortOrder: row.sortOrder, text: row.text },
      });
    }
  }

  const reviewTemplateCount = await prisma.reviewTemplate.count();
  if (reviewTemplateCount === 0) {
    console.log("Seeding review templates and questions...");
    for (const template of REVIEW_SEED) {
      const saved = await prisma.reviewTemplate.upsert({
        where: { reviewType: template.reviewType },
        update: { title: template.title, term: template.term, order: template.order, hasDateColumn: template.hasDateColumn },
        create: {
          term: template.term,
          reviewType: template.reviewType,
          title: template.title,
          order: template.order,
          hasDateColumn: template.hasDateColumn,
        },
      });
      for (let index = 0; index < template.questions.length; index += 1) {
        const text = template.questions[index]!;
        await prisma.reviewQuestion.upsert({
          where: { templateId_questionNo: { templateId: saved.id, questionNo: index + 1 } },
          update: { text },
          create: { templateId: saved.id, questionNo: index + 1, text },
        });
      }
    }
  }

  // Load templates into memory for fast batch creation
  const activityTemplates = await prisma.activityTemplate.findMany({ orderBy: [{ month: "asc" }, { sortOrder: "asc" }] });
  const reviewTemplatesWithQuestions = await prisma.reviewTemplate.findMany({
    include: { questions: { orderBy: { questionNo: "asc" } } },
    orderBy: { order: "asc" },
  });

  // 5. Clean up old groups if present
  const targetGroupNos = ["COMP-BE-2025-01", "COMP-BE-2025-02"];
  const existingGroups = await prisma.group.findMany({ where: { groupNo: { in: targetGroupNos } }, select: { id: true } });
  if (existingGroups.length > 0) {
    const existingIds = existingGroups.map((g) => g.id);
    console.log(`Cleaning up existing demo groups (${existingIds.join(", ")})...`);
    await prisma.activityEntryHistory.deleteMany({ where: { entry: { groupId: { in: existingIds } } } });
    await prisma.activityEntry.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.reviewScore.deleteMany({ where: { form: { groupId: { in: existingIds } } } });
    await prisma.reviewForm.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.marksSheet.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.examinerFeedback.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.checklist.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.competition.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.paperPublication.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.sponsoredMeeting.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.sponsorFeedback.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.contentPage.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.topicProposal.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.groupInvite.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.groupMember.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.pdfExport.deleteMany({ where: { groupId: { in: existingIds } } });
    await prisma.group.deleteMany({ where: { id: { in: existingIds } } });
  }

  // 6. Define Group 1 and Group 2 configurations
  const groupConfigs = [
    {
      groupNo: "COMP-BE-2025-01",
      projectTitle: "Autonomous AI-Driven Crop Disease Detection and Precision Farming Advisory System",
      area: "Artificial Intelligence / Deep Learning / IoT",
      guideEmail: "prof.sharma@abmspcoerpune.org",
      creatorEmail: "shreyas.deshmukh@abmspcoerpune.org",
      // Status PDF_ALLOWED and pdfPermission TRUE -> Ready for Student to download directly!
      status: "PDF_ALLOWED",
      pdfPermission: true,
      topic1: {
        title: "Autonomous AI-Driven Crop Disease Detection and Precision Farming Advisory System",
        description: "An edge-AI vision system deployed on mobile and drone hardware that classifies foliar diseases across 14 commercial crops with 97.4% precision and provides localized treatment schedules in Marathi and English.",
      },
      topic2: {
        title: "Blockchain Supply Chain Provenance for High-Value Cash Crops",
        description: "Permissioned hyperledger solution ensuring tamper-proof origin tracing and automated micro-payments for organic farmer cooperatives.",
      },
      competition1: {
        name: "National Level Project Competition DIPEX 2026",
        date: "2026-02-20",
        collegeAndLevel: "State Level / MIT WPU Pune",
        type: "DEMO",
        award: "First Prize (Cash Award Rs. 15,000)",
        certificateUrl: "/media/certificates/cert-cmv17d030005tt6lwp7gcdwpv-1791564699226.jpg",
      },
      competition2: {
        name: "Techno-Social Innovation Hackathon 2026",
        date: "2026-03-12",
        collegeAndLevel: "National Level / COEP Technological University",
        type: "POSTER",
        award: "Best Innovation Award",
        certificateUrl: "/media/certificates/cert-cmv17d030005tt6lwp7gcdwpv-1791564699226.jpg",
      },
      paper: {
        title: "Deep Residual Learning for Early Foliar Disease Classification in Solanaceae Crops",
        conference: "IEEE 7th International Conference on Pervasive Computing (ICPC 2026)",
        issn: "2379-8351",
        volIssue: "Vol. 14, Issue 2",
        pageNo: "114-121",
        fileUrl: "/media/papers/paper-cmv21wqbx004yik35k7am81tk-1791616006540.jpg",
      },
    },
    {
      groupNo: "COMP-BE-2025-02",
      projectTitle: "Smart Campus Energy Management and Predictive HVAC Optimization System",
      area: "Internet of Things / Smart Grid / Cloud Computing",
      guideEmail: "prof.patil@abmspcoerpune.org",
      creatorEmail: "priya.sawant@abmspcoerpune.org",
      // Status READY_FOR_PDF and pdfPermission FALSE -> Perfect for HOD to test the "Allow PDF" toggle!
      status: "READY_FOR_PDF",
      pdfPermission: false,
      topic1: {
        title: "Smart Campus Energy Management and Predictive HVAC Optimization System",
        description: "An intelligent IoT sensor network combined with deep reinforcement learning to dynamically schedule HVAC cooling and electrical load distribution across academic building clusters, achieving 23% energy reduction.",
      },
      topic2: {
        title: "Automated Microgrid Fault Isolation and Self-Healing Protocol",
        description: "Decentralized protection coordination scheme using multi-agent systems for rapid restoration of power in educational campus microgrids.",
      },
      competition1: {
        name: "Maharashtra State Innovation Summit 2026",
        date: "2026-01-28",
        collegeAndLevel: "State Level / Pune University (SPPU)",
        type: "DEMO",
        award: "Second Prize (Cash Award Rs. 10,000)",
        certificateUrl: "/media/certificates/cert-cmv17d030005tt6lwp7gcdwpv-1791564699226.jpg",
      },
      competition2: {
        name: "Green Energy Tech Expo 2026",
        date: "2026-03-05",
        collegeAndLevel: "National Level / VJTI Mumbai",
        type: "PAPER_PRESENTATION",
        award: "Consolation Certificate",
        certificateUrl: "/media/certificates/cert-cmv17d030005tt6lwp7gcdwpv-1791564699226.jpg",
      },
      paper: {
        title: "Multi-Agent Deep Q-Learning for HVAC Energy Conservation in Smart Institutional Campuses",
        conference: "ACM/IEEE International Conference on Smart Grid Communications (SmartGridComm 2026)",
        issn: "2160-5025",
        volIssue: "Vol. 9, Issue 3",
        pageNo: "88-95",
        fileUrl: "/media/papers/paper-cmv21wqbx004yik35k7am81tk-1791616006540.jpg",
      },
    },
  ];

  for (const cfg of groupConfigs) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Creating Complete Data for Group: ${cfg.groupNo}...`);
    console.log(`----------------------------------------------------------------`);

    const guide = guideMap.get(cfg.guideEmail)!;
    const creatorUser = studentMap.get(cfg.creatorEmail)!;
    const groupStudents = STUDENTS.filter((s) => s.groupNo === cfg.groupNo);

    // 6a. Create Group
    const group = await prisma.group.create({
      data: {
        groupNo: cfg.groupNo,
        academicYear: "2025-26",
        department: "Computer Engineering",
        projectTitle: cfg.projectTitle,
        area: cfg.area,
        status: cfg.status,
        pdfPermission: cfg.pdfPermission,
        pdfPermissionBy: cfg.pdfPermission ? hod.id : null,
        pdfPermissionAt: cfg.pdfPermission ? now : null,
        creatorId: creatorUser.id,
        guideId: guide.id,
        isSponsored: false,
      },
    });
    console.log(`[OK] Group created: id=${group.id}, code=${group.code}`);

    // 6b. Add 4 Members with complete profiles, rules ack, undertaking accepted
    const memberRecords: { id: string; userId: string; name: string }[] = [];
    for (const s of groupStudents) {
      const u = studentMap.get(s.email)!;
      const member = await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: u.id,
          name: s.name,
          teResult: s.teResult,
          rollNo: s.rollNo,
          examSeatNo: s.examSeatNo,
          mobile: s.mobile,
          email: s.email,
          contribution: s.contribution,
          photoUrl: s.photoUrl,
          memberType: s.isCreator ? "creator" : "member",
          rulesAckAt: now,
          undertakingAcceptedAt: now,
        },
      });
      memberRecords.push({ id: member.id, userId: u.id, name: s.name });
    }
    console.log(`[OK] 4 Members created with rules and undertaking acknowledged.`);

    // 6c. Topics: Topic 1 APPROVED by HOD, Topic 2 DRAFT
    await prisma.topicProposal.createMany({
      data: [
        {
          groupId: group.id,
          topicNo: 1,
          title: cfg.topic1.title,
          description: cfg.topic1.description,
          significance: 9,
          innovativeness: 9,
          scope: 9,
          feasibility: 9,
          guideRecommendation: "YES",
          status: "APPROVED",
          approvedById: hod.id,
          approvedAt: now,
        },
        {
          groupId: group.id,
          topicNo: 2,
          title: cfg.topic2.title,
          description: cfg.topic2.description,
          status: "DRAFT",
        },
      ],
    });
    console.log(`[OK] Topic 1 APPROVED and Topic 2 created.`);

    // 6d. Activity Entries: All 53 rows GUIDE_VERIFIED and COMPLETE
    const activityData = activityTemplates.map((t) => ({
      groupId: group.id,
      templateId: t.id,
      month: t.month,
      date: MONTH_DATES[t.month] || "2025-10-15",
      status: "GUIDE_VERIFIED",
      statusText: "COMPLETE",
      studentConfirmedAt: now,
      studentConfirmedById: creatorUser.id,
      guideVerifiedAt: now,
      guideVerifiedById: guide.id,
    }));
    await prisma.activityEntry.createMany({ data: activityData });
    console.log(`[OK] ${activityData.length} Activity Entries created (all GUIDE_VERIFIED COMPLETE).`);

    // 6e. Content Pages: RTM, COST, NOTE
    await prisma.contentPage.createMany({
      data: [
        {
          groupId: group.id,
          type: "RTM",
          sortOrder: 0,
          richText: `<h3>Requirement Traceability Matrix (${cfg.groupNo})</h3>
<p>Complete traceability mapping from system specifications to architectural modules, ML pipelines, and test suites.</p>
<ul>
  <li><strong>REQ-01:</strong> Sensor telemetry ingestion mapped to MQTT Gateway & Data Pipeline.</li>
  <li><strong>REQ-02:</strong> High accuracy inference module mapped to ResNet / RL Controller.</li>
  <li><strong>REQ-03:</strong> Farmer/Operator advisory dashboard with multi-language notification dispatch.</li>
</ul>`,
          fileUrl: "/media/content/rtm-cmv0x2kup000etmhl2qvdm6qz-1791564761942.pdf",
        },
        {
          groupId: group.id,
          type: "COST",
          sortOrder: 0,
          richText: `<h3>Project Cost Estimation (${cfg.groupNo})</h3>
<p>Budget summary for hardware prototypes, embedded sensors, cloud compute instances, and field trials:</p>
<table border="1" style="width: 100%; border-collapse: collapse;">
  <tr><th>Item</th><th>Quantity</th><th>Unit Cost</th><th>Total (INR)</th></tr>
  <tr><td>Microcontroller / Edge Compute Unit</td><td>2</td><td>Rs. 2,800</td><td>Rs. 5,600</td></tr>
  <tr><td>Sensor Array & Interfacing Modules</td><td>4</td><td>Rs. 950</td><td>Rs. 3,800</td></tr>
  <tr><td>Cloud Hosting & Storage Subscriptions</td><td>1</td><td>Rs. 2,500</td><td>Rs. 2,500</td></tr>
  <tr><td>Prototype Enclosure & Fabrication</td><td>2</td><td>Rs. 800</td><td>Rs. 1,600</td></tr>
  <tr><th colspan="3" style="text-align: right;">Total:</th><th>Rs. 13,500</th></tr>
</table>`,
          fileUrl: "/media/content/cost-cmv0x2kup000etmhl2qvdm6qz-1791564779401.pdf",
        },
        {
          groupId: group.id,
          type: "NOTE",
          sortOrder: 0,
          richText: `<p>Project logbook notes: Weekly sync with internal guide ${guide.name} conducted diligently throughout academic semesters I and II. Milestones, feedback, and corrective actions verified per departmental standards.</p>`,
        },
      ],
    });
    console.log(`[OK] Content Pages (RTM, COST, NOTE) created.`);

    // 6f. Reviews: All 7 Review Forms with all scores APPROVED
    for (const template of reviewTemplatesWithQuestions) {
      const form = await prisma.reviewForm.create({
        data: {
          groupId: group.id,
          templateId: template.id,
          guideId: guide.id,
          status: "APPROVED",
          submittedById: guide.id,
          submittedAt: now,
          approvedById: guide.id,
          approvedAt: now,
          remarkAndSuggestions: "Work carried out as per project schedule. Methodologies and artifacts are thoroughly validated.",
        },
      });

      const scoresData = template.questions.map((q) => ({
        formId: form.id,
        questionId: q.id,
        remark: "Satisfactory and verified by guide",
        grade: "9/10",
        date: template.hasDateColumn ? "2026-02-15" : null,
        guideSignedAt: now,
        guideSignedById: guide.id,
      }));
      await prisma.reviewScore.createMany({ data: scoresData });
    }
    console.log(`[OK] 7 Review Forms and all Review Scores created (all APPROVED).`);

    // 6g. Evaluation Sheets: Mock Evaluation (Term-I) & Final Evaluation (Term-II)
    const mockComponents = [
      { problem: 5, literature: 5, analysis: 5, modeling: 9, planning: 5, presentation: 9, report: 9 }, // total 47
      { problem: 4, literature: 5, analysis: 5, modeling: 9, planning: 4, presentation: 9, report: 9 }, // total 45
      { problem: 5, literature: 4, analysis: 5, modeling: 9, planning: 5, presentation: 9, report: 9 }, // total 46
      { problem: 4, literature: 4, analysis: 5, modeling: 8, planning: 5, presentation: 9, report: 9 }, // total 44
    ];
    const finalComponents = [
      { modeling: 10, coding: 38, testing: 10, understanding: 10, teamwork: 10, demo: 9, documents: 9 }, // total 96
      { modeling: 9, coding: 37, testing: 9, understanding: 9, teamwork: 10, demo: 9, documents: 9 },   // total 92
      { modeling: 9, coding: 38, testing: 9, understanding: 9, teamwork: 10, demo: 9, documents: 9 },   // total 93
      { modeling: 9, coding: 36, testing: 9, understanding: 9, teamwork: 9, demo: 9, documents: 9 },    // total 90
    ];

    for (let i = 0; i < memberRecords.length; i += 1) {
      const mem = memberRecords[i]!;
      const mComp = mockComponents[i]!;
      const mTotal = Object.values(mComp).reduce((a, b) => a + b, 0);
      await prisma.marksSheet.create({
        data: {
          groupId: group.id,
          memberId: mem.id,
          kind: "MOCK_T1",
          components: JSON.stringify(mComp),
          total: mTotal,
          status: "APPROVED",
          guideId: guide.id,
          approvedById: hod.id,
          approvedAt: now,
        },
      });

      const fComp = finalComponents[i]!;
      const fTotal = Object.values(fComp).reduce((a, b) => a + b, 0);
      await prisma.marksSheet.create({
        data: {
          groupId: group.id,
          memberId: mem.id,
          kind: "FINAL_T2",
          components: JSON.stringify(fComp),
          total: fTotal,
          status: "APPROVED",
          guideId: guide.id,
          approvedById: hod.id,
          approvedAt: now,
        },
      });
    }
    console.log(`[OK] Mock (50) and Final (100) Marks Sheets created for all members (all APPROVED).`);

    // 6h. Examiner Feedback: Term-I and Term-II
    await prisma.examinerFeedback.createMany({
      data: [
        {
          groupId: group.id,
          term: "TERM_I",
          answers: JSON.stringify(["Excellent", "Good", "Excellent", "Good", "Excellent", "Good", "Good", "Excellent", "Good"]),
          projectTitle: cfg.projectTitle,
          remarks: "Solid problem statement, thorough literature review, and well-structured design documents.",
          date: "2025-12-15",
          externalName: "Dr. K. R. Sharma",
          internalName: guide.name,
          signedAt: now,
        },
        {
          groupId: group.id,
          term: "TERM_II",
          answers: JSON.stringify(["Excellent", "Excellent", "Good", "Excellent", "Good", "Excellent", "Excellent", "Good", "Excellent"]),
          projectTitle: cfg.projectTitle,
          remarks: "Exceptional working model, comprehensive testing, and clear practical impact for end users.",
          date: "2026-04-25",
          externalName: "Dr. K. R. Sharma",
          internalName: guide.name,
          signedAt: now,
        },
      ],
    });
    console.log(`[OK] External Examiner Feedback (Term-I & Term-II) created.`);

    // 6i. Checklists: Term-I and Term-II with all items checked
    const term1Items = CHECKLIST_ITEMS.TERM_I.map((text) => ({ text, checked: true }));
    const term2Items = CHECKLIST_ITEMS.TERM_II.map((text) => ({ text, checked: true }));
    await prisma.checklist.createMany({
      data: [
        { groupId: group.id, term: "TERM_I", items: JSON.stringify(term1Items) },
        { groupId: group.id, term: "TERM_II", items: JSON.stringify(term2Items) },
      ],
    });
    console.log(`[OK] Submission Checklists (Term-I & Term-II) created (all items checked).`);

    // 6j. Competitions & Papers
    await prisma.competition.createMany({
      data: [
        {
          groupId: group.id,
          name: cfg.competition1.name,
          date: cfg.competition1.date,
          collegeAndLevel: cfg.competition1.collegeAndLevel,
          type: cfg.competition1.type,
          award: cfg.competition1.award,
          certificateUrl: cfg.competition1.certificateUrl,
        },
        {
          groupId: group.id,
          name: cfg.competition2.name,
          date: cfg.competition2.date,
          collegeAndLevel: cfg.competition2.collegeAndLevel,
          type: cfg.competition2.type,
          award: cfg.competition2.award,
          certificateUrl: cfg.competition2.certificateUrl,
        },
      ],
    });
    await prisma.paperPublication.create({
      data: {
        groupId: group.id,
        title: cfg.paper.title,
        conference: cfg.paper.conference,
        issn: cfg.paper.issn,
        volIssue: cfg.paper.volIssue,
        pageNo: cfg.paper.pageNo,
        fileUrl: cfg.paper.fileUrl,
      },
    });
    console.log(`[OK] Competitions (2) and Paper Publication (1) created.`);
  }

  console.log("\n================================================================");
  console.log("Verifying Completion Status for Seeded Groups...");
  console.log("================================================================");

  // Import completion engine directly from API module
  const { getGroupCompletion } = await import("../apps/api/src/completion/index.js");

  const seededGroups = await prisma.group.findMany({
    where: { groupNo: { in: targetGroupNos } },
    select: { id: true, groupNo: true, status: true, pdfPermission: true },
    orderBy: { groupNo: "asc" },
  });

  for (const g of seededGroups) {
    const comp = await getGroupCompletion(g.id);
    console.log(`Group: ${g.groupNo} (${g.id})`);
    console.log(`  - Completion: ${comp.percent}%`);
    console.log(`  - Complete:   ${comp.complete}`);
    console.log(`  - Missing:    [${comp.missing.join(", ")}]`);
    console.log(`  - Status:     ${g.status}`);
    console.log(`  - PDF Allow:  ${g.pdfPermission}`);
  }

  console.log("\n================================================================");
  console.log("SEEDING COMPLETE! ALL TEST ACCOUNTS READY:");
  console.log("----------------------------------------------------------------");
  console.log("1. HOD Account:");
  console.log(`   Email:    ${HOD_CONFIG.email}`);
  console.log(`   Password: ${HOD_CONFIG.password}`);
  console.log("\n2. Guide Accounts (Password: Password@123):");
  for (const g of GUIDES) {
    console.log(`   - ${g.name}: ${g.email}`);
  }
  console.log("\n3. Student Accounts (Password: Password@123):");
  console.log("   Group 1 (PDF Download Ready: status=PDF_ALLOWED, pdfPermission=true):");
  for (const s of STUDENTS.filter((s) => s.groupNo === "COMP-BE-2025-01")) {
    console.log(`   - ${s.name} (${s.rollNo}): ${s.email}`);
  }
  console.log("\n   Group 2 (HOD PDF Toggle Ready: status=READY_FOR_PDF, pdfPermission=false):");
  for (const s of STUDENTS.filter((s) => s.groupNo === "COMP-BE-2025-02")) {
    console.log(`   - ${s.name} (${s.rollNo}): ${s.email}`);
  }
  console.log("================================================================\n");
}

main()
  .catch((err) => {
    console.error("Seeding error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
