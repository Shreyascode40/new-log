import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CHECKLIST_ITEMS } from "../apps/web/lib/constants.js";

try {
  loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const prisma = new PrismaClient();

export const DEMO_CONFIG = {
  groupNo: "DEMO-01",
  projectTitle: "AI-Powered Plant Pathology & Crop Disease Surveillance Platform",
  area: "Artificial Intelligence / Deep Learning / Edge Computing",
  guide: {
    name: "Prof. Demo Guide",
    email: "demo.guide@apcoer.edu.in",
    mobile: "9822998877",
  },
  students: [
    {
      name: "Aarav Sharma",
      email: "demo.student1@apcoer.edu.in",
      rollNo: "BE-DEMO-01",
      examSeatNo: "DEMO-2025-01",
      mobile: "9876500001",
      teResult: "8.95 CGPA",
      contribution: "Deep Learning Model Pipeline & Edge Inference Optimization",
      photoUrl: "/media/group-members/cmv0x2kup000htmhlncftdvvv-1791548407989.jpg",
      isCreator: true,
    },
    {
      name: "Bhavya Patel",
      email: "demo.student2@apcoer.edu.in",
      rollNo: "BE-DEMO-02",
      examSeatNo: "DEMO-2025-02",
      mobile: "9876500002",
      teResult: "8.60 CGPA",
      contribution: "Frontend Dashboard UI/UX & PDF Export Generation",
      photoUrl: "/media/group-members/cmv0x2kup000itmhl0sxcc3nf-1791548500898.jpg",
      isCreator: false,
    },
    {
      name: "Chirag Deshmukh",
      email: "demo.student3@apcoer.edu.in",
      rollNo: "BE-DEMO-03",
      examSeatNo: "DEMO-2025-03",
      mobile: "9876500003",
      teResult: "8.75 CGPA",
      contribution: "Dataset Curation, Data Augmentation & Field Trials",
      photoUrl: "/media/group-members/cmv0x2kup000jtmhla7onvof1-1791550138705.png",
      isCreator: false,
    },
    {
      name: "Divya Kulkarni",
      email: "demo.student4@apcoer.edu.in",
      rollNo: "BE-DEMO-04",
      examSeatNo: "DEMO-2025-04",
      mobile: "9876500004",
      teResult: "8.50 CGPA",
      contribution: "IoT Sensor Node Interfacing & Testing Suite",
      photoUrl: "/media/group-members/cmv0x2kup000ktmhlzlpz0naf-1791550151969.png",
      isCreator: false,
    },
  ],
  competitions: [
    {
      name: "National Level Project Competition DIPEX 2026",
      date: "2026-02-20",
      collegeAndLevel: "State Level / MIT WPU Pune",
      type: "DEMO",
      award: "First Prize (Cash Award Rs. 15,000)",
      certificateUrl: "/media/certificates/cert-cmv17d030005tt6lwp7gcdwpv-1791564699226.jpg",
    },
    {
      name: "Techno-Social Innovation Hackathon 2026",
      date: "2026-03-12",
      collegeAndLevel: "National Level / COEP Technological University",
      type: "POSTER",
      award: "Best Innovation Award",
      certificateUrl: "/media/certificates/cert-cmv17d030005tt6lwp7gcdwpv-1791564699226.jpg",
    },
  ],
  paper: {
    title: "Deep Residual Learning for Early Foliar Disease Classification in Solanaceae Crops",
    conference: "IEEE 7th International Conference on Pervasive Computing (ICPC 2026)",
    issn: "2379-8351",
    volIssue: "Vol. 14, Issue 2",
    pageNo: "114-121",
    fileUrl: "/media/papers/paper-cmv21wqbx004yik35k7am81tk-1791616006540.jpg",
  },
};

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

export async function removeDemoGroup() {
  console.log(`[CLEANUP] Checking for existing demo group ${DEMO_CONFIG.groupNo}...`);
  const existing = await prisma.group.findFirst({
    where: { groupNo: DEMO_CONFIG.groupNo },
    select: { id: true },
  });

  if (existing) {
    const id = existing.id;
    console.log(`[CLEANUP] Removing previous demo group records (id: ${id})...`);
    await prisma.activityEntryHistory.deleteMany({ where: { entry: { groupId: id } } });
    await prisma.activityEntry.deleteMany({ where: { groupId: id } });
    await prisma.reviewScore.deleteMany({ where: { form: { groupId: id } } });
    await prisma.reviewForm.deleteMany({ where: { groupId: id } });
    await prisma.marksSheet.deleteMany({ where: { groupId: id } });
    await prisma.examinerFeedback.deleteMany({ where: { groupId: id } });
    await prisma.checklist.deleteMany({ where: { groupId: id } });
    await prisma.competition.deleteMany({ where: { groupId: id } });
    await prisma.paperPublication.deleteMany({ where: { groupId: id } });
    await prisma.contentPage.deleteMany({ where: { groupId: id } });
    await prisma.topicProposal.deleteMany({ where: { groupId: id } });
    await prisma.groupInvite.deleteMany({ where: { groupId: id } });
    await prisma.groupMember.deleteMany({ where: { groupId: id } });
    await prisma.pdfExport.deleteMany({ where: { groupId: id } });
    await prisma.group.delete({ where: { id } });
    console.log(`[CLEANUP] Demo group ${DEMO_CONFIG.groupNo} removed.`);
  }

  // Remove demo users if present
  const demoEmails = [
    DEMO_CONFIG.guide.email,
    ...DEMO_CONFIG.students.map((s) => s.email),
  ];
  const deletedUsers = await prisma.user.deleteMany({
    where: { email: { in: demoEmails } },
  });
  if (deletedUsers.count > 0) {
    console.log(`[CLEANUP] Removed ${deletedUsers.count} demo user accounts.`);
  }
}

export async function seedDemoGroup() {
  console.log("==================================================================");
  console.log("Seeding Isolated Removable Demo Group with Photos, Papers & PDF...");
  console.log("==================================================================");

  // 1. Clean up only prior demo group
  await removeDemoGroup();

  const now = new Date();
  const passwordHash = await bcrypt.hash("Password@123", 10);

  // 2. Find existing HOD (read-only query; NO modification to existing HOD)
  const hod = await prisma.user.findFirst({ where: { role: "HOD" } });
  if (!hod) throw new Error("No HOD user found in database!");
  console.log(`[INFO] Found HOD: ${hod.name} (${hod.email})`);

  // 3. Create Demo Guide
  const demoGuide = await prisma.user.create({
    data: {
      name: DEMO_CONFIG.guide.name,
      email: DEMO_CONFIG.guide.email,
      role: "GUIDE",
      mobile: DEMO_CONFIG.guide.mobile,
      passwordHash,
      emailVerifiedAt: now,
      createdVia: "HOD_CREATED",
      active: true,
    },
  });
  console.log(`[OK] Demo Guide created: ${demoGuide.name} (${demoGuide.email})`);

  // 4. Create Demo Students
  const studentMap = new Map<string, { id: string; name: string }>();
  for (const s of DEMO_CONFIG.students) {
    const u = await prisma.user.create({
      data: {
        name: s.name,
        email: s.email,
        role: "STUDENT",
        rollNo: s.rollNo,
        mobile: s.mobile,
        passwordHash,
        emailVerifiedAt: now,
        createdVia: "SELF_SIGNUP",
        active: true,
      },
    });
    studentMap.set(s.email, { id: u.id, name: u.name });
    console.log(`[OK] Demo Student created: ${u.name} (${u.email}) [${s.rollNo}]`);
  }

  const creatorUser = studentMap.get(DEMO_CONFIG.students[0]!.email)!;

  // 5. Create Demo Group
  const group = await prisma.group.create({
    data: {
      groupNo: DEMO_CONFIG.groupNo,
      academicYear: "2025-26",
      department: "Computer Engineering",
      projectTitle: DEMO_CONFIG.projectTitle,
      area: DEMO_CONFIG.area,
      status: "PDF_ALLOWED",
      pdfPermission: true,
      pdfPermissionBy: hod.id,
      pdfPermissionAt: now,
      creatorId: creatorUser.id,
      guideId: demoGuide.id,
      isSponsored: false,
    },
  });
  console.log(`[OK] Demo Group created: id=${group.id}, groupNo=${group.groupNo}, code=${group.code}`);

  // 6. Create 4 Members with Photos, Rules Ack, Undertaking Accepted
  const memberRecords: { id: string; userId: string; name: string }[] = [];
  for (const s of DEMO_CONFIG.students) {
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
  console.log(`[OK] 4 Members created with validated photos and signatures.`);

  // 7. Topics: Topic 1 APPROVED, Topic 2 DRAFT
  await prisma.topicProposal.createMany({
    data: [
      {
        groupId: group.id,
        topicNo: 1,
        title: DEMO_CONFIG.projectTitle,
        description: "An edge-AI vision system deployed on mobile and drone hardware that classifies foliar diseases across commercial crops with 97.4% precision and provides localized treatment recommendations.",
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
        title: "Blockchain Supply Chain Provenance for High-Value Cash Crops",
        description: "Permissioned hyperledger solution ensuring tamper-proof origin tracing and automated micro-payments.",
        status: "DRAFT",
      },
    ],
  });
  console.log(`[OK] Topic 1 APPROVED with guide scores and HOD approval.`);

  // 8. Activity Entries: All 53 rows GUIDE_VERIFIED and COMPLETE
  const activityTemplates = await prisma.activityTemplate.findMany({
    orderBy: [{ month: "asc" }, { sortOrder: "asc" }],
  });
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
    guideVerifiedById: demoGuide.id,
  }));
  await prisma.activityEntry.createMany({ data: activityData });
  console.log(`[OK] ${activityData.length} Activity Entries created (all GUIDE_VERIFIED COMPLETE).`);

  // 9. Content Pages: RTM, COST, NOTE
  await prisma.contentPage.createMany({
    data: [
      {
        groupId: group.id,
        type: "RTM",
        sortOrder: 0,
        richText: `<h3>Requirement Traceability Matrix (${DEMO_CONFIG.groupNo})</h3>
<p>Complete traceability mapping from system specifications to architectural modules, ML pipelines, and test suites.</p>
<ul>
  <li><strong>REQ-01:</strong> Image ingestion from drone/mobile camera modules.</li>
  <li><strong>REQ-02:</strong> ResNet-50 foliar disease inference module with 97.4% accuracy.</li>
  <li><strong>REQ-03:</strong> Localized multilingual notification dispatch to agricultural operators.</li>
</ul>`,
        fileUrl: "/media/content/rtm-cmv0x2kup000etmhl2qvdm6qz-1791564761942.pdf",
      },
      {
        groupId: group.id,
        type: "COST",
        sortOrder: 0,
        richText: `<h3>Project Cost Estimation (${DEMO_CONFIG.groupNo})</h3>
<p>Budget summary for hardware prototypes, embedded sensors, cloud compute instances, and field trials:</p>
<table border="1" style="width: 100%; border-collapse: collapse;">
  <tr><th>Item</th><th>Quantity</th><th>Unit Cost</th><th>Total (INR)</th></tr>
  <tr><td>Microcontroller / Edge Compute Unit</td><td>2</td><td>Rs. 2,800</td><td>Rs. 5,600</td></tr>
  <tr><td>Sensor Array & Camera Modules</td><td>4</td><td>Rs. 950</td><td>Rs. 3,800</td></tr>
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
        richText: `<p>Project logbook notes: Weekly sync with internal guide ${demoGuide.name} conducted diligently throughout academic semesters I and II. Milestones, feedback, and corrective actions verified per departmental standards.</p>`,
      },
    ],
  });
  console.log(`[OK] Content Pages (RTM, COST, NOTE) created.`);

  // 10. Reviews: All 7 Review Forms with all scores APPROVED
  const reviewTemplates = await prisma.reviewTemplate.findMany({
    include: { questions: { orderBy: { questionNo: "asc" } } },
    orderBy: { order: "asc" },
  });
  for (const template of reviewTemplates) {
    const form = await prisma.reviewForm.create({
      data: {
        groupId: group.id,
        templateId: template.id,
        guideId: demoGuide.id,
        status: "APPROVED",
        submittedById: demoGuide.id,
        submittedAt: now,
        approvedById: demoGuide.id,
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
      guideSignedById: demoGuide.id,
    }));
    await prisma.reviewScore.createMany({ data: scoresData });
  }
  console.log(`[OK] 7 Review Forms and all Review Scores created (all APPROVED).`);

  // 11. Evaluation Sheets: Mock Evaluation (Term-I) & Final Evaluation (Term-II)
  const mockComponents = [
    { problem: 5, literature: 5, analysis: 5, modeling: 9, planning: 5, presentation: 9, report: 9 }, // 47
    { problem: 4, literature: 5, analysis: 5, modeling: 9, planning: 4, presentation: 9, report: 9 }, // 45
    { problem: 5, literature: 4, analysis: 5, modeling: 9, planning: 5, presentation: 9, report: 9 }, // 46
    { problem: 4, literature: 4, analysis: 5, modeling: 8, planning: 5, presentation: 9, report: 9 }, // 44
  ];
  const finalComponents = [
    { modeling: 10, coding: 38, testing: 10, understanding: 10, teamwork: 10, demo: 9, documents: 9 }, // 96
    { modeling: 9, coding: 37, testing: 9, understanding: 9, teamwork: 10, demo: 9, documents: 9 },   // 92
    { modeling: 9, coding: 38, testing: 9, understanding: 9, teamwork: 10, demo: 9, documents: 9 },   // 93
    { modeling: 9, coding: 36, testing: 9, understanding: 9, teamwork: 9, demo: 9, documents: 9 },    // 90
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
        guideId: demoGuide.id,
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
        guideId: demoGuide.id,
        approvedById: hod.id,
        approvedAt: now,
      },
    });
  }
  console.log(`[OK] Mock (50) and Final (100) Marks Sheets created for all members (all APPROVED).`);

  // 12. Examiner Feedback: Term-I and Term-II
  await prisma.examinerFeedback.createMany({
    data: [
      {
        groupId: group.id,
        term: "TERM_I",
        answers: JSON.stringify(["Excellent", "Good", "Excellent", "Good", "Excellent", "Good", "Good", "Excellent", "Good"]),
        projectTitle: DEMO_CONFIG.projectTitle,
        remarks: "Solid problem statement, thorough literature review, and well-structured design documents.",
        date: "2025-12-15",
        externalName: "Dr. K. R. Sharma",
        internalName: demoGuide.name,
        signedAt: now,
      },
      {
        groupId: group.id,
        term: "TERM_II",
        answers: JSON.stringify(["Excellent", "Excellent", "Good", "Excellent", "Good", "Excellent", "Excellent", "Good", "Excellent"]),
        projectTitle: DEMO_CONFIG.projectTitle,
        remarks: "Exceptional working model, comprehensive testing, and clear practical impact for end users.",
        date: "2026-04-25",
        externalName: "Dr. K. R. Sharma",
        internalName: demoGuide.name,
        signedAt: now,
      },
    ],
  });
  console.log(`[OK] External Examiner Feedback (Term-I & Term-II) created.`);

  // 13. Checklists: Term-I and Term-II with all items checked
  const term1Items = CHECKLIST_ITEMS.TERM_I.map((text) => ({ text, checked: true }));
  const term2Items = CHECKLIST_ITEMS.TERM_II.map((text) => ({ text, checked: true }));
  await prisma.checklist.createMany({
    data: [
      { groupId: group.id, term: "TERM_I", items: JSON.stringify(term1Items) },
      { groupId: group.id, term: "TERM_II", items: JSON.stringify(term2Items) },
    ],
  });
  console.log(`[OK] Submission Checklists (Term-I & Term-II) created (all items checked).`);

  // 14. Competitions (with certificate images) & Paper Publication
  for (const comp of DEMO_CONFIG.competitions) {
    await prisma.competition.create({
      data: {
        groupId: group.id,
        name: comp.name,
        date: comp.date,
        collegeAndLevel: comp.collegeAndLevel,
        type: comp.type,
        award: comp.award,
        certificateUrl: comp.certificateUrl,
      },
    });
  }
  await prisma.paperPublication.create({
    data: {
      groupId: group.id,
      title: DEMO_CONFIG.paper.title,
      conference: DEMO_CONFIG.paper.conference,
      issn: DEMO_CONFIG.paper.issn,
      volIssue: DEMO_CONFIG.paper.volIssue,
      pageNo: DEMO_CONFIG.paper.pageNo,
      fileUrl: DEMO_CONFIG.paper.fileUrl,
    },
  });
  console.log(`[OK] Competitions (${DEMO_CONFIG.competitions.length}) and Paper Publication (1) created.`);

  // 15. Verify completion status
  const { getGroupCompletion } = await import("../apps/api/src/completion/index.js");
  const completion = await getGroupCompletion(group.id);
  console.log("\n==================================================================");
  console.log("Demo Group Completion Status:");
  console.log(`  - Group ID:      ${group.id}`);
  console.log(`  - Group No:      ${group.groupNo}`);
  console.log(`  - Completion:    ${completion.percent}%`);
  console.log(`  - Complete:      ${completion.complete}`);
  console.log(`  - Missing:       [${completion.missing.join(", ")}]`);
  console.log(`  - PDF Allowed:   ${group.pdfPermission}`);
  console.log(`  - Group Status:  ${group.status}`);
  console.log("==================================================================");

  return { groupId: group.id, groupNo: group.groupNo };
}

if (process.argv[1]?.endsWith("seed-demo-group.ts")) {
  seedDemoGroup()
    .then(() => {
      console.log("✓ Demo Group Seeding Finished Successfully!");
    })
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
