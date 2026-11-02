/* eslint-disable jsx-a11y/alt-text */
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  COLLEGE,
  RULES_AND_REGULATIONS,
  UNDERTAKING_TEXT,
  MOCK_T1_COMPONENTS,
  MOCK_T1_TOTAL,
  FINAL_T2_COMPONENTS,
  FINAL_T2_TOTAL,
} from "@/lib/constants";

export type LogbookPdfData = {
  groupInfo: {
    id: string;
    groupNo: string | null;
    projectTitle: string | null;
    area: string | null;
    academicYear: string | null;
    department: string | null;
    status: string;
    guideId: string | null;
    isSponsored: boolean;
    guide: { name: string } | null;
    members: Array<{
      id: string;
      userId: string;
      name: string | null;
      rollNo: string | null;
      mobile: string | null;
      email: string | null;
      teResult: string | null;
      examSeatNo: string | null;
      contribution: string | null;
      photoUrl: string | null;
      memberType: string;
      rulesAckAt: string | null;
      undertakingAcceptedAt: string | null;
    }>;
  };
  terms: Array<{
    term: string;
    title: string;
    items: Array<{
      id: string;
      term: string;
      sortOrder: number;
      description: string;
      targetDate: string | null;
      completionDate: string | null;
    }>;
  }>;
  topics:
    | {
        topic1?: any;
        topic2?: any;
        topics?: any[];
      }
    | any[];
  monthCharts: Array<{
    month: string;
    entries: Array<{
      id: string;
      date: string | null;
      activity?: string;
      text?: string;
      status: string;
      statusText?: string | null;
      studentSign: { name: string | null; at: string } | null;
      guideSign: { name: string | null; at: string } | null;
    }>;
  }>;
  rtm: {
    richText: string | null;
    fileUrl: string | null;
  } | null;
  cost: {
    richText: string | null;
    fileUrl: string | null;
  } | null;
  reviews: Array<{
    template: {
      title: string;
      term: string;
      reviewType: string;
      hasDateColumn: boolean;
      questions?: Array<{ id?: string; questionNo: number; text: string }>;
    };
    form: {
      status: string;
      remarkAndSuggestions: string | null;
      submittedByName: string | null;
      submittedAt: string | null;
      approvedByName: string | null;
      approvedAt: string | null;
    };
    scores: Array<{
      questionId?: string;
      questionNo: number;
      text?: string;
      remark: string | null;
      grade: string | null;
      guideSignName?: string | null;
      guideSignAt?: string | null;
      signedByName?: string | null;
      signedAt?: string | null;
    }>;
  }>;
  mock: {
    rows: Array<{
      memberId: string;
      memberName: string;
      rollNo?: string;
      scores?: Record<string, number>;
      components?: Record<string, number | null>;
      total: number;
      guideSign?: string | null;
      guideSignedAt?: string | null;
      approvedByName?: string | null;
      approvedAt?: string | null;
    }>;
    submittedSign?: { name: string | null; at: string | null } | null;
    approvedSign?: { name: string | null; at: string | null } | null;
  };
  final: {
    rows: Array<{
      memberId: string;
      memberName: string;
      rollNo?: string;
      scores?: Record<string, number>;
      components?: Record<string, number | null>;
      total: number;
      guideSign?: string | null;
      guideSignedAt?: string | null;
      approvedByName?: string | null;
      approvedAt?: string | null;
    }>;
    submittedSign?: { name: string | null; at: string | null } | null;
    approvedSign?: { name: string | null; at: string | null } | null;
  };
  examinerI: {
    term: string;
    projectTitle: string;
    internalName?: string | null;
    externalName?: string | null;
    date: string | null;
    answers: Record<string, string>;
    generalRemarks?: string;
    remarks?: string;
    internalSign?: { name: string; at: string } | null;
    externalSign?: { name: string; at: string } | null;
    signedAt?: string | null;
  } | null;
  examinerII: {
    term: string;
    projectTitle: string;
    internalName?: string | null;
    externalName?: string | null;
    date: string | null;
    answers: Record<string, string>;
    generalRemarks?: string;
    remarks?: string;
    internalSign?: { name: string; at: string } | null;
    externalSign?: { name: string; at: string } | null;
    signedAt?: string | null;
  } | null;
  checklistI: {
    term: string;
    items: Array<{ key?: string; label?: string; text?: string; checked: boolean }>;
    date?: string | null;
    studentSign?: { name: string; at: string } | null;
    guideSign?: { name: string; at: string } | null;
  } | null;
  checklistII: {
    term: string;
    items: Array<{ key?: string; label?: string; text?: string; checked: boolean }>;
    date?: string | null;
    studentSign?: { name: string; at: string } | null;
    guideSign?: { name: string; at: string } | null;
  } | null;
  competitions: Array<{
    id: string;
    name: string;
    date: string | null;
    collegeAndLevel: string;
    type: string;
    award: string;
  }>;
  papers: Array<{
    id: string;
    title: string;
    conference: string;
    issn: string;
    volIssue: string;
    pageNo: string;
  }>;
  sponsored: {
    semesters: Array<{
      semester: string;
      title: string;
      rows: Array<{ date: string; discussion: string; guideSign: string | null }>;
    }>;
    feedback: {
      company: string;
      ratings: Record<string, string>;
      sealUrl: string | null;
      signedAt: string | null;
    };
  } | null;
  notes: Array<{ id: string; richText: string | null }>;
  logos: {
    collegeCrest: string | null;
    founderPortrait: string | null;
    collegeBuilding: string | null;
  };
};

