export interface SchoolBranding {
  schoolName: string;
  address: string;
  helpline: string;
  email: string;
  website: string;
  session: string;
  reportCardTitle?: string;
  logoUrl: string;
  rightLogoUrl?: string;
  rightLogoSize?: number;
  themeColor: string;
  borderColor: string;
  showWatermark: boolean;
  watermarkText: string;
  watermarkType?: 'text' | 'logo';
  watermarkLogoUrl?: string;
  watermarkOpacity?: number;
  watermarkSize?: number;
  watermarkLayout?: 'center' | 'full_page';
  watermarkFit?: 'cover' | 'fill' | 'contain';
  logoSize?: number;
  logoCircular?: boolean;
  logoBorder?: boolean;
  nameBannerUrl?: string;
  hideSchoolDetails?: boolean;
  schoolNameFontSize?: number;
  schoolNameFontFamily?: string;
  headerDetailsFontSize?: number;
  headerDetailsFontFamily?: string;
  reportCardTitleFontSize?: number;
  signParentName: string;
  signInchargeName: string;
  signPrincipalName: string;
  tagline: string;
  term1Enabled?: boolean;
  term2Enabled?: boolean;
  term3Enabled?: boolean;
  term1Label?: string;
  term2Label?: string;
  term3Label?: string;
  scholasticLabel?: string;
  scholasticPerformanceHeaderLabel?: string;
  gradingScaleRulesHeading?: string;
  term1ExamLabel?: string;
  term2ExamLabel?: string;
  term3ExamLabel?: string;
  term1TotalLabel?: string;
  term2TotalLabel?: string;
  term3TotalLabel?: string;
  semestersHeaderLabel?: string;
  scholasticSubjectsHeaderLabel?: string;
  overallResultsHeaderLabel?: string;
  totalMarksHeaderLabel?: string;
  gradeHeaderLabel?: string;
  personalityHeaderLabel?: string;
  personalitySubjectHeaderLabel?: string;
  coCurricularHeaderLabel?: string;
  coCurricularSubjectHeaderLabel?: string;
  useCustomBranding?: boolean;
  overrideIdentity?: boolean;
  showMinMarksColumn?: boolean;
  showMaxMarksColumn?: boolean;
  showObtainedMarksColumn?: boolean;
  minMarksHeaderLabel?: string;
  maxMarksHeaderLabel?: string;
  obtainedMarksHeaderLabel?: string;
  studentNameLabel?: string;
  fatherNameLabel?: string;
  motherNameLabel?: string;
  dobLabel?: string;
  heightLabel?: string;
  classLabel?: string;
  sectionLabel?: string;
  rollNoLabel?: string;
  admissionNoLabel?: string;
  weightLabel?: string;
  studentFields?: Array<{ id: string; label: string; disabled?: boolean; disabledAll?: boolean; disabledClasses?: string[] }>;
  coCurricularDisabled?: boolean;
  congratulationsDisabled?: boolean;
  studentPhotoDisabled?: boolean;
  // Parents Portal Visibility Configs
  parentPortalAnalyticsDisabled?: boolean;
  parentPortalReportCardDisabled?: boolean;
  parentPortalAttendanceDisabled?: boolean;
  parentPortalRemarksDisabled?: boolean;
  parentPortalTopperStatsDisabled?: boolean;
  printOrientation?: 'portrait' | 'landscape';
  lockScreenTitle?: string;
  lockScreenDesc?: string;
  lockScreenFooter?: string;
  attendanceLabel?: string;
  attendancePresenceLabel?: string;
  gradePercentageLabel?: string;
  boardGradeLabel?: string;
  scholasticSummaryLabel?: string;
  totalMarksObtainedLabel?: string;
  additionalSubjectsEnabled?: boolean;
  additionalSubjectsHeaderLabel?: string;
  additionalSubjectsAfterAttendance?: boolean;
  parentPortalLoginConfig?: ParentPortalLoginConfig;
}

