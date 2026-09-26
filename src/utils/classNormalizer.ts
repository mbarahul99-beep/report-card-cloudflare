import { SchoolClassItem, ReportCardStructure, SchoolBranding } from '../types';

export function toRomanNumeral(num: number): string {
  const map: [number, string][] = [
    [12, "XII"], [11, "XI"], [10, "X"], [9, "IX"], [8, "VIII"], [7, "VII"],
    [6, "VI"], [5, "V"], [4, "IV"], [3, "III"], [2, "II"], [1, "I"]
  ];
  for (const [val, roman] of map) {
    if (num === val) return roman;
  }
  return String(num);
}

export function toOrdinalSuffix(num: number): string {
  if (num === 1) return "1st";
  if (num === 2) return "2nd";
  if (num === 3) return "3rd";
  return `${num}th`;
}

/**
 * Utility to normalize class names for robust comparison across different panels
 * (e.g. "Class 3", "3rd", "III", "Class III", "3" will all normalize to "3" or standardized formats).
 */
export function normalizeClassName(name: string): string {
  if (!name) return "";
  let clean = name.toLowerCase().trim();
  
  // Normalize dots in L.K.G., U.K.G., P.G.
  // Strip section restriction if present: e.g. "Class 11 (Sec A)" -> "Class 11"
  clean = clean.replace(/\s*\(\s*(?:sec(?:tion)?\.?\s*)?[a-z0-9_-]+\s*\)$/i, "");
  clean = clean.replace(/\s*[-:]\s*(?:sec(?:tion)?\.?\s*)?[a-z0-9_-]+$/i, "");

  // Remove common prefixes: "class", "grade", "std", "standard" with optional spaces or dashes
  clean = clean.replace(/^(class|grade|std|standard)[-\s\.]+/g, "");

  // Remove common suffixes: "grade", "standard", "std" e.g. "1st grade", "1st standard"
  clean = clean.replace(/\s*(grade|standard|std)$/g, "");

  // Remove dots (e.g. L.K.G. -> LKG)
  clean = clean.replace(/\./g, "");

  // Normalize common synonyms
  if (clean === "playgroup" || clean === "pg" || clean === "play group" || clean === "pre nursery") {
    return "playgroup";
  }
  if (clean === "nursery" || clean === "nur") {
    return "nursery";
  }
  if (clean === "lkg" || clean === "lower kg" || clean === "jr kg" || clean === "junior kg") {
    return "lkg";
  }
  if (clean === "ukg" || clean === "upper kg" || clean === "sr kg" || clean === "senior kg") {
    return "ukg";
  }

  clean = clean.replace(/[-_]/g, " ").trim();

  // Convert word numbers to digits
  const wordToDigit: { [key: string]: string } = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
    "eleven": "11", "twelve": "12"
  };
  if (wordToDigit[clean]) {
    return wordToDigit[clean];
  }

  // Remove ordinal suffixes like "1st", "2nd", "3rd", "4th", "10th"
  clean = clean.replace(/^(\d+)(st|nd|rd|th)$/g, "$1");
  clean = clean.replace(/(\d+)(st|nd|rd|th)/g, "$1").trim();

  // Roman numerals translation
  const romanMap: { [key: string]: string } = {
    "i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5",
    "vi": "6", "vii": "7", "viii": "8", "ix": "9", "x": "10",
    "xi": "11", "xii": "12"
  };
  if (romanMap[clean]) {
    return romanMap[clean];
  }

  return clean;
}

/**
 * Checks if two class names match after normalization
 * e.g. classesMatch("Class III", "3rd") === true
 * e.g. classesMatch("Class X", "10th") === true
 * e.g. classesMatch("L.K.G.", "lkg") === true
 */
export function classesMatch(classA: string, classB: string): boolean {
  if (!classA || !classB) return false;
  return normalizeClassName(classA) === normalizeClassName(classB);
}

/**
 * Generate standard pre-configured classes and sections for a school
 */
export function getStandardClassPresets(style: 'roman' | 'ordinal' | 'number' = 'ordinal'): SchoolClassItem[] {
  const prePrimary: SchoolClassItem[] = [
    { id: "class_pg", name: "Playgroup", sections: ["A"], orderIndex: -3 },
    { id: "class_nursery", name: "Nursery", sections: ["A"], orderIndex: -2 },
    { id: "class_lkg", name: "LKG", sections: ["A"], orderIndex: -1 },
    { id: "class_ukg", name: "UKG", sections: ["A"], orderIndex: 0 },
  ];

  const grades: SchoolClassItem[] = [];
  for (let i = 1; i <= 12; i++) {
    const roman = toRomanNumeral(i);
    const ordinal = toOrdinalSuffix(i);
    let displayName = ordinal;
    if (style === 'roman') displayName = `Class ${roman}`;
    else if (style === 'number') displayName = `Class ${i}`;
    else displayName = ordinal;

    grades.push({
      id: `class_${i}`,
      name: displayName,
      romanName: `Class ${roman}`,
      ordinalName: ordinal,
      sections: ["A", "B"],
      orderIndex: i
    });
  }

  return [...prePrimary, ...grades];
}