const styles = StyleSheet.create({
  page: {
    size: "A4",
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 24,
    fontSize: 9,
    fontFamily: "Times-Roman",
    color: "#000000",
  },
  headerTable: {
    borderWidth: 1,
    borderColor: "#000000",
    marginBottom: 0,
  },
  headerTopRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 52,
    alignItems: "center",
  },
  headerCrestBox: {
    width: "16%",
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderColor: "#000000",
  },
  headerCrestImg: {
    maxHeight: 46,
    maxWidth: 60,
  },
  headerCenterBox: {
    width: "70%",
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  headerParishadText: {
    fontSize: 9.5,
    fontFamily: "Times-Bold",
    textAlign: "center",
    color: "#333333",
  },
  headerCollegeText: {
    fontSize: 10.5,
    fontFamily: "Times-Bold",
    textAlign: "center",
    color: "#333333",
    marginTop: 2,
  },
  headerPortraitBox: {
    width: "14%",
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderColor: "#000000",
  },
  headerPortraitImg: {
    maxHeight: 46,
    maxWidth: 44,
  },
  headerRecordRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000000",
    paddingVertical: 2,
    paddingHorizontal: 4,
    fontSize: 7.5,
  },
  headerRecordCol1: {
    width: "48%",
  },
  headerRecordCol2: {
    width: "52%",
    textAlign: "right",
  },
  headerGreyBar: {
    backgroundColor: "#e5e5e5",
    paddingVertical: 2,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#000000",
  },
  headerGreyBarText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  contentBody: {
    marginTop: 8,
    flex: 1,
  },
  sheetTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  sheetSubtitle: {
    fontFamily: "Times-Bold",
    fontSize: 9.5,
    textAlign: "center",
    marginBottom: 6,
  },
  table: {
    borderWidth: 1,
    borderColor: "#000000",
    marginVertical: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000000",
    minHeight: 18,
    alignItems: "stretch",
  },
  tableRowHeader: {
    backgroundColor: "#f5f5f5",
    fontFamily: "Helvetica-Bold",
  },
  tableCell: {
    padding: 3,
    borderRightWidth: 1,
    borderColor: "#000000",
    fontSize: 8,
    justifyContent: "center",
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  bold: {
    fontFamily: "Times-Bold",
  },
  sansBold: {
    fontFamily: "Helvetica-Bold",
  },
  signText: {
    fontSize: 7,
    fontFamily: "Times-Italic",
    color: "#222222",
  },
  pageNumber: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    fontFamily: "Times-Roman",
    color: "#555555",
  },
});

function Header({ logos }: { logos: LogbookPdfData["logos"] }) {
  return (
    <View style={styles.headerTable}>
      <View style={styles.headerTopRow}>
        <View style={styles.headerCrestBox}>
          {logos.collegeCrest ? (
            <Image src={logos.collegeCrest} style={styles.headerCrestImg} />
          ) : (
            <Text style={{ fontSize: 7, textAlign: "center" }}>CREST</Text>
          )}
        </View>
        <View style={styles.headerCenterBox}>
          <Text style={styles.headerParishadText}>{COLLEGE.parishad}</Text>
          <Text style={styles.headerCollegeText}>{COLLEGE.name}</Text>
        </View>
        <View style={styles.headerPortraitBox}>
          {logos.founderPortrait ? (
            <Image src={logos.founderPortrait} style={styles.headerPortraitImg} />
          ) : (
            <Text style={{ fontSize: 7, textAlign: "center" }}>PORTRAIT</Text>
          )}
        </View>
      </View>
      <View style={styles.headerRecordRow}>
        <View style={styles.headerRecordCol1}>
          <Text>
            <Text style={styles.bold}>Record No.: </Text>
            {COLLEGE.recordNo} | <Text style={styles.bold}>Revision: </Text>
            {COLLEGE.revision}
          </Text>
        </View>
        <View style={styles.headerRecordCol2}>
          <Text>
            <Text style={styles.bold}>DoI: </Text>
            {COLLEGE.doi}
          </Text>
        </View>
      </View>
      <View style={styles.headerGreyBar}>
        <Text style={styles.headerGreyBarText}>{COLLEGE.diaryTitle}</Text>
      </View>
    </View>
  );
}

const EXAMINER_QUESTIONS = [
  "1. The project work satisfies the curriculum requirements",
  "2. Problem statement is clearly defined and well understood",
  "3. Literature survey and background study is thoroughly conducted",
  "4. Methodology, architecture, and design are sound and justified",
  "5. Implementation and coding standards are appropriate and verified",
  "6. Testing, validation, results and performance metrics are sound",
  "7. The team members demonstrated individual understanding & contribution",
  "8. Presentation quality and response to technical questions were satisfactory",
  "9. Quality of project report / partial report complies with standards",
];