export interface ParentPortalLoginConfig {
  rollNoDobEnabled?: boolean;          // Option 1: Roll No + DOB (Default: true)
  admissionNoDobEnabled?: boolean;     // Option 2: Admission No + DOB (Default: true)
  mobileRollNoEnabled?: boolean;       // Option 3: Mobile No + Roll No (Default: false)
  mobileAdmissionNoEnabled?: boolean;  // Option 4: Mobile No + Admission No (Default: false)
  defaultLoginMode?: 'roll_dob' | 'adm_dob' | 'mob_roll' | 'mob_adm';
}

export interface ScoreColumn {
  id: string;
  name: string;
  maxMarks: number;
  minMarks?: number; // Pass/Minimum marks (e.g. 33 for 100 maxMarks)
  sequence?: number;
}

export interface SubjectColumn {
  id: string; // unique subject id e.g. "english"
  name: string; // "English"
  type: 'scholastic' | 'co_scholastic' | 'activity' | 'custom' | 'additional';
  sectionId?: string; // dynamic section mapping
  group?: string; // e.g. "Language & Literacy", "Numeracy & Logic", "Physical & Motor Skills", "Personal & Social Development"
  sequence?: number;
  maxMarks?: number;
  customMaxMarks?: { [columnId: string]: number };
}

export interface GradeScale {
  minPercent: number;
  maxPercent: number;
  grade: string;
}

export interface CoGradeScale {
  score: string;
  description: string;
}

export interface Student {
  id: string;
  name: string;
  fatherName?: string;
  motherName?: string;
  className: string;
  section: string;
  rollNo: string;
  admissionNo: string;
  dob: string;
  height: string;
  weight: string;
  photoUrl: string;
  remarks: string;
  promotionStatus: string; // e.g. "Congratulations! You are promoted to 4th"
  mobileNumber?: string;
  history?: StudentHistoryRecord[];
}

export interface StudentHistoryRecord {
  session: string;
  className: string;
  section: string;
  rollNo: string;
  remarks: string;
  promotionStatus: string;
  mobileNumber?: string;
  grades: StudentGrades;
}

export interface CourseScore {
  term1: { [colId: string]: number }; // colId -> marks
  term2: { [colId: string]: number };
  term3?: { [colId: string]: number };
}

export interface CoCourseScore {
  term1: string; // grade like 'A'
  term2: string; // grade like 'B'
  term3?: string; // grade like 'C'
}

export interface StudentGrades {
  studentId: string;
  scholastic: { [subjectId: string]: CourseScore };
  co_scholastic: { [subjectId: string]: CoCourseScore };
  activity: { [subjectId: string]: CoCourseScore };
  attendance: {
    term1: string; // e.g. 99/105
    term2: string; // e.g. 101/105
    term3?: string;
  };
}

export interface SubjectAssignment {
  className: string;
  section: string;
  subjects: string[];
}

export interface SaasTeacher {
  id: string;
  name: string;
  username: string;
  password: string;
  assignedClass: string;
  assignedSection: string;
  isClassTeacher?: boolean;
  classTeacherClass?: string;
  classTeacherSection?: string;
  isSubjectTeacher?: boolean;
  subjectAssignments?: SubjectAssignment[];
}

export interface SaasSchool {
  id: string;
  name: string;
  username: string;
  password: string;
  teachers?: SaasTeacher[];
  portalCode?: string;
  ownerId?: string | null;
  saasOwnerPin?: string;
  cloudSynced?: boolean;
  isOfflineCreated?: boolean;
  
