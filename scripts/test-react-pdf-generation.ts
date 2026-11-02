import { pdf } from "@react-pdf/renderer";
import React from "react";
import { LogbookPdfDocument, type LogbookPdfData } from "../apps/web/components/pdf/logbook-pdf-document";

const mockData: LogbookPdfData = {
  groupInfo: {
    id: "test-group-id",
    groupNo: "TEST-01",
    projectTitle: "AI Powered Crop Disease Surveillance",
    area: "Artificial Intelligence",
    academicYear: "2025-26",
    department: "Computer",
    status: "ACTIVE",
    guideId: "guide-1",
    isSponsored: false,
    guide: { name: "Prof. Rajesh Sharma" },
    members: [
      {
        id: "m1",
        userId: "u1",
        name: "Shreyas Deshmukh",
        rollNo: "BE-COMP-401",
        mobile: "9876543210",
        email: "shreyas@example.com",
        teResult: "8.85 CGPA",
        examSeatNo: "B2025001",
        contribution: "Deep Learning Model & Architecture",
        photoUrl: null,
        memberType: "CREATOR",
        rulesAckAt: new Date().toISOString(),
        undertakingAcceptedAt: new Date().toISOString(),
      },
      {
        id: "m2",
        userId: "u2",
        name: "Aarav Joshi",
        rollNo: "BE-COMP-402",
        mobile: "9876543211",
        email: "aarav@example.com",
        teResult: "8.52 CGPA",
        examSeatNo: "B2025002",
        contribution: "Frontend UI/UX",
        photoUrl: null,
        memberType: "MEMBER",
        rulesAckAt: new Date().toISOString(),
        undertakingAcceptedAt: new Date().toISOString(),
      },
      {
        id: "m3",
        userId: "u3",
        name: "Neha Kulkarni",
        rollNo: "BE-COMP-403",
        mobile: "9876543212",
        email: "neha@example.com",
        teResult: "8.70 CGPA",
        examSeatNo: "B2025003",
        contribution: "Dataset Curation",
        photoUrl: null,
        memberType: "MEMBER",
        rulesAckAt: new Date().toISOString(),
        undertakingAcceptedAt: new Date().toISOString(),
      },
      {
        id: "m4",
        userId: "u4",
        name: "Rohan Shinde",
        rollNo: "BE-COMP-404",
        mobile: "9876543213",
        email: "rohan@example.com",
        teResult: "8.40 CGPA",
        examSeatNo: "B2025004",
        contribution: "IoT Sensors and Testing",
        photoUrl: null,
        memberType: "MEMBER",
        rulesAckAt: new Date().toISOString(),
        undertakingAcceptedAt: new Date().toISOString(),
      },
    ],
  },
  terms: [
    {
      term: "TERM_I",
      title: "Semester I Schedule",
      items: [
        {
          id: "s1",
          term: "TERM_I",
          sortOrder: 1,
          description: "Topic submission & finalization",
          targetDate: "2025-07-15",
          completionDate: "2025-07-15",
        },
      ],
    },
    {
      term: "TERM_II",
      title: "Semester II Schedule",
      items: [
        {
          id: "s2",
          term: "TERM_II",
          sortOrder: 1,
          description: "Model testing and validation",
          targetDate: "2026-02-15",
          completionDate: "2026-02-15",
        },
      ],
    },
  ],
  topics: {
    topic1: {
      topicNo: 1,
      title: "AI Crop Disease Surveillance",
      description: "Automated early foliar disease detection using computer vision.",
      significanceScore: 9,
      innovativenessScore: 8,
      scopeScore: 9,
      feasibilityScore: 9,
      guideRecommended: true,
      guideSignedByName: "Prof. Rajesh Sharma",
      guideSignedAt: new Date().toISOString(),
      hodApproved: true,
      hodSignedByName: "Dr. Rama Gaikwad",
      hodSignedAt: new Date().toISOString(),
      status: "APPROVED",
    },
    topic2: {
      topicNo: 2,
      title: "Alternative Topic",
      description: "Alternative topic description",
      significanceScore: null,
      innovativenessScore: null,
      scopeScore: null,
      feasibilityScore: null,
      guideRecommended: null,
      guideSignedByName: null,
      guideSignedAt: null,
      hodApproved: null,
      hodSignedByName: null,
      hodSignedAt: null,
      status: "DRAFT",
    },
  },
  monthCharts: [
    {
      month: "june",
      entries: [
        {
          id: "e1",
          date: "2025-06-25",
          activity: "Literature survey & problem discussion",
          status: "COMPLETE",
          studentSign: { name: "Shreyas Deshmukh", at: new Date().toISOString() },
          guideSign: { name: "Prof. Rajesh Sharma", at: new Date().toISOString() },
        },
      ],
    },
  ],
  rtm: {
    richText: "Requirements Traceability Matrix details verified.",
    fileUrl: null,
  },
  cost: {
    richText: "Total estimated hardware and cloud cost: Rs. 14,500.",
    fileUrl: null,
  },
  reviews: [
    {
      template: {
        title: "Term-I Review I",
        term: "TERM_I",
        reviewType: "REVIEW_I",
        hasDateColumn: false,
        questions: [
          { id: "q1", questionNo: 1, text: "Problem Statement Clarity" },
        ],
      },
      form: {
        status: "APPROVED",
        remarkAndSuggestions: "Good initial progress.",
        submittedByName: "Prof. Rajesh Sharma",
        submittedAt: new Date().toISOString(),
        approvedByName: "Dr. Rama Gaikwad",
        approvedAt: new Date().toISOString(),
      },
      scores: [
        {
          questionNo: 1,
          remark: "Well articulated",
          grade: "A",
          guideSignName: "Prof. Rajesh Sharma",
          guideSignAt: new Date().toISOString(),
        },
      ],
    },
  ],
  mock: {
    rows: [
      {
        memberId: "m1",
        memberName: "Shreyas Deshmukh",
        rollNo: "BE-COMP-401",
        scores: {
          problem_statement: 5,
          literature_survey: 5,
          requirement_analysis: 5,
          modeling_designing: 9,
          planning_prototyping: 5,
          presentation_qa: 9,
          partial_report: 9,
        },
        total: 47,
        guideSign: "Prof. Rajesh Sharma",
        guideSignedAt: new Date().toISOString(),
      },
    ],
    submittedSign: { name: "Prof. Rajesh Sharma", at: new Date().toISOString() },
    approvedSign: { name: "Dr. Rama Gaikwad", at: new Date().toISOString() },
  },
  final: {
    rows: [
      {
        memberId: "m1",
        memberName: "Shreyas Deshmukh",
        rollNo: "BE-COMP-401",
        scores: {
          modeling: 9,
          coding: 38,
          testing: 9,
          understanding: 9,
          teamwork: 9,
          demonstration: 9,
          documents: 9,
        },
        total: 92,
        guideSign: "Prof. Rajesh Sharma",
        guideSignedAt: new Date().toISOString(),
      },
    ],
    submittedSign: { name: "Prof. Rajesh Sharma", at: new Date().toISOString() },
    approvedSign: { name: "Dr. Rama Gaikwad", at: new Date().toISOString() },
  },
  examinerI: {
    term: "TERM_I",
    projectTitle: "AI Powered Crop Disease Surveillance",
    internalName: "Prof. Rajesh Sharma",
    externalName: "Dr. External Examiner",
    date: "2025-11-25",
    answers: { q1: "Excellent", q2: "Good" },
    generalRemarks: "Very well presented and documented.",
    internalSign: { name: "Prof. Rajesh Sharma", at: new Date().toISOString() },
    externalSign: { name: "Dr. External Examiner", at: new Date().toISOString() },
  },
  examinerII: null,
  checklistI: {
    term: "TERM_I",
    items: [
      { key: "synopsis", label: "Synopsis Submitted", checked: true },
      { key: "report", label: "Partial Project Report Submitted", checked: true },
    ],
    date: "2025-11-20",
    studentSign: { name: "Shreyas Deshmukh", at: new Date().toISOString() },
    guideSign: { name: "Prof. Rajesh Sharma", at: new Date().toISOString() },
  },
  checklistII: null,
  competitions: [
    {
      id: "c1",
      name: "DIPEX 2026",
      date: "2026-02-20",
      collegeAndLevel: "State Level / MIT WPU Pune",
      type: "DEMO",
      award: "First Prize",
    },
  ],
  papers: [
    {
      id: "p1",
      title: "Deep Residual Learning for Early Foliar Disease Classification",
      conference: "IEEE ICPC 2026",
      issn: "2379-8351",
      volIssue: "Vol. 14, Issue 2",
      pageNo: "114-121",
    },
  ],
  sponsored: null,
  notes: [
    { id: "n1", richText: "Weekly guide review meeting on Wednesdays at 2 PM." },
  ],
  logos: {
    collegeCrest: null,
    founderPortrait: null,
    collegeBuilding: null,
  },
};

async function run() {
  console.log("Testing @react-pdf/renderer document rendering...");
  const element = React.createElement(LogbookPdfDocument, { data: mockData });
  const instance = pdf(element);
  const blob = await instance.toBlob();
  console.log("Rendered blob size:", blob.size, "type:", blob.type);
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log("Rendered buffer size:", buffer.length);
  const header = buffer.subarray(0, 5).toString("ascii");
  console.log("PDF header signature:", header);
  if (header === "%PDF-") {
    const fs = await import("node:fs");
  const path = await import("node:path");
  const outputPath = path.join(process.cwd(), "scripts", "sample-logbook.pdf");
  fs.writeFileSync(outputPath, buffer);
  console.log("Saved sample PDF to:", outputPath);
  console.log("SUCCESS: Output is a valid PDF!");
  } else {
    throw new Error(`Invalid header: ${header}`);
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
