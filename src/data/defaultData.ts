import { SchoolBranding, ScoreColumn, SubjectColumn, GradeScale, Student, StudentGrades, ReportCardStructure } from '../types';

export const initialBranding: SchoolBranding = {
  schoolName: "DEMO PUBLIC SCHOOL",
  address: "Pocket 2, Mayur Vihar Phase 1, New Delhi 110091, India",
  helpline: "+91 8000436766",
  email: "info@schoolreportcard.in",
  website: "www.schoolreportcard.in",
  session: "Session 2022-2023",
  reportCardTitle: "Annual Examination Report Card",
  logoUrl: "", // We can use a clean dynamically generated school SVG logo inside the component
  themeColor: "#DE2F2F", // Stylish deep red from School Report Card's brand
  borderColor: "#C22121",
  showWatermark: true,
  watermarkType: 'logo',
  watermarkText: "",
  watermarkLogoUrl: "",
  watermarkSize: 320,
  signParentName: "Parent's Signature",
  signInchargeName: "Class Incharge Signature",
  signPrincipalName: "Principal Signature",
  tagline: "Affiliated to CBSE Board (Affiliation No. 123456)",
  schoolNameFontSize: 32,
  headerDetailsFontSize: 10.5,
  logoSize: 92,
  coCurricularDisabled: false,
  congratulationsDisabled: false,
  studentPhotoDisabled: false,
  term1Enabled: true,
  term2Enabled: true,
  term1Label: "Academic Term I",
  term2Label: "Academic Term II",
  scholasticLabel: "Scholastic Performance",
  term1ExamLabel: "Half Yearly",
  term2ExamLabel: "Annual",
  term1TotalLabel: "T1 Total",
  term2TotalLabel: "T2 Total",
  personalityHeaderLabel: "PART 2: PERSONALITY & CO-SCHOLASTIC (5-POINT GRADE SCALE)",
  personalitySubjectHeaderLabel: "SUBJECT AREA DOMAINS",
  coCurricularHeaderLabel: "PART 3: CO-CURRICULAR AREA & SKILLS (3-POINT GRADE SCALE)",
  coCurricularSubjectHeaderLabel: "ACTIVITY AREAS & SKILLS",
  attendanceLabel: "Working Attendance",
  attendancePresenceLabel: "Class Attendance Presence:",
  gradePercentageLabel: "Overall Percentage",
  boardGradeLabel: "Overall Grade",
  scholasticSummaryLabel: "Scholastic Summary",
  totalMarksObtainedLabel: "Total Marks Obtained"
};

export const defaultScoreColumns: ScoreColumn[] = [
  { id: "pt", name: "Periodic Test", maxMarks: 10, sequence: 0 },
  { id: "nb", name: "NB", maxMarks: 5, sequence: 1 },
  { id: "se", name: "SE", maxMarks: 5, sequence: 2 },
  { id: "mid_term", name: "Mid-Term", maxMarks: 80, sequence: 3 }
];

export const defaultSubjects: SubjectColumn[] = [
  // Scholastic
  { id: "english", name: "English", type: "scholastic" },
  { id: "hindi", name: "Hindi", type: "scholastic" },
  { id: "punjabi", name: "Punjabi", type: "scholastic" },
  { id: "mathematics", name: "Mathematics", type: "scholastic" },
  { id: "science", name: "Science", type: "scholastic" },
  { id: "social_science", name: "Social Science", type: "scholastic" },
  
  // Co-scholastic
  { id: "gk", name: "General Knowledge", type: "co_scholastic" },
  { id: "computer", name: "Computer", type: "co_scholastic" },
  { id: "pe", name: "Physical Education", type: "co_scholastic" },
  
  // Activities
  { id: "neatness", name: "Neatness", type: "activity" },
  { id: "speaking_listening", name: "Speaking and Listening", type: "activity" },
  { id: "music_dance", name: "Music/Dance", type: "activity" }
];

export const defaultGradeScales: GradeScale[] = [
  { minPercent: 91, maxPercent: 100, grade: "A1" },
  { minPercent: 81, maxPercent: 90, grade: "A2" },
  { minPercent: 71, maxPercent: 80, grade: "B1" },
  { minPercent: 61, maxPercent: 70, grade: "B2" },
  { minPercent: 51, maxPercent: 60, grade: "C1" },
  { minPercent: 41, maxPercent: 50, grade: "C2" },
  { minPercent: 33, maxPercent: 40, grade: "D" },
  { minPercent: 0, maxPercent: 32, grade: "E" }
];

export const defaultStudents: Student[] = [
  {
    id: "stud_1",
    name: "Meera Malhotra",
    fatherName: "Mr. Vikrant Malhotra",
    motherName: "Mrs. Ridhi Malhotra",
    className: "3rd",
    section: "A",
    rollNo: "10",
    admissionNo: "100525",
    dob: "04-10-2013",
    height: "122 CM",
    weight: "40 KG",
    photoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", // Clean portrait template photo
    remarks: "Meera's academic performance is very good. Meera is a friendly student, shows respect for teachers and peers, and works very well within a team.",
    promotionStatus: "Congratulations! You are promoted to 4th"
  },
  {
    id: "stud_2",
    name: "Aarav Sharma",
    fatherName: "Mr. Devendra Sharma",
    motherName: "Mrs. Neeta Sharma",
    className: "3rd",
    section: "A",
    rollNo: "12",
    admissionNo: "100530",
    dob: "12-05-2013",
    height: "125 CM",
    weight: "42 KG",
    photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    remarks: "Aarav is very inquisitive and excels in mathematics. Keep up the brilliant concentration and analytical work.",
    promotionStatus: "Congratulations! You are promoted to 4th"
  },
  {
    id: "stud_3",
    name: "Sanya Patel",
    fatherName: "Mr. Ramesh Patel",
    motherName: "Mrs. Sarla Patel",
    className: "3rd",
    section: "B",
    rollNo: "15",
    admissionNo: "100542",
    dob: "21-09-2013",
    height: "120 CM",
    weight: "38 KG",
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    remarks: "Sanya has excellent artistic abilities. Sanya is a dedicated student and helpful classmate. Highly recommended.",
    promotionStatus: "Congratulations! You are promoted to 4th"
  }
];