  // School Registration fields
  contactPerson?: string;
  address?: string;
  mobile?: string;
  email?: string;
  board?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  trialUntil?: string; // trial expiration date string
  trialPrice?: string; // custom charge text or amount
  trialHours?: number; // duration assigned
  securityEnforceSSO?: boolean; // toggle to enforce passwordless Google Sign-In Only
  reportCardStructures?: ReportCardStructure[];
  maxStudentsLimit?: number;
  maxTeachersLimit?: number;
  maxStructuresLimit?: number;
  cumulativeStudentsCount?: number;
  activeStudentsCount?: number;
  maxCumulativeStudentsLimit?: number;
  partnershipType?: 'trial' | 'annual' | 'pending_activation';
  createdAt?: string;
  referredByAgentId?: string | null;
  referredByAgentCode?: string | null;
  annualPrice?: number;
  pricingTiers?: PricingTier[];
  razorpayOrders?: any[];
  subscriptionRequest?: {
    studentCount: number;
    calculatedTotal: number;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: string;
    paymentStatus?: 'pending' | 'success' | 'failed';
    verificationMessage?: string;
  };
  classes?: SchoolClassItem[];
  classNamingStyle?: 'roman' | 'ordinal' | 'number' | 'custom';
}

export interface SchoolClassItem {
  id: string; // e.g. "class_1", "class_10"
  name: string; // e.g. "Class I" or "1st" or "Class 1"
  romanName?: string; // e.g. "Class I" or "I"
  ordinalName?: string; // e.g. "1st"
  sections: string[]; // e.g. ["A", "B"]
  orderIndex?: number;
}

export interface PricingTier {
  id: string;
  minStudents: number;
  maxStudents: number;
  pricePerStudent: number;
}

export interface SaasAgent {
  id: string; // doc ID, matches request.auth.uid
  name: string;
  email: string;
  code: string; // unique referral code e.g. AGENT-1234
  createdAt: string;
  commissionPercentage: number; // custom percentage, defaults to 10
  paymentDetails?: string; // bank or Paypal details
  status: 'active' | 'pending' | 'suspended';
}

export interface CoScholasticSection {
  id: string; // e.g., 'co_scholastic', 'activity', or custom parts like 'part_b'
  title: string; // e.g., "Personality & Co-Scholastic Traits (5-Point)"
  subjectHeader: string; // e.g., "Trait / Aspect"
  gradingScaleText?: string; // e.g., "5-Point Grading"
  term1Enabled: boolean;
  term2Enabled: boolean;
  term3Enabled?: boolean;
  type: 'co_scholastic' | 'activity' | 'custom';
  isDefault?: boolean;
}

export interface SignatureItem {
  id: string;
  label: string;
}

export interface ReportCardStructure {
  id: string;
  templateId?: string;
  name: string;
  assignedClasses: string[];
  useCustomBranding?: boolean;
  overrideIdentity?: boolean;
  branding: SchoolBranding;
  subjects: SubjectColumn[];
  scoreColumns: ScoreColumn[];
  termSpecificScoreColumnsEnabled?: boolean;
  term1ScoreColumns?: ScoreColumn[];
  term2ScoreColumns?: ScoreColumn[];
  term3ScoreColumns?: ScoreColumn[];
  gradeScales?: GradeScale[];
  coGradeScales?: CoGradeScale[];
  completedSections?: string[];
  scholasticTerm1Disabled?: boolean;
  scholasticTerm2Disabled?: boolean;
  scholasticTerm3Disabled?: boolean;
  coScholasticOneColumn?: boolean;
  coScholasticSections?: CoScholasticSection[];
  signatures?: SignatureItem[];
  hideGradingScale?: boolean;
  hideAttendance?: boolean;
  pureGradeBased?: boolean;
  gradingScaleAfterSignatures?: boolean;
  gradingScaleLayout?: 'side-by-side' | 'stacked';
  verticalExamHeaders?: boolean;
  verticalSubjectsHeader?: boolean;
  subjectSpecificMaxMarksEnabled?: boolean;
  enableSubjectGrouping?: boolean;
  customSubjectGroups?: string[];
  hideTerm1Total?: boolean;
  hideTerm1Grade?: boolean;
  hideTerm2Total?: boolean;
  hideTerm2Grade?: boolean;
  hideTerm3Total?: boolean;
  hideTerm3Grade?: boolean;
  hideOverallTotal?: boolean;
  hideOverallGrade?: boolean;
  showMinMarksColumn?: boolean;
  showMaxMarksColumn?: boolean;
  showObtainedMarksColumn?: boolean;
  minMarksHeaderLabel?: string;
  maxMarksHeaderLabel?: string;
  obtainedMarksHeaderLabel?: string;
  demoStudentName?: string;
  demoRollNo?: string;
  demoClassName?: string;
  demoFatherName?: string;
  demoMotherName?: string;
}