/**
 * Formats a class name into Roman, Ordinal, or Number style if it is a standard grade (1-12)
 */
export function formatClassName(name: string, style: 'roman' | 'ordinal' | 'number' = 'ordinal'): string {
  const norm = normalizeClassName(name);
  const num = parseInt(norm, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    if (style === 'roman') return `Class ${toRomanNumeral(num)}`;
    if (style === 'number') return `Class ${num}`;
    return toOrdinalSuffix(num);
  }
  return name;
}

/**
 * Helper to retrieve configured sections for a given class name from schoolClasses,
 * falling back to registered students or structure definitions if schoolClasses has only default presets.
 */
export function getSectionsForClass(
  className: string, 
  schoolClasses?: SchoolClassItem[],
  students?: { className?: string; section?: string }[],
  structures?: ReportCardStructure[]
): string[] {
  if (!className) return [];

  // 1. Check schoolClasses
  if (schoolClasses && schoolClasses.length > 0) {
    const match = schoolClasses.find(c => classesMatch(c.name, className));
    if (match && match.sections && match.sections.length > 0) {
      const isDefaultAB = match.sections.length === 2 && 
        match.sections.some(s => s.toUpperCase() === 'A') && 
        match.sections.some(s => s.toUpperCase() === 'B');

      // If sections were specifically customized (e.g. ['Science'] or not just generic ['A', 'B']), return them
      if (!isDefaultAB) {
        return match.sections;
      }

      // If it is the default preset ['A', 'B'], check if students or structures have custom sections for this class (e.g. 'SCIENCE')
      if (students && students.length > 0) {
        const studentSecs = Array.from(new Set(
          students
            .filter(s => classesMatch(s.className, className))
            .map(s => (s.section || '').trim())
            .filter(Boolean)
        ));
        if (studentSecs.length > 0 && !studentSecs.every(s => s.toUpperCase() === 'A' || s.toUpperCase() === 'B')) {
          return studentSecs;
        }
      }

      if (structures && structures.length > 0) {
        const structSecs = new Set<string>();
        structures.forEach(struct => {
          (struct.assignedClasses || []).forEach(target => {
            const parsed = parseClassAndSection(target);
            if (parsed.section && classesMatch(parsed.className, className)) {
              structSecs.add(parsed.section);
            }
          });
        });
        if (structSecs.size > 0 && !Array.from(structSecs).every(s => s.toUpperCase() === 'A' || s.toUpperCase() === 'B')) {
          return Array.from(structSecs);
        }
      }

      return match.sections;
    }
  }

  // 2. Check existing student records
  if (students && students.length > 0) {
    const studentSecs = Array.from(new Set(
      students
        .filter(s => classesMatch(s.className, className))
        .map(s => (s.section || '').trim())
        .filter(Boolean)
    ));
    if (studentSecs.length > 0) {
      return studentSecs;
    }
  }

  // 3. Check structures targeting this class with specific section restrictions (e.g. "Class XII (Sec SCIENCE)")
  if (structures && structures.length > 0) {
    const structSecs = new Set<string>();
    structures.forEach(struct => {
      (struct.assignedClasses || []).forEach(target => {
        const parsed = parseClassAndSection(target);
        if (parsed.section && classesMatch(parsed.className, className)) {
          structSecs.add(parsed.section);
        }
      });
    });
    if (structSecs.size > 0) {
      return Array.from(structSecs);
    }
  }

  return ['A', 'B'];
}

/**
 * Authoritative helper to determine if a student profile field (e.g. 'admissionNo', 'dob')
 * is active in the report card layout for a specific class or across all classes.
 * 
 * - When targetClass is specified (e.g. 'Class XII' or '3rd'):
 *   1. Matches the exact structure for that class/section.
 *   2. If matched structure has customized studentFields: evaluates that structure directly.
 *      If field was omitted/deleted from that structure, returns false.
 *      If field is disabled globally or for targetClass, returns false.
 *      Otherwise returns true.
 *   3. If matched structure does not have studentFields, checks global branding.
 *   4. Falls back to standard built-in fields.
 * 
 * - When targetClass is 'all' or undefined (e.g. for table column headers in mixed views):
 *   Returns true if at least one structure or global branding has this field active.
 */
