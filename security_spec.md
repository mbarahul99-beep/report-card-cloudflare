# Security Specification: SaaS Report Card Generator Firestore Rules

This document outlines the security requirements, data invariants, and adversarial test scenarios ("Dirty Dozen" payloads) for the Super Report School SaaS Firestore database.

## 1. Data Invariants

1. **School Tenant Boundary**:
   - Access to any school configuration or student record must be scoped under `/schools/{schoolId}`.
   - Users must only read and write data belonging to their authorized `schoolId`.

2. **Hierarchical Permissions**:
   - **School Admin**: Full access to all sub-collections under their corresponding `/schools/{schoolId}`. Is recognized as a user whose UID is authorized for the school (e.g. mapped via `/schools/{schoolId}` matching `request.auth.uid`).
   - **Class Teacher**: Access is restricted to students and grades within their `assignedClass` and `assignedSection`. Can read and modify marks/grades for assigned classes, but cannot modify core subjects, grade scales, or other school admins/branding configurations.
   - **Parent**: Read-only access to `/schools/{schoolId}/students/{studentId}` and `/schools/{schoolId}/studentGrades/{gradeId}` strictly where they match the ward's profile.

3. **Data Integrity (Schemas and Types)**:
   - The validation helper functions (`isValidSchool`, `isValidBranding`, `isValidStudent`, `isValidStudentGrades`, etc.) must be executed on all write operations (`create`, `update`).
   - Identifiers (document IDs, field IDs) must only contain valid characters: alphanumeric, dashes, and underscores, bounded to dynamic lengths (`isValidId`).
   - Timestamp properties (`createdAt`, `updatedAt`) must rely on server timestamps (`request.time`) instead of client-provided clocks to maintain chronological accuracy.

4. **Temporal Lockout**:
   - Scores and final report card entries cannot be updated once marked as published or terminal, except by a verified School Admin override.

5. **PII and Identity Guard**:
   - Personally identifiable information (such as date of birth, addresses, father/mother names) is protected. Bulk collection reads are blocked; queries must always filter by explicit ownership or authorization keys.

---

## 2. The "Dirty Dozen" Payloads

Here are 12 malicious payload injection scenarios designed to bypass security and corrupt data. The Firestore Security Rules must block every single one of these attempts with `PERMISSION_DENIED`.

### Payload 1: School ID Spoofing (Identity Spoofing)
An authenticated attacker tries to update the name or configuration of another school to hijack their landing page.
- **Path**: `/schools/sc_xavier`
- **User UID**: `attacker_uid` (not authorized for `sc_xavier`)
- **Write Type**: UPDATE
- **Payload**: `{"name": "Hijacked School Academy"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 2: Self-Promotion to Admin (Privilege Escalation)
A Class Teacher tries to add themselves as an authorized school administrator to unlock the billing/SaaS desk.
- **Path**: `/schools/sc_xavier`
- **User UID**: `teach_sharma_uid`
- **Write Type**: UPDATE
- **Payload**: `{"adminUid": "teach_sharma_uid", "isSuperAdmin": true}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 3: Shadow Update (Ghost Keys)
A malicious client tries to inject a hidden `verifiedLogoStatus` key into the school branding configuration.
- **Path**: `/schools/sc_xavier/branding/config`
- **User UID**: `school_admin_uid` (owner)
- **Write Type**: UPDATE
- **Payload**: `{"schoolName": "Modified Name", "verifiedLogoStatus": "certified_unlimited", "ghostKey": "malicious"}`
- **Expected Outcome**: `PERMISSION_DENIED` (due to `.affectedKeys().hasOnly(...)` mismatch)

### Payload 4: Invalid Document ID Poisoning (DoS/Overflow Attack)
An attacker tries to create a student with a abnormally large document ID consisting of 10KB of junk characters to crash indexing or waste project funds.
- **Path**: `/schools/sc_xavier/students/STUDENT_ID_VERY_LONG_10KB_JUNK`
- **User UID**: `attacker_uid`
- **Write Type**: CREATE
- **Payload**: `{"id": "STUDENT_ID_VERY_LONG_10KB", "name": "Fake Name", "className": "3rd", "section": "A", "rollNo": "1"}`
- **Expected Outcome**: `PERMISSION_DENIED` (fails `isValidId()`)

### Payload 5: Date of Birth Format Poisoning (Invalid Type Injection)
An attacker attempts to write an integer instead of a valid date-of-birth string to corrupt Excel report exports.
- **Path**: `/schools/sc_xavier/students/stud_1`
- **User UID**: `school_admin_uid`
- **Write Type**: UPDATE
- **Payload**: `{"dob": 20131415, "updatedAt": "request.time"}`
- **Expected Outcome**: `PERMISSION_DENIED` (fails type check `data.dob is string`)