export interface SaasNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  sentAt: string;
  targetSchoolIds: string[]; // e.g. ['sc_xavier', 'sc_dps'] or ['all']
  readBy: string[]; // List of school IDs that have marked it read
}

export interface RecycleBinItem {
  id: string;
  type: 'student' | 'class_purge_option3' | 'class_purge_option2';
  deletedAt: string;
  description: string;
  payload: {
    students?: Student[];
    studentGrades?: StudentGrades[];
  };
}

export interface WithdrawalRequest {
  id: string;
  agentId: string;
  agentName: string;
  agentCode: string;
  amount: number;
  paymentDetails: string;
  status: 'pending' | 'processing' | 'approved' | 'paid' | 'rejected';
  requestedAt: string;
  processedAt?: string;
  remarks?: string;
  senderId?: string;
  senderName?: string;
  senderCode?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string; // 'admin' or schoolId or agentId
  senderName: string;
  senderRole: 'admin' | 'school' | 'agent';
  receiverId: string; // 'admin' or schoolId or agentId
  receiverName: string;
  receiverRole: 'admin' | 'school' | 'agent';
  message: string;
  sentAt: string;
  read: boolean;
}

export interface ReportCardTemplate {
  id: string;
  name: string;
  description?: string;
  assignedClasses: string[];
  overrideIdentity?: boolean;
  branding: SchoolBranding;
  subjects: SubjectColumn[];
  scoreColumns: ScoreColumn[];
  termSpecificScoreColumnsEnabled?: boolean;
  term1ScoreColumns?: ScoreColumn[];
  term2ScoreColumns?: ScoreColumn[];
  term3ScoreColumns?: ScoreColumn[];
  gradeScales?: GradeScale[];
  coGradeScales?: CoGradeScale[];
  completedSections?: string[];
  scholasticTerm1Disabled?: boolean;
  scholasticTerm2Disabled?: boolean;
  scholasticTerm3Disabled?: boolean;
  coScholasticOneColumn?: boolean;
  coScholasticSections?: CoScholasticSection[];
  signatures?: SignatureItem[];
  hideGradingScale?: boolean;
  hideAttendance?: boolean;
  pureGradeBased?: boolean;
  gradingScaleAfterSignatures?: boolean;
  gradingScaleLayout?: 'side-by-side' | 'stacked';
  verticalExamHeaders?: boolean;
  verticalSubjectsHeader?: boolean;
  subjectSpecificMaxMarksEnabled?: boolean;
  enableSubjectGrouping?: boolean;
  customSubjectGroups?: string[];
  hideTerm1Total?: boolean;
  hideTerm1Grade?: boolean;
  hideTerm2Total?: boolean;
  hideTerm2Grade?: boolean;
  hideTerm3Total?: boolean;
  hideTerm3Grade?: boolean;
  hideOverallTotal?: boolean;
  hideOverallGrade?: boolean;
  category?: string; // e.g. "Primary", "Secondary", "Nursery"
  demoStudentName?: string;
  demoRollNo?: string;
  demoClassName?: string;
  createdAt: string;
}

export interface TemplateRequest {
  id: string;
  templateId: string;
  templateName: string;
  schoolId: string;
  schoolName: string;
  status: 'pending' | 'assigned' | 'rejected';
  requestedAt: string;
  assignedAt?: string;
  targetClasses?: string[];
}

export interface TemplateRecycleBinItem {
  id: string;
  template: ReportCardTemplate;
  deletedAt: string;
}

export interface SaaSRecycleBinItem {
  id: string;
  type: 'school' | 'agent';
  deletedAt: string;
  description: string;
  payload: any;
}