export function LogbookPdfDocument({ data }: { data: LogbookPdfData }) {
  const { groupInfo, logos } = data;
  const guideName = groupInfo.guide?.name || "Assigned by the HOD";

  return (
    <Document title={`BE-Logbook-${groupInfo.groupNo || "Group"}`} author="Digital BE Project Log Book">
      {/* ========================================================
          1. COVER PAGE
         ======================================================== */}
      <Page size="A4" style={styles.page}>
        <Header logos={logos} />
        <View style={styles.contentBody}>
          <Text style={{ fontSize: 11, marginBottom: 8 }}>
            Department of <Text style={styles.bold}>{(groupInfo.department || "Computer Engineering").replace(/\s+Engineering$/i, "")}</Text> Engineering
          </Text>

          <View
            style={{
              backgroundColor: "#f5f5f5",
              borderWidth: 1,
              borderColor: "#000000",
              paddingVertical: 5,
              paddingHorizontal: 8,
              textAlign: "center",
              marginBottom: 10,
              flexDirection: "row",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#c0392b", fontFamily: "Helvetica-Bold", fontSize: 12 }}>
              BE PROJECT LOG BOOK{" "}
            </Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>
              {" "}A.Y. {groupInfo.academicYear || "2025-26"}
            </Text>
          </View>

          {logos.collegeBuilding ? (
            <View style={{ alignItems: "center", marginVertical: 8 }}>
              <Image
                src={logos.collegeBuilding}
                style={{ width: "70%", maxHeight: 160, objectFit: "contain" }}
              />
            </View>
          ) : null}

          <View
            style={{
              borderWidth: 1,
              borderColor: "#000000",
              padding: 10,
              marginVertical: 8,
            }}
          >
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 2 }}>
              Project Title:
            </Text>
            <Text style={{ fontSize: 10, fontFamily: "Times-Bold", marginBottom: 8, color: "#111111" }}>
              {groupInfo.projectTitle || "—"}
            </Text>

            <View style={{ flexDirection: "row", marginBottom: 6 }}>
              <Text style={{ width: "32%", fontFamily: "Helvetica-Bold", fontSize: 9 }}>
                Area of Project:
              </Text>
              <Text style={{ width: "68%", fontSize: 9 }}>{groupInfo.area || "—"}</Text>
            </View>

            <View style={{ flexDirection: "row" }}>
              <Text style={{ width: "32%", fontFamily: "Helvetica-Bold", fontSize: 9 }}>
                Project Guide:
              </Text>
              <Text style={{ width: "68%", fontSize: 9, fontFamily: "Times-Bold" }}>
                {guideName}
              </Text>
            </View>
          </View>

          <View
            style={{
              borderWidth: 1,
              borderColor: "#000000",
              padding: 6,
              marginTop: 6,
              flexDirection: "row",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>
              Group No:{" "}
            </Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>
              {groupInfo.groupNo || "—"}
            </Text>
          </View>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {/* ========================================================
          2. RULES AND REGULATIONS
         ======================================================== */}
      <Page size="A4" style={styles.page}>
        <Header logos={logos} />
        <View style={styles.contentBody}>
          <Text style={styles.sheetTitle}>Rules and Regulations</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableRowHeader]}>
              <View style={[styles.tableCell, { width: "8%", alignItems: "center" }]}>
                <Text>Sr.</Text>
              </View>
              <View style={[styles.tableCell, { width: "92%" }, styles.tableCellLast]}>
                <Text>Rule / Instruction</Text>
              </View>
            </View>
            {RULES_AND_REGULATIONS.map((rule, idx) => (
              <View key={idx} style={styles.tableRow}>
                <View style={[styles.tableCell, { width: "8%", alignItems: "center" }]}>
                  <Text>{idx + 1}</Text>
                </View>
                <View style={[styles.tableCell, { width: "92%" }, styles.tableCellLast]}>
                  <Text>{rule}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 10, borderWidth: 1, borderColor: "#000000", padding: 6 }}>
            <Text style={[styles.sansBold, { fontSize: 8.5, marginBottom: 4 }]}>
              Student Acknowledgements:
            </Text>
            {groupInfo.members.map((m, idx) => (
              <View key={m.id || idx} style={{ flexDirection: "row", marginVertical: 1, fontSize: 8 }}>
                <Text style={{ width: "35%", fontFamily: "Times-Bold" }}>
                  {idx + 1}. {m.name || "Student " + (idx + 1)}
                </Text>
                <Text style={{ width: "65%", color: m.rulesAckAt ? "#166534" : "#991b1b" }}>
                  {m.rulesAckAt
                    ? `Acknowledged digitally on ${new Date(m.rulesAckAt).toLocaleDateString("en-GB")}`
                    : "Pending acknowledgement"}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {/* ========================================================
          3. GROUP INFORMATION (Members 1 & 2 on Page 1, 3 & 4 on Page 2)
         ======================================================== */}
      {[0, 1].map((pairIndex) => (
        <Page key={`members-page-${pairIndex}`} size="A4" style={styles.page}>
          <Header logos={logos} />
          <View style={styles.contentBody}>
            <Text style={styles.sheetTitle}>Project Group Information</Text>
            {[0, 1].map((slotOffset) => {
              const idx = pairIndex * 2 + slotOffset;
              const member = groupInfo.members[idx];
              return (
                <View
                  key={`member-slot-${idx}`}
                  style={{
                    borderWidth: 1,
                    borderColor: "#000000",
                    marginBottom: 12,
                    padding: 6,
                  }}
                >
                  <Text style={[styles.sansBold, { fontSize: 9.5, marginBottom: 4, color: "#1e3a8a" }]}>
                    Member {idx + 1}
                  </Text>
                  <View style={{ flexDirection: "row" }}>
                    <View style={{ width: "75%", paddingRight: 6 }}>
                      <View style={{ flexDirection: "row", marginBottom: 2 }}>
                        <Text style={[styles.bold, { width: "30%", fontSize: 8 }]}>Name:</Text>
                        <Text style={{ width: "70%", fontSize: 8 }}>{member?.name || "—"}</Text>
                      </View>
                      <View style={{ flexDirection: "row", marginBottom: 2 }}>
                        <Text style={[styles.bold, { width: "30%", fontSize: 8 }]}>Roll No:</Text>
                        <Text style={{ width: "70%", fontSize: 8 }}>{member?.rollNo || "—"}</Text>
                      </View>
                      <View style={{ flexDirection: "row", marginBottom: 2 }}>
                        <Text style={[styles.bold, { width: "30%", fontSize: 8 }]}>Exam Seat No:</Text>
                        <Text style={{ width: "70%", fontSize: 8 }}>{member?.examSeatNo || "—"}</Text>
                      </View>
                      <View style={{ flexDirection: "row", marginBottom: 2 }}>
                        <Text style={[styles.bold, { width: "30%", fontSize: 8 }]}>T.E. Result:</Text>
                        <Text style={{ width: "70%", fontSize: 8 }}>{member?.teResult || "—"}</Text>
                      </View>
                      <View style={{ flexDirection: "row", marginBottom: 2 }}>
                        <Text style={[styles.bold, { width: "30%", fontSize: 8 }]}>Mobile No:</Text>
                        <Text style={{ width: "70%", fontSize: 8 }}>{member?.mobile || "—"}</Text>
                      </View>
                      <View style={{ flexDirection: "row", marginBottom: 2 }}>
                        <Text style={[styles.bold, { width: "30%", fontSize: 8 }]}>Email ID:</Text>
                        <Text style={{ width: "70%", fontSize: 8 }}>{member?.email || "—"}</Text>
                      </View>
                      <View style={{ flexDirection: "row", marginTop: 2 }}>
                        <Text style={[styles.bold, { width: "30%", fontSize: 8 }]}>Contribution:</Text>
                        <Text style={{ width: "70%", fontSize: 7.5 }}>
                          {member?.contribution || "—"}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{
                        width: "25%",
                        borderWidth: 1,
                        borderColor: "#888888",
                        height: 95,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#fafafa",
                        overflow: "hidden",
                      }}
                    >
                      {member?.photoUrl && (member.photoUrl.startsWith("data:image/") || member.photoUrl.startsWith("http")) ? (
                        <Image
                          src={member.photoUrl}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <Text style={{ fontSize: 7.5, color: "#888888", textAlign: "center" }}>
                          Photo
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            fixed
          />
        </Page>
      ))}

      {/* ========================================================
          4. UNDERTAKING
         ======================================================== */}
      <Page size="A4" style={styles.page}>
        <Header logos={logos} />
        <View style={styles.contentBody}>
          <Text style={styles.sheetTitle}>Undertaking</Text>
          <Text style={{ fontSize: 9.5, lineHeight: 1.5, textAlign: "justify", marginBottom: 14 }}>
            {UNDERTAKING_TEXT.before} <Text style={styles.bold}>{groupInfo.department || "Computer"}</Text>{" "}
            {UNDERTAKING_TEXT.afterBatch} <Text style={styles.bold}>{groupInfo.academicYear || "2025-26"}</Text>{" "}
            {UNDERTAKING_TEXT.afterYear} <Text style={styles.bold}>{groupInfo.academicYear || "2025-26"}</Text>.{" "}
            {UNDERTAKING_TEXT.afterTitle} <Text style={styles.bold}>{groupInfo.projectTitle || "Project"}</Text>{" "}
            {UNDERTAKING_TEXT.afterTitle2}
          </Text>

          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableRowHeader]}>
              <View style={[styles.tableCell, { width: "12%" }]}>
                <Text>Roll No</Text>
              </View>
              <View style={[styles.tableCell, { width: "40%" }]}>
                <Text>Name of Student</Text>
              </View>
              <View style={[styles.tableCell, { width: "48%" }, styles.tableCellLast]}>
                <Text>Digital Signature</Text>
              </View>
            </View>
            {groupInfo.members.map((m, idx) => (
              <View key={m.id || idx} style={styles.tableRow}>
                <View style={[styles.tableCell, { width: "12%" }]}>
                  <Text>{m.rollNo || "—"}</Text>
                </View>
                <View style={[styles.tableCell, { width: "40%" }]}>
                  <Text>{m.name || "—"}</Text>
                </View>
                <View style={[styles.tableCell, { width: "48%" }, styles.tableCellLast]}>
                  {m.undertakingAcceptedAt ? (
                    <Text style={styles.signText}>
                      Signed by {m.name} on {new Date(m.undertakingAcceptedAt).toLocaleDateString("en-GB")}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 7.5, color: "#999999" }}>Pending acceptance</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {/* ========================================================
          5. SCHEDULE (Term-I & Term-II)
         ======================================================== */}
      {data.terms.map((term, tIdx) => (
        <Page key={`term-sched-${tIdx}`} size="A4" style={styles.page}>
          <Header logos={logos} />
          <View style={styles.contentBody}>
            <Text style={styles.sheetTitle}>Project Activity Schedule</Text>
            <Text style={styles.sheetSubtitle}>{term.title || term.term}</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableRowHeader]}>
                <View style={[styles.tableCell, { width: "10%", alignItems: "center" }]}>
                  <Text>Sr. No</Text>
                </View>
                <View style={[styles.tableCell, { width: "50%" }]}>
                  <Text>Planned Activity</Text>
                </View>
                <View style={[styles.tableCell, { width: "20%" }]}>
                  <Text>Target Date</Text>
                </View>
                <View style={[styles.tableCell, { width: "20%" }, styles.tableCellLast]}>
                  <Text>Completion Date</Text>
                </View>
              </View>
              {term.items.map((item, iIdx) => (
                <View key={item.id || iIdx} style={styles.tableRow}>
                  <View style={[styles.tableCell, { width: "10%", alignItems: "center" }]}>
                    <Text>{item.sortOrder || iIdx + 1}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "50%" }]}>
                    <Text>{item.description}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "20%" }]}>
                    <Text>{item.targetDate || "—"}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "20%" }, styles.tableCellLast]}>
                    <Text>{item.completionDate || "—"}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            fixed
          />
        </Page>
      ))}

      {/* ========================================================
          6. TOPIC FINALIZATION (Topic 1 & Topic 2)
         ======================================================== */}
      {(() => {
        const rawTopics: any = data.topics;
        const topicList: any[] = Array.isArray(rawTopics)
          ? rawTopics
          : Array.isArray(rawTopics?.topics)
            ? rawTopics.topics
            : [rawTopics?.topic1, rawTopics?.topic2].filter(Boolean);

        return topicList.map((top: any, tIdx: number) => {
          if (!top) return null;
          const topicNo = top.topicNo ?? (tIdx + 1);
          const significance = top.significanceScore ?? top.significance ?? null;
          const innovativeness = top.innovativenessScore ?? top.innovativeness ?? null;
          const scope = top.scopeScore ?? top.scope ?? null;
          const feasibility = top.feasibilityScore ?? top.feasibility ?? null;
          const totalMarks =
            significance !== null && innovativeness !== null && scope !== null && feasibility !== null
              ? significance + innovativeness + scope + feasibility
              : "—";
          const isRecommended =
            typeof top.guideRecommended === "boolean"
              ? top.guideRecommended
              : top.recommendation === "YES"
                ? true
                : top.recommendation === "NO"
                  ? false
                  : null;
          const guideSignName = top.guideSignedByName ?? top.scoredByName ?? null;
          const guideSignAt = top.guideSignedAt ?? top.scoredAt ?? null;
          const hodApproved =
            typeof top.hodApproved === "boolean"
              ? top.hodApproved
              : top.status === "APPROVED"
                ? true
                : top.status === "REJECTED"
                  ? false
                  : null;
          const hodSignName = top.hodSignedByName ?? top.approvedByName ?? null;
          const hodSignAt = top.hodSignedAt ?? top.approvedAt ?? null;

          return (
            <Page key={`topic-${topicNo}-${tIdx}`} size="A4" style={styles.page}>
              <Header logos={logos} />
              <View style={styles.contentBody}>
                <Text style={styles.sheetTitle}>Topic Finalization</Text>
                <Text style={styles.sheetSubtitle}>
                  Topic {topicNo}: {top.title || "Untitled Topic"} (Status: {top.status || "—"})
                </Text>

                <View style={{ borderWidth: 1, borderColor: "#000000", padding: 6, marginBottom: 8 }}>
                  <Text style={[styles.sansBold, { fontSize: 8.5, marginBottom: 2 }]}>
                    Description / Problem Definition:
                  </Text>
                  <Text style={{ fontSize: 8, lineHeight: 1.4 }}>{top.description || "—"}</Text>
                </View>

                <Text style={[styles.sansBold, { fontSize: 8.5, marginTop: 4, marginBottom: 2 }]}>
                  Guide Assessment (0 - 10 each):
                </Text>
                <View style={styles.table}>
                  <View style={[styles.tableRow, styles.tableRowHeader]}>
                    <View style={[styles.tableCell, { width: "10%", alignItems: "center" }]}>
                      <Text>Sr.</Text>
                    </View>
                    <View style={[styles.tableCell, { width: "65%" }]}>
                      <Text>Evaluation Parameter</Text>
                    </View>
                    <View style={[styles.tableCell, { width: "25%" }, styles.tableCellLast]}>
                      <Text>Marks (Max 10)</Text>
                    </View>
                  </View>
                  <View style={styles.tableRow}>
                    <View style={[styles.tableCell, { width: "10%", alignItems: "center" }]}>
                      <Text>1</Text>
                    </View>
                    <View style={[styles.tableCell, { width: "65%" }]}>
                      <Text>Significance of the Project Work</Text>
                    </View>
                    <View style={[styles.tableCell, { width: "25%" }, styles.tableCellLast]}>
                      <Text>{significance ?? "—"}</Text>
                    </View>
                  </View>
                  <View style={styles.tableRow}>
                    <View style={[styles.tableCell, { width: "10%", alignItems: "center" }]}>
                      <Text>2</Text>
                    </View>
                    <View style={[styles.tableCell, { width: "65%" }]}>
                      <Text>Innovativeness of Project Work</Text>
                    </View>
                    <View style={[styles.tableCell, { width: "25%" }, styles.tableCellLast]}>
                      <Text>{innovativeness ?? "—"}</Text>
                    </View>
                  </View>
                  <View style={styles.tableRow}>
                    <View style={[styles.tableCell, { width: "10%", alignItems: "center" }]}>
                      <Text>3</Text>
                    </View>
                    <View style={[styles.tableCell, { width: "65%" }]}>
                      <Text>Scope of the Project Work</Text>
                    </View>
                    <View style={[styles.tableCell, { width: "25%" }, styles.tableCellLast]}>
                      <Text>{scope ?? "—"}</Text>
                    </View>
                  </View>
                  <View style={styles.tableRow}>
                    <View style={[styles.tableCell, { width: "10%", alignItems: "center" }]}>
                      <Text>4</Text>
                    </View>
                    <View style={[styles.tableCell, { width: "65%" }]}>
                      <Text>Feasibility of the Project Work</Text>
                    </View>
                    <View style={[styles.tableCell, { width: "25%" }, styles.tableCellLast]}>
                      <Text>{feasibility ?? "—"}</Text>
                    </View>
                  </View>
                  <View style={[styles.tableRow, styles.tableRowHeader]}>
                    <View style={[styles.tableCell, { width: "75%", alignItems: "flex-end" }]}>
                      <Text>Total Marks (out of 40): </Text>
                    </View>
                    <View style={[styles.tableCell, { width: "25%" }, styles.tableCellLast]}>
                      <Text>{totalMarks}</Text>
                    </View>
                  </View>
                </View>

                <View style={{ marginTop: 8, borderWidth: 1, borderColor: "#000000", padding: 6 }}>
                  <View style={{ flexDirection: "row", marginBottom: 4 }}>
                    <Text style={{ width: "35%", fontFamily: "Times-Bold" }}>Guide Recommendation:</Text>
                    <Text style={{ width: "65%" }}>
                      {isRecommended === true
                        ? "Recommended"
                        : isRecommended === false
                          ? "Not Recommended"
                          : "Pending"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", marginBottom: 6 }}>
                    <Text style={{ width: "35%", fontFamily: "Times-Bold" }}>Guide Signature:</Text>
                    <Text style={styles.signText}>
                      {guideSignName
                        ? `Signed by ${guideSignName} on ${guideSignAt ? new Date(guideSignAt).toLocaleDateString("en-GB") : ""}`
                        : "Not signed yet"}
                    </Text>
                  </View>

                  <View style={{ borderTopWidth: 1, borderColor: "#000000", paddingTop: 4 }}>
                    <View style={{ flexDirection: "row", marginBottom: 4 }}>
                      <Text style={{ width: "35%", fontFamily: "Times-Bold" }}>HOD Decision:</Text>
                      <Text
                        style={{
                          width: "65%",
                          fontFamily: "Times-Bold",
                          color: hodApproved ? "#166534" : "#991b1b",
                        }}
                      >
                        {hodApproved === true
                          ? "Approved"
                          : hodApproved === false
                            ? "Rejected"
                            : "Pending Approval"}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row" }}>
                      <Text style={{ width: "35%", fontFamily: "Times-Bold" }}>HOD Signature:</Text>
                      <Text style={styles.signText}>
                        {hodSignName
                          ? `Signed by ${hodSignName} on ${hodSignAt ? new Date(hodSignAt).toLocaleDateString("en-GB") : ""}`
                          : "Pending HOD Sign"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <Text
                style={styles.pageNumber}
                render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
                fixed
              />
            </Page>
          );
        });
      })()}

      {/* ========================================================
          7. ACTIVITY CHARTS (All 10 months)
         ======================================================== */}
      {data.monthCharts.map((chart, mIdx) => (
        <Page key={`activity-chart-${mIdx}`} size="A4" style={styles.page}>
          <Header logos={logos} />
          <View style={styles.contentBody}>
            <Text style={styles.sheetTitle}>Activity Chart</Text>
            <Text style={styles.sheetSubtitle}>
              Month: {chart.month.toUpperCase()}
            </Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableRowHeader]}>
                <View style={[styles.tableCell, { width: "14%" }]}>
                  <Text>Date</Text>
                </View>
                <View style={[styles.tableCell, { width: "42%" }]}>
                  <Text>Planned / Completed Activity</Text>
                </View>
                <View style={[styles.tableCell, { width: "14%" }]}>
                  <Text>Status</Text>
                </View>
                <View style={[styles.tableCell, { width: "15%" }]}>
                  <Text>Student Sign</Text>
                </View>
                <View style={[styles.tableCell, { width: "15%" }, styles.tableCellLast]}>
                  <Text>Guide Sign</Text>
                </View>
              </View>
              {chart.entries.map((entry, eIdx) => (
                <View key={entry.id || eIdx} style={styles.tableRow}>
                  <View style={[styles.tableCell, { width: "14%" }]}>
                    <Text>{entry.date || "—"}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "42%" }]}>
                    <Text>{(entry as any).activity || (entry as any).text || "—"}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "14%" }]}>
                    <Text>{(entry as any).statusText || entry.status || "—"}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "15%" }]}>
                    {entry.studentSign ? (
                      <Text style={styles.signText}>Signed by {entry.studentSign.name}</Text>
                    ) : (
                      <Text style={{ fontSize: 6.5, color: "#999999" }}>—</Text>
                    )}
                  </View>
                  <View style={[styles.tableCell, { width: "15%" }, styles.tableCellLast]}>
                    {entry.guideSign ? (
                      <Text style={styles.signText}>Verified by {entry.guideSign.name}</Text>
                    ) : (
                      <Text style={{ fontSize: 6.5, color: "#999999" }}>—</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            fixed
          />
        </Page>
      ))}

      {/* ========================================================
          8. RTM (Requirements Traceability Matrix)
         ======================================================== */}
      <Page size="A4" style={styles.page}>
        <Header logos={logos} />
        <View style={styles.contentBody}>
          <Text style={styles.sheetTitle}>Requirements Traceability Matrix (RTM)</Text>
          <View style={{ borderWidth: 1, borderColor: "#000000", padding: 8, minHeight: 250 }}>
            <Text style={{ fontSize: 8.5, lineHeight: 1.5 }}>
              {data.rtm?.richText || "RTM details recorded in system."}
            </Text>
          </View>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {/* ========================================================
          9. PROJECT COST ESTIMATION
         ======================================================== */}
      <Page size="A4" style={styles.page}>
        <Header logos={logos} />
        <View style={styles.contentBody}>
          <Text style={styles.sheetTitle}>Project Cost Estimation</Text>
          <View style={{ borderWidth: 1, borderColor: "#000000", padding: 8, minHeight: 250 }}>
            <Text style={{ fontSize: 8.5, lineHeight: 1.5 }}>
              {data.cost?.richText || "Project cost estimation details recorded in system."}
            </Text>
          </View>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {/* ========================================================
          10. REVIEWS (7 reviews)
         ======================================================== */}
      {data.reviews.map((rev, rIdx) => (
        <Page key={`review-${rIdx}`} size="A4" style={styles.page}>
          <Header logos={logos} />
          <View style={styles.contentBody}>
            <Text style={styles.sheetTitle}>{rev.template.title}</Text>
            <Text style={styles.sheetSubtitle}>
              Term: {rev.template.term} | Status: {rev.form.status || "—"}
            </Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableRowHeader]}>
                <View style={[styles.tableCell, { width: "8%", alignItems: "center" }]}>
                  <Text>Q.</Text>
                </View>
                <View style={[styles.tableCell, { width: "52%" }]}>
                  <Text>Question / Parameter</Text>
                </View>
                <View style={[styles.tableCell, { width: "18%" }]}>
                  <Text>Remark</Text>
                </View>
                <View style={[styles.tableCell, { width: "10%" }]}>
                  <Text>Grade</Text>
                </View>
                <View style={[styles.tableCell, { width: "12%" }, styles.tableCellLast]}>
                  <Text>Sign</Text>
                </View>
              </View>
              {(() => {
                const questions = (rev.template as any)?.questions || rev.scores || [];
                return questions.map((q: any) => {
                  const sc = (rev.template as any)?.questions
                    ? rev.scores.find((s: any) => s.questionNo === q.questionNo)
                    : q;
                  const signName = sc?.signedByName || sc?.guideSignName;
                  return (
                    <View key={q.id || q.questionId || q.questionNo} style={styles.tableRow}>
                      <View style={[styles.tableCell, { width: "8%", alignItems: "center" }]}>
                        <Text>{q.questionNo}</Text>
                      </View>
                      <View style={[styles.tableCell, { width: "52%" }]}>
                        <Text>{q.text}</Text>
                      </View>
                      <View style={[styles.tableCell, { width: "18%" }]}>
                        <Text>{sc?.remark || "—"}</Text>
                      </View>
                      <View style={[styles.tableCell, { width: "10%" }]}>
                        <Text>{sc?.grade || "—"}</Text>
                      </View>
                      <View style={[styles.tableCell, { width: "12%" }, styles.tableCellLast]}>
                        {signName ? (
                          <Text style={styles.signText}>Signed</Text>
                        ) : (
                          <Text style={{ fontSize: 6.5, color: "#999999" }}>—</Text>
                        )}
                      </View>
                    </View>
                  );
                });
              })()}
            </View>

            <View style={{ marginTop: 6, borderWidth: 1, borderColor: "#000000", padding: 6 }}>
              <Text style={[styles.sansBold, { fontSize: 8 }]}>Remark and Suggestions:</Text>
              <Text style={{ fontSize: 8, marginVertical: 2 }}>
                {rev.form.remarkAndSuggestions || "Satisfactory progress"}
              </Text>
              <View style={{ flexDirection: "row", marginTop: 4 }}>
                <Text style={{ width: "25%", fontFamily: "Times-Bold" }}>Guide Signature:</Text>
                <Text style={styles.signText}>
                  {rev.form.submittedByName
                    ? `Signed by ${rev.form.submittedByName} on ${rev.form.submittedAt ? new Date(rev.form.submittedAt).toLocaleDateString("en-GB") : ""}`
                    : "Pending Guide Submission"}
                </Text>
              </View>
            </View>
          </View>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            fixed
          />
        </Page>
      ))}

      {/* ========================================================
          11. MOCK EVALUATION TERM-I
         ======================================================== */}
      <Page size="A4" style={styles.page}>
        <Header logos={logos} />
        <View style={styles.contentBody}>
          <Text style={styles.sheetTitle}>Mock Evaluation Term-I (Final Review)</Text>
          <Text style={styles.sheetSubtitle}>Total 50 Marks · Refer Rubrics for Details</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableRowHeader]}>
              <View style={[styles.tableCell, { width: "12%" }]}>
                <Text>Roll No</Text>
              </View>
              <View style={[styles.tableCell, { width: "22%" }]}>
                <Text>Student</Text>
              </View>
              {MOCK_T1_COMPONENTS.map((c) => (
                <View key={c.key} style={[styles.tableCell, { width: "8%", alignItems: "center" }]}>
                  <Text style={{ fontSize: 6.5 }}>{c.label.slice(0, 8)} ({c.max})</Text>
                </View>
              ))}
              <View style={[styles.tableCell, { width: "10%", alignItems: "center" }]}>
                <Text>Total ({MOCK_T1_TOTAL})</Text>
              </View>
            </View>
            {data.mock.rows.map((row) => {
              const scores = (row as any).scores || (row as any).components || {};
              const memberRollNo =
                row.rollNo ||
                groupInfo.members.find((m) => m.id === row.memberId || m.userId === row.memberId)?.rollNo ||
                "—";
              return (
                <View key={row.memberId} style={styles.tableRow}>
                  <View style={[styles.tableCell, { width: "12%" }]}>
                    <Text>{memberRollNo}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "22%" }]}>
                    <Text>{row.memberName}</Text>
                  </View>
                  {MOCK_T1_COMPONENTS.map((c) => (
                    <View key={c.key} style={[styles.tableCell, { width: "8%", alignItems: "center" }]}>
                      <Text>{scores[c.key] ?? "—"}</Text>
                    </View>
                  ))}
                  <View style={[styles.tableCell, { width: "10%", alignItems: "center" }, styles.tableCellLast]}>
                    <Text style={styles.bold}>{row.total ?? "—"}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ marginTop: 8, borderWidth: 1, borderColor: "#000000", padding: 6 }}>
            <View style={{ flexDirection: "row", marginBottom: 3 }}>
              <Text style={{ width: "35%", fontFamily: "Times-Bold" }}>Submitted by Guide:</Text>
              <Text style={styles.signText}>
                {data.mock.submittedSign?.name
                  ? `Signed by ${data.mock.submittedSign.name} on ${data.mock.submittedSign.at ? new Date(data.mock.submittedSign.at).toLocaleDateString("en-GB") : ""}`
                  : "Pending"}
              </Text>
            </View>
            <View style={{ flexDirection: "row" }}>
              <Text style={{ width: "35%", fontFamily: "Times-Bold" }}>HOD / Committee Sign:</Text>
              <Text style={styles.signText}>
                {data.mock.approvedSign?.name
                  ? `Signed by ${data.mock.approvedSign.name} on ${data.mock.approvedSign.at ? new Date(data.mock.approvedSign.at).toLocaleDateString("en-GB") : ""}`
                  : data.mock.rows?.[0]?.approvedByName
                    ? `Signed by ${data.mock.rows[0].approvedByName}`
                    : "Pending Approval"}
              </Text>
            </View>
          </View>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {/* ========================================================
          12. FINAL EVALUATION TERM-II
         ======================================================== */}
      <Page size="A4" style={styles.page}>
        <Header logos={logos} />
        <View style={styles.contentBody}>
          <Text style={styles.sheetTitle}>Final Evaluation Term-II</Text>
          <Text style={styles.sheetSubtitle}>Total 100 Marks · Refer Rubrics for Details</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableRowHeader]}>
              <View style={[styles.tableCell, { width: "12%" }]}>
                <Text>Roll No</Text>
              </View>
              <View style={[styles.tableCell, { width: "22%" }]}>
                <Text>Student</Text>
              </View>
              {FINAL_T2_COMPONENTS.map((c) => (
                <View key={c.key} style={[styles.tableCell, { width: "8%", alignItems: "center" }]}>
                  <Text style={{ fontSize: 6.5 }}>{c.label.slice(0, 8)} ({c.max})</Text>
                </View>
              ))}
              <View style={[styles.tableCell, { width: "10%", alignItems: "center" }]}>
                <Text>Total ({FINAL_T2_TOTAL})</Text>
              </View>
            </View>
            {data.final.rows.map((row) => {
              const scores = (row as any).scores || (row as any).components || {};
              const memberRollNo =
                row.rollNo ||
                groupInfo.members.find((m) => m.id === row.memberId || m.userId === row.memberId)?.rollNo ||
                "—";
              return (
                <View key={row.memberId} style={styles.tableRow}>
                  <View style={[styles.tableCell, { width: "12%" }]}>
                    <Text>{memberRollNo}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "22%" }]}>
                    <Text>{row.memberName}</Text>
                  </View>
                  {FINAL_T2_COMPONENTS.map((c) => (
                    <View key={c.key} style={[styles.tableCell, { width: "8%", alignItems: "center" }]}>
                      <Text>{scores[c.key] ?? "—"}</Text>
                    </View>
                  ))}
                  <View style={[styles.tableCell, { width: "10%", alignItems: "center" }, styles.tableCellLast]}>
                    <Text style={styles.bold}>{row.total ?? "—"}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ marginTop: 8, borderWidth: 1, borderColor: "#000000", padding: 6 }}>
            <View style={{ flexDirection: "row", marginBottom: 3 }}>
              <Text style={{ width: "35%", fontFamily: "Times-Bold" }}>Submitted by Guide:</Text>
              <Text style={styles.signText}>
                {data.final.submittedSign?.name
                  ? `Signed by ${data.final.submittedSign.name} on ${data.final.submittedSign.at ? new Date(data.final.submittedSign.at).toLocaleDateString("en-GB") : ""}`
                  : "Pending"}
              </Text>
            </View>
            <View style={{ flexDirection: "row" }}>
              <Text style={{ width: "35%", fontFamily: "Times-Bold" }}>HOD / Committee Sign:</Text>
              <Text style={styles.signText}>
                {data.final.approvedSign?.name
                  ? `Signed by ${data.final.approvedSign.name} on ${data.final.approvedSign.at ? new Date(data.final.approvedSign.at).toLocaleDateString("en-GB") : ""}`
                  : data.final.rows?.[0]?.approvedByName
                    ? `Signed by ${data.final.rows[0].approvedByName}`
                    : "Pending Approval"}
              </Text>
            </View>
          </View>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {/* ========================================================
          13. EXAMINER FEEDBACK (Term-I & Term-II)
         ======================================================== */}
      {[data.examinerI, data.examinerII].map((ex, exIdx) => {
        if (!ex) return null;
        return (
          <Page key={`examiner-term-${exIdx}`} size="A4" style={styles.page}>
            <Header logos={logos} />
            <View style={styles.contentBody}>
              <Text style={styles.sheetTitle}>External Examiner Feedback</Text>
              <Text style={styles.sheetSubtitle}>
                {ex.term === "TERM_I" ? "Term-I" : "Term-II"} | Internal: {ex.internalName || "—"} | External: {ex.externalName || "—"}
              </Text>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableRowHeader]}>
                  <View style={[styles.tableCell, { width: "70%" }]}>
                    <Text>Feedback Parameter / Question</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "30%" }, styles.tableCellLast]}>
                    <Text>Rating</Text>
                  </View>
                </View>
                {EXAMINER_QUESTIONS.map((q, qIdx) => (
                  <View key={qIdx} style={styles.tableRow}>
                    <View style={[styles.tableCell, { width: "70%" }]}>
                      <Text>{q}</Text>
                    </View>
                    <View style={[styles.tableCell, { width: "30%" }, styles.tableCellLast]}>
                      <Text style={styles.bold}>{ex.answers[`q${qIdx + 1}`] || "Good"}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 6, borderWidth: 1, borderColor: "#000000", padding: 6 }}>
                <Text style={[styles.sansBold, { fontSize: 8 }]}>General Remarks:</Text>
                <Text style={{ fontSize: 8, marginVertical: 2 }}>{(ex as any).remarks || ex.generalRemarks || "None"}</Text>
                <View style={{ flexDirection: "row", marginTop: 4 }}>
                  <Text style={{ width: "50%", fontFamily: "Times-Bold", fontSize: 7.5 }}>
                    External Examiner: {ex.externalSign?.name ? `Signed (${ex.externalSign.name})` : ex.externalName ? `Signed (${ex.externalName})` : "Signed"}
                  </Text>
                  <Text style={{ width: "50%", fontFamily: "Times-Bold", fontSize: 7.5 }}>
                    Internal Examiner: {ex.internalSign?.name ? `Signed (${ex.internalSign.name})` : ex.internalName ? `Signed (${ex.internalName})` : "Signed"}
                  </Text>
                </View>
              </View>
            </View>
            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
              fixed
            />
          </Page>
        );
      })}

      {/* ========================================================
          14. SUBMISSION CHECKLISTS (Term-I & Term-II)
         ======================================================== */}
      {[data.checklistI, data.checklistII].map((chk, cIdx) => {
        if (!chk) return null;
        return (
          <Page key={`checklist-term-${cIdx}`} size="A4" style={styles.page}>
            <Header logos={logos} />
            <View style={styles.contentBody}>
              <Text style={styles.sheetTitle}>Submission Checklist</Text>
              <Text style={styles.sheetSubtitle}>
                {chk.term === "TERM_I" ? "Term-I Submission" : "Term-II Final Submission"}
              </Text>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableRowHeader]}>
                  <View style={[styles.tableCell, { width: "12%", alignItems: "center" }]}>
                    <Text>Sr.</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "68%" }]}>
                    <Text>Checklist Item</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "20%" }, styles.tableCellLast]}>
                    <Text>Status</Text>
                  </View>
                </View>
                {(chk.items || []).map((item, itIdx) => (
                  <View key={(item as any).key || (item as any).text || itIdx} style={styles.tableRow}>
                    <View style={[styles.tableCell, { width: "12%", alignItems: "center" }]}>
                      <Text>{itIdx + 1}</Text>
                    </View>
                    <View style={[styles.tableCell, { width: "68%" }]}>
                      <Text>{(item as any).label || (item as any).text || "Checklist item"}</Text>
                    </View>
                    <View style={[styles.tableCell, { width: "20%" }, styles.tableCellLast]}>
                      <Text style={{ color: item.checked ? "#166534" : "#991b1b", fontFamily: "Times-Bold" }}>
                        {item.checked ? "Complete" : "Pending"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 8, borderWidth: 1, borderColor: "#000000", padding: 6 }}>
                <View style={{ flexDirection: "row", marginBottom: 2 }}>
                  <Text style={{ width: "35%", fontFamily: "Times-Bold" }}>Student Sign:</Text>
                  <Text style={styles.signText}>
                    {chk.studentSign?.name
                      ? `Signed by ${chk.studentSign.name} on ${chk.studentSign.at ? new Date(chk.studentSign.at).toLocaleDateString("en-GB") : ""}`
                      : "Signed"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row" }}>
                  <Text style={{ width: "35%", fontFamily: "Times-Bold" }}>Guide Sign:</Text>
                  <Text style={styles.signText}>
                    {chk.guideSign?.name
                      ? `Signed by ${chk.guideSign.name} on ${chk.guideSign.at ? new Date(chk.guideSign.at).toLocaleDateString("en-GB") : ""}`
                      : "Verified"}
                  </Text>
                </View>
              </View>
            </View>
            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
              fixed
            />
          </Page>
        );
      })}

      {/* ========================================================
          15. COMPETITIONS
         ======================================================== */}
      <Page size="A4" style={styles.page}>
        <Header logos={logos} />
        <View style={styles.contentBody}>
          <Text style={styles.sheetTitle}>Project Competition Participation</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableRowHeader]}>
              <View style={[styles.tableCell, { width: "8%", alignItems: "center" }]}>
                <Text>Sr.</Text>
              </View>
              <View style={[styles.tableCell, { width: "34%" }]}>
                <Text>Competition Name</Text>
              </View>
              <View style={[styles.tableCell, { width: "16%" }]}>
                <Text>Date</Text>
              </View>
              <View style={[styles.tableCell, { width: "24%" }]}>
                <Text>College & Level</Text>
              </View>
              <View style={[styles.tableCell, { width: "18%" }, styles.tableCellLast]}>
                <Text>Award</Text>
              </View>
            </View>
            {data.competitions.length > 0 ? (
              data.competitions.map((comp, idx) => (
                <View key={comp.id || idx} style={styles.tableRow}>
                  <View style={[styles.tableCell, { width: "8%", alignItems: "center" }]}>
                    <Text>{idx + 1}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "34%" }]}>
                    <Text>{comp.name}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "16%" }]}>
                    <Text>{comp.date || "—"}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "24%" }]}>
                    <Text>{comp.collegeAndLevel || "—"}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "18%" }, styles.tableCellLast]}>
                    <Text style={styles.bold}>{comp.award || "Participation"}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, { width: "100%" }, styles.tableCellLast]}>
                  <Text style={{ textAlign: "center", color: "#888888" }}>No entries recorded</Text>
                </View>
              </View>
            )}
          </View>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {/* ========================================================
          16. PAPER PUBLICATIONS
         ======================================================== */}
      <Page size="A4" style={styles.page}>
        <Header logos={logos} />
        <View style={styles.contentBody}>
          <Text style={styles.sheetTitle}>Paper Publication</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableRowHeader]}>
              <View style={[styles.tableCell, { width: "8%", alignItems: "center" }]}>
                <Text>Sr.</Text>
              </View>
              <View style={[styles.tableCell, { width: "38%" }]}>
                <Text>Title of Paper</Text>
              </View>
              <View style={[styles.tableCell, { width: "28%" }]}>
                <Text>Conference / Journal</Text>
              </View>
              <View style={[styles.tableCell, { width: "14%" }]}>
                <Text>ISSN / Volume</Text>
              </View>
              <View style={[styles.tableCell, { width: "12%" }, styles.tableCellLast]}>
                <Text>Page No</Text>
              </View>
            </View>
            {data.papers.length > 0 ? (
              data.papers.map((pap, idx) => (
                <View key={pap.id || idx} style={styles.tableRow}>
                  <View style={[styles.tableCell, { width: "8%", alignItems: "center" }]}>
                    <Text>{idx + 1}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "38%" }]}>
                    <Text>{pap.title}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "28%" }]}>
                    <Text>{pap.conference}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "14%" }]}>
                    <Text>{pap.issn || pap.volIssue || "—"}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "12%" }, styles.tableCellLast]}>
                    <Text>{pap.pageNo || "—"}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, { width: "100%" }, styles.tableCellLast]}>
                  <Text style={{ textAlign: "center", color: "#888888" }}>No papers recorded</Text>
                </View>
              </View>
            )}
          </View>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {/* ========================================================
          17. SPONSORED PROJECT (Only if group is sponsored)
         ======================================================== */}
      {data.sponsored ? (
        <Page size="A4" style={styles.page}>
          <Header logos={logos} />
          <View style={styles.contentBody}>
            <Text style={styles.sheetTitle}>Sponsored Project Details</Text>
            <View style={{ borderWidth: 1, borderColor: "#000000", padding: 6, marginBottom: 8 }}>
              <Text style={[styles.sansBold, { fontSize: 8.5 }]}>
                Sponsoring Company: {data.sponsored.feedback.company || "—"}
              </Text>
            </View>

            <Text style={[styles.sansBold, { fontSize: 8.5, marginBottom: 4 }]}>
              Sponsor Feedback Ratings:
            </Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableRowHeader]}>
                <View style={[styles.tableCell, { width: "65%" }]}>
                  <Text>Parameter</Text>
                </View>
                <View style={[styles.tableCell, { width: "35%" }, styles.tableCellLast]}>
                  <Text>Rating</Text>
                </View>
              </View>
              {Object.entries(data.sponsored.feedback.ratings || {}).map(([param, rating], idx) => (
                <View key={idx} style={styles.tableRow}>
                  <View style={[styles.tableCell, { width: "65%" }]}>
                    <Text>{param}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: "35%" }, styles.tableCellLast]}>
                    <Text style={styles.bold}>{rating}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            fixed
          />
        </Page>
      ) : null}

      {/* ========================================================
          18. NOTES
         ======================================================== */}
      <Page size="A4" style={styles.page}>
        <Header logos={logos} />
        <View style={styles.contentBody}>
          <Text style={styles.sheetTitle}>Project Notes</Text>
          <View style={{ borderWidth: 1, borderColor: "#000000", padding: 8, minHeight: 250 }}>
            {data.notes.length > 0 ? (
              data.notes.map((note, idx) => (
                <View key={note.id || idx} style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 8.5, lineHeight: 1.4 }}>
                    • {note.richText || "Note entry"}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 8.5, color: "#888888" }}>
                No general notes recorded.
              </Text>
            )}
          </View>
        </View>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
