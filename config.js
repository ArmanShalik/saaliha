// ============================================================
//  ExamTrack — Configuration
//  Edit this file to customise subjects, papers, and settings
// ============================================================

const CONFIG = {

  // ── Google Integration ──────────────────────────────────────
  // After deploying your Apps Script as a Web App, paste the URL below.
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbycfPmSWnyiGrJG-bjxKcsvF78tAlJa9R0NjMmm-N3alZfgg4iXSibuDe7VlhpjKKI2_Q/exec",

  // The student's name shown on the portal
  STUDENT_NAME: "Ameena Saaliha",

  // ── Subjects & Papers ───────────────────────────────────────
  SUBJECTS: [
    {
      id: "BIOLOGY",
      name: "Biology",
      code: "BIO",
      color: "#047857",
      colorLight: "#ECFDF5",
      colorMid: "#6EE7B7",
      papers: [
        { id: "P1", name: "Paper I",   type: "MCQ",        defaultTotal: 50  },
        { id: "P2", name: "Paper II",  type: "Structured", defaultTotal: 100 },
        { id: "P3", name: "Paper III", type: "Essay",      defaultTotal: 100 }
      ]
    },
    {
      id: "PHYSICS",
      name: "Physics",
      code: "PHY",
      color: "#1D4ED8",
      colorLight: "#EFF6FF",
      colorMid: "#93C5FD",
      papers: [
        { id: "P1", name: "Paper I",   type: "MCQ",        defaultTotal: 50  },
        { id: "P2", name: "Paper II",  type: "Structured", defaultTotal: 100 },
        { id: "P3", name: "Paper III", type: "Essay",      defaultTotal: 100 }
      ]
    },
    {
      id: "CHEMISTRY",
      name: "Chemistry",
      code: "CHE",
      color: "#7C3AED",
      colorLight: "#F5F3FF",
      colorMid: "#C4B5FD",
      papers: [
        { id: "P1", name: "Paper I",   type: "MCQ",        defaultTotal: 50  },
        { id: "P2", name: "Paper II",  type: "Structured", defaultTotal: 100 },
        { id: "P3", name: "Paper III", type: "Essay",      defaultTotal: 100 }
      ]
    }
  ],

  // ── Exam Types ──────────────────────────────────────────────
  EXAM_TYPES: [
    "OBT",
    "MCQ",
    "Essay",
    "Full Paper",
    "Term Exam",
    "Past Paper Practice",
    "Model Paper"
  ],

  // ── Grading Scale (Sri Lankan A/L) ─────────────────────────
  GRADES: [
    { label: "A",  min: 75, color: "#047857", bg: "#ECFDF5" },
    { label: "B",  min: 65, color: "#1D4ED8", bg: "#EFF6FF" },
    { label: "C",  min: 55, color: "#0891B2", bg: "#ECFEFF" },
    { label: "S",  min: 35, color: "#D97706", bg: "#FFFBEB" },
    { label: "F",  min: 0,  color: "#DC2626", bg: "#FEF2F2" }
  ]
};