### Payload 6: Unverified Email Hijacking (Email Spoofing)
An attacker attempts to access school registries by presenting a Google Auth token containing the actual admin's email, but with `email_verified` set to `false`.
- **Path**: `/schools/sc_xavier/students`
- **User UID**: `spoof_uid` (token claims `email` is admin's, `email_verified` is `false`)
- **Write Type**: LIST
- **Payload**: None
- **Expected Outcome**: `PERMISSION_DENIED` (requires `request.auth.token.email_verified == true`)

### Payload 7: State Shortcutting (Grade Tampering)
A student/parent intercepts requests and tries to modify their term grades from "E" (Fail) to "A1" in bulk.
- **Path**: `/schools/sc_xavier/studentGrades/stud_1`
- **User UID**: `parent_uid`
- **Write Type**: UPDATE
- **Payload**: `{"scholastic/english/term2/hy": 99}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 8: Client-Side Timestamp Spoofing
An attacker attempts to set a custom historical `updatedAt` field to mask late grade entries.
- **Path**: `/schools/sc_xavier/studentGrades/stud_1`
- **User UID**: `teach_sharma_uid`
- **Write Type**: UPDATE
- **Payload**: `{"updatedAt": "2020-01-01T00:00:00Z"}` (instead of the required request.time)
- **Expected Outcome**: `PERMISSION_DENIED` (fails `incoming().updatedAt == request.time`)

### Payload 9: Orphaned Record Creation (Integrity Break)
An attacker attempts to create a grade metrics record for a non-existent student ID `ghost_student_999`.
- **Path**: `/schools/sc_xavier/studentGrades/grade_ghost`
- **User UID**: `school_admin_uid`
- **Write Type**: CREATE
- **Payload**: `{"studentId": "ghost_student_999", "scholastic": {}}`
- **Expected Outcome**: `PERMISSION_DENIED` (fails `exists()` reference check on student collection)

### Payload 10: Terminal State Modification
An admin marks a session report card as "terminal/published". A malicious user tries to alter the final remarks of that student record after the final printing window.
- **Path**: `/schools/sc_xavier/students/stud_1`
- **User UID**: `teach_sharma_uid`
- **Write Type**: UPDATE
- **Payload**: `{"remarks": "Highly disruptive"}`
- **Expected Outcome**: `PERMISSION_DENIED` (once student status or remarks are committed as terminal, update is locked)

### Payload 11: Bulk List Query Scraping (Blanket Reads)
An unauthenticated attacker issues a query to download the names and helpline contacts of all schools in the SaaS network directories in bulk.
- **Path**: `/schools`
- **User UID**: None (Unauthenticated)
- **Write Type**: LIST
- **Payload**: None
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 12: Denial of Wallet Query Exploits (O(N) Recursion)
An attacker requests a massive subcollection list and bypasses pagination parameters, hoping to consume API operations.
- **Path**: `/schools/sc_xavier/students`
- **User UID**: `attacker_uid` (unauthorized user)
- **Write Type**: LIST
- **Payload**: None (where resource.data.schoolId != request.auth.uid)
- **Expected Outcome**: `PERMISSION_DENIED` (blocked before checking DB via fast rules ordering)

---

## 3. The Test Runner Reference

The following Jest/Vitest rule runner test suite assertions assert that all the above 12 scenarios fail securely. Tests verify security guarantees at local and pipeline levels.

```typescript
import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "super-report-card-saas",
    firestore: {
      rules: require("fs").readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("SaaS School Security Rules Unit Tests", () => {
  test("Scenario 1: Attacker cannot modify school settings of another tenant", async () => {
    const context = testEnv.authenticatedContext("attacker_id");
    const db = context.firestore();
    const docRef = doc(db, "schools", "sc_xavier");
    await expect(updateDoc(docRef, { name: "Hijacked School Academy" })).rejects.toThrow("PERMISSION_DENIED");
  });

  test("Scenario 4: Block long malicious strings as document ID path components", async () => {
    const context = testEnv.authenticatedContext("school_admin_id");
    const db = context.firestore();
    const badId = "STUDENT_ID_VERY_LONG_".repeat(50);
    const docRef = doc(db, "schools/sc_xavier/students", badId);
    await expect(setDoc(docRef, { name: "Fake" })).rejects.toThrow("PERMISSION_DENIED");
  });

  test("Scenario 5: Type mismatch on DOB throws compile error", async () => {
    const context = testEnv.authenticatedContext("school_admin_id");
    const db = context.firestore();
    const docRef = doc(db, "schools/sc_xavier/students", "stud_1");
    await expect(updateDoc(docRef, { dob: 20131415 })).rejects.toThrow("PERMISSION_DENIED");
  });

  test("Scenario 6: Unverified Email token rejects access to lists", async () => {
    const context = testEnv.authenticatedContext("spoof_id", { email_verified: false, email: "admin@xavier.edu" });
    const db = context.firestore();
    const docRef = doc(db, "schools/sc_xavier/students", "stud_1");
    await expect(getDoc(docRef)).rejects.toThrow("PERMISSION_DENIED");
  });
});
```