export const defaultStudentGrades: StudentGrades[] = [
  {
    studentId: "stud_1",
    scholastic: {
      english: {
        term1: { pt: 10, nb: 4, se: 4, mid_term: 76 },
        term2: { pt: 8, nb: 4, se: 5, mid_term: 71 }
      },
      hindi: {
        term1: { pt: 8, nb: 4, se: 5, mid_term: 68 },
        term2: { pt: 9, nb: 5, se: 4, mid_term: 78 }
      },
      punjabi: {
        term1: { pt: 10, nb: 5, se: 5, mid_term: 75 },
        term2: { pt: 9, nb: 3, se: 5, mid_term: 75 }
      },
      mathematics: {
        term1: { pt: 7, nb: 4, se: 3, mid_term: 58 },
        term2: { pt: 10, nb: 4, se: 5, mid_term: 80 }
      },
      science: {
        term1: { pt: 9, nb: 4, se: 5, mid_term: 49 },
        term2: { pt: 7, nb: 3, se: 3, mid_term: 67 }
      },
      social_science: {
        term1: { pt: 9, nb: 3, se: 4, mid_term: 66 },
        term2: { pt: 6, nb: 5, se: 5, mid_term: 59 }
      }
    },
    co_scholastic: {
      gk: { term1: "A", term2: "A" },
      computer: { term1: "C", term2: "A" },
      pe: { term1: "A", term2: "B" }
    },
    activity: {
      neatness: { term1: "A", term2: "A" },
      speaking_listening: { term1: "A", term2: "A" },
      music_dance: { term1: "B", term2: "A" }
    },
    attendance: {
      term1: "99/105",
      term2: "101/105"
    }
  },
  {
    studentId: "stud_2",
    scholastic: {
      english: {
        term1: { pt: 8, nb: 4, se: 4, mid_term: 72 },
        term2: { pt: 8, nb: 4, se: 4, mid_term: 74 }
      },
      hindi: {
        term1: { pt: 8, nb: 4, se: 4, mid_term: 65 },
        term2: { pt: 8, nb: 4, se: 4, mid_term: 70 }
      },
      punjabi: {
        term1: { pt: 9, nb: 4, se: 5, mid_term: 70 },
        term2: { pt: 9, nb: 4, se: 4, mid_term: 72 }
      },
      mathematics: {
        term1: { pt: 10, nb: 5, se: 5, mid_term: 78 },
        term2: { pt: 10, nb: 5, se: 5, mid_term: 79 }
      },
      science: {
        term1: { pt: 9, nb: 4, se: 4, mid_term: 75 },
        term2: { pt: 9, nb: 4, se: 4, mid_term: 76 }
      },
      social_science: {
        term1: { pt: 8, nb: 4, se: 4, mid_term: 68 },
        term2: { pt: 8, nb: 4, se: 4, mid_term: 70 }
      }
    },
    co_scholastic: {
      gk: { term1: "A", term2: "A" },
      computer: { term1: "A", term2: "A" },
      pe: { term1: "A", term2: "A" }
    },
    activity: {
      neatness: { term1: "B", term2: "A" },
      speaking_listening: { term1: "A", term2: "A" },
      music_dance: { term1: "A", term2: "B" }
    },
    attendance: {
      term1: "102/105",
      term2: "104/105"
    }
  },
  {
    studentId: "stud_3",
    scholastic: {
      english: {
        term1: { pt: 9, nb: 5, se: 5, mid_term: 74 },
        term2: { pt: 9, nb: 5, se: 5, mid_term: 76 }
      },
      hindi: {
        term1: { pt: 9, nb: 4, se: 4, mid_term: 70 },
        term2: { pt: 9, nb: 4, se: 4, mid_term: 73 }
      },
      punjabi: {
        term1: { pt: 8, nb: 4, se: 4, mid_term: 68 },
        term2: { pt: 9, nb: 4, se: 4, mid_term: 70 }
      },
      mathematics: {
        term1: { pt: 8, nb: 4, se: 4, mid_term: 65 },
        term2: { pt: 9, nb: 4, se: 4, mid_term: 68 }
      },
      science: {
        term1: { pt: 9, nb: 4, se: 4, mid_term: 72 },
        term2: { pt: 9, nb: 4, se: 4, mid_term: 74 }
      },
      social_science: {
        term1: { pt: 9, nb: 4, se: 4, mid_term: 70 },
        term2: { pt: 9, nb: 4, se: 4, mid_term: 72 }
      }
    },
    co_scholastic: {
      gk: { term1: "A", term2: "A" },
      computer: { term1: "A", term2: "A" },
      pe: { term1: "B", term2: "A" }
    },
    activity: {
      neatness: { term1: "A", term2: "A" },
      speaking_listening: { term1: "A", term2: "A" },
      music_dance: { term1: "A", term2: "A" }
    },
    attendance: {
      term1: "95/105",
      term2: "98/105"
    }
  }
];

export const defaultReportCardStructures: ReportCardStructure[] = [];