export function isStudentFieldActive(
  fieldId: string,
  targetClass?: string,
  targetSection?: string,
  structures?: ReportCardStructure[],
  branding?: SchoolBranding
): boolean {
  const structs = structures || [];

  // 1. Specific class evaluation (e.g. 'Class XII' or 'Class 3rd')
  if (targetClass && targetClass !== 'all') {
    const struct = matchStructureForStudent(
      structs, 
      targetClass, 
      targetSection && targetSection !== 'all' ? targetSection : undefined
    );

    // If a structure is matched and has its own studentFields array:
    if (struct?.branding?.studentFields && Array.isArray(struct.branding.studentFields)) {
      const f = struct.branding.studentFields.find((item: any) => item.id === fieldId);
      if (!f) return false; // Field was deleted/omitted from this layout
      if (f.disabled === true || f.disabledAll === true) return false; // Globally disabled
      if (f.disabledClasses && f.disabledClasses.some((dc: string) => classesMatch(dc, targetClass))) return false; // Disabled for this class
      return true;
    }

    // If matched structure does NOT define studentFields, check global school branding
    if (branding?.studentFields && Array.isArray(branding.studentFields) && branding.studentFields.length > 0) {
      const gf = branding.studentFields.find((item: any) => item.id === fieldId);
      if (!gf) return false;
      if (gf.disabled === true || gf.disabledAll === true) return false;
      if (gf.disabledClasses && gf.disabledClasses.some((dc: string) => classesMatch(dc, targetClass))) return false;
      return true;
    }

    // Standard built-in default fields if neither structure nor branding customized fields
    const standardFields = ['name', 'fatherName', 'motherName', 'height', 'weight', 'className', 'section', 'rollNo', 'admissionNo', 'dob'];
    return standardFields.includes(fieldId);
  }

  // 2. Global / mixed-view evaluation (targetClass === 'all' or undefined)
  const structsWithFields = structs.filter(
    s => s.branding?.studentFields && Array.isArray(s.branding.studentFields) && s.branding.studentFields.length > 0
  );

  if (structsWithFields.length > 0) {
    return structsWithFields.some(s => 
      s.branding.studentFields.some((item: any) => {
        if (item.id !== fieldId) return false;
        if (item.disabled === true || item.disabledAll === true) return false;
        return true;
      })
    );
  }

  if (branding?.studentFields && Array.isArray(branding.studentFields) && branding.studentFields.length > 0) {
    const gf = branding.studentFields.find((item: any) => item.id === fieldId);
    return !!gf && !gf.disabled && !gf.disabledAll;
  }

  const standardFields = ['name', 'fatherName', 'motherName', 'height', 'weight', 'className', 'section', 'rollNo', 'admissionNo', 'dob'];
  return standardFields.includes(fieldId);
}

/**
 * Resolves a raw class name (e.g. "3rd" or "Class 3" or "III") to the school's configured
 * canonical class name (e.g. "Class III" if Roman, or "3rd" if Ordinal).
 */
export function getCanonicalClassName(className?: string, schoolClasses?: SchoolClassItem[]): string {
  if (!className) return '';
  const trimmed = className.trim();
  if (schoolClasses && schoolClasses.length > 0) {
    const match = schoolClasses.find(c => classesMatch(c.name, trimmed));
    if (match) return match.name;
  }
  return trimmed;
}

/**
 * Ensures clean display of class name without redundant "Class Class I" or "Class 1st Standard".
 * If name already contains "Class" or is a pre-primary level (Nursery, etc.), leaves it as is.
 */
export function formatClassWithPrefix(className?: string): string {
  if (!className) return '';
  const trimmed = className.trim();
  if (/^(class|grade|std|standard)\b/i.test(trimmed)) {
    return trimmed;
  }
  const norm = normalizeClassName(trimmed);
  if (['playgroup', 'nursery', 'lkg', 'ukg'].includes(norm)) {
    return trimmed;
  }
  return `Class ${trimmed}`;
}

/**
 * Parses an assigned class string that may contain a specific section restriction.
 * Examples:
 *   "Class 11 (Sec A)" -> { className: "Class 11", section: "A" }
 *   "Class 11 (Section B)" -> { className: "Class 11", section: "B" }
 *   "Class 11 - Sec A" -> { className: "Class 11", section: "A" }
 *   "Class 11:A" -> { className: "Class 11", section: "A" }
 *   "Class 10" -> { className: "Class 10", section: undefined }
 */
export function parseClassAndSection(target: string): { className: string; section?: string } {
  if (!target) return { className: '' };
  const trimmed = target.trim();

  // Pattern 1: Parentheses e.g. "Class 11 (Sec A)" or "Class 11 (Section A)" or "11th (A)"
  const parenMatch = trimmed.match(/^(.+?)\s*\(\s*(?:sec(?:tion)?\.?\s*)?([a-zA-Z0-9_-]+)\s*\)$/i);
  if (parenMatch) {
    return { className: parenMatch[1].trim(), section: parenMatch[2].trim().toUpperCase() };
  }

  // Pattern 2: Dash or Colon e.g. "Class 11 - Sec A" or "Class 11:A"
  const dashMatch = trimmed.match(/^(.+?)\s*[-:]\s*(?:sec(?:tion)?\.?\s*)?([a-zA-Z0-9_-]+)$/i);
  if (dashMatch) {
    return { className: dashMatch[1].trim(), section: dashMatch[2].trim().toUpperCase() };
  }

  return { className: trimmed, section: undefined };
}

/**
 * Returns true if an assigned target string has a specific section constraint
 */
export function hasSpecificSectionRestriction(target: string): boolean {
  const parsed = parseClassAndSection(target);
  return !!parsed.section;
}

/**
 * Checks if an assigned target matches a student's class and section.
 * If target has a section constraint, it requires BOTH class and section to match.
 */
export function matchesClassTargetWithSection(
  target: string,
  studentClassName?: string,
  studentSection?: string
): boolean {
  if (!target || !studentClassName) return false;
  const parsed = parseClassAndSection(target);
  const classMatches = classesMatch(parsed.className, studentClassName);
  if (!classMatches) return false;

  if (parsed.section) {
    if (!studentSection) return false;
    return parsed.section.toUpperCase() === studentSection.trim().toUpperCase();
  }

  return true;
}

/**
 * Format a human-readable class + section target string
 */
export function formatClassSectionTarget(className: string, section?: string): string {
  const cleanCls = className.trim();
  if (!section || section.toLowerCase() === 'all') return cleanCls;
  return `${cleanCls} (Sec ${section.trim().toUpperCase()})`;
}

/**
 * Hierarchical matcher to find the best ReportCardStructure for a given student.
 * 1. Tier 1: Look for exact Class + Section match (e.g. "Class 11 (Sec A)").
 * 2. Tier 2: Look for Class-wide match (e.g. "Class 11" without section restriction).
 * 3. Fallback: null if none matched.
 */
export function matchStructureForStudent(
  structures: ReportCardStructure[],
  studentClassName?: string,
  studentSection?: string
): ReportCardStructure | null {
  if (!structures || structures.length === 0 || !studentClassName) return null;

  const cleanClass = studentClassName.trim();
  const cleanSection = (studentSection || '').trim().toUpperCase();

  // Tier 1: Exact Section Match
  if (cleanSection) {
    const exactSectionMatch = structures.find(struct => 
      (struct.assignedClasses || []).some(target => {
        const parsed = parseClassAndSection(target);
        return !!parsed.section && 
               classesMatch(parsed.className, cleanClass) && 
               parsed.section === cleanSection;
      })
    );
    if (exactSectionMatch) return exactSectionMatch;
  }

  // Tier 2: Class-wide match (targets without specific section restrictions)
  const classMatch = structures.find(struct => 
    (struct.assignedClasses || []).some(target => {
      const parsed = parseClassAndSection(target);
      if (parsed.section) return false; // This target is restricted to another section
      const targetNorm = normalizeClassName(parsed.className);
      const cleanTarget = parsed.className.toLowerCase().trim();
      if (
        targetNorm === "all" || 
        targetNorm === "all classes" || 
        cleanTarget === "all" || 
        cleanTarget === "all classes" || 
        cleanTarget === "*"
      ) {
        return true;
      }
      return classesMatch(parsed.className, cleanClass);
    })
  );
  if (classMatch) return classMatch;

  // Tier 3: Fallback to the default template / structure if available
  const defaultStruct = structures.find(s => 
    s.id === 'struct_default' || 
    s.id?.toLowerCase().startsWith('struct_def') ||
    s.name?.toLowerCase().includes('(default template)') || 
    (s as any).isDefault === true
  );
  if (defaultStruct) return defaultStruct;

  // Tier 4: If only one structure is defined for the school, apply it school-wide
  if (structures.length === 1) return structures[0];

  return null;
}

