import { GoogleGenAI, Type } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getGenAI(customApiKey?: string): GoogleGenAI | null {
  if (customApiKey && typeof customApiKey === 'string' && customApiKey.trim().length > 10) {
    return new GoogleGenAI({
      apiKey: customApiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-custom',
        },
      },
    });
  }

  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Models cascade for text generation
const CANDIDATE_MODELS = [
  "gemini-3.7-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash"
];

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute Gemini content generation with retry and multi-model fallback cascade.
 */
async function generateContentWithFallback(
  ai: GoogleGenAI,
  contents: string,
  config: any
): Promise<{ text: string; modelUsed: string } | null> {
  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config
        });
        if (response && response.text) {
          return { text: response.text, modelUsed: model };
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isTemporary = errMsg.includes("503") || errMsg.includes("429") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE") || errMsg.includes("RESOURCE_EXHAUSTED");
        
        console.warn(`[AI REMARKS] Model ${model} attempt ${attempt} returned: ${errMsg.slice(0, 120)}`);
        
        if (attempt === 1 && isTemporary) {
          // Wait 600ms before retrying same model
          await delay(600);
          continue;
        }
        // Break out of retry loop to move to next fallback model
        break;
      }
    }
  }
  return null;
}

export interface StudentAcademicSummary {
  name: string;
  className?: string;
  section?: string;
  rollNo?: string;
  admissionNo?: string;
  totalMarks?: string | number;
  maxMarks?: string | number;
  percentage?: string | number;
  grade?: string;
  attendance?: string;
  strongSubjects?: string[];
  weakSubjects?: string[];
  subjectsSummary?: { name: string; marks: number; maxMarks: number; grade?: string }[];
  coScholasticSummary?: { name: string; grade: string }[];
  existingRemarks?: string;
}

// Fallback generator for offline / no-key situations (Always strictly positive & encouraging)
function generateSmartFallbackRemark(
  student: StudentAcademicSummary,
  tone: string = 'encouraging',
  length: string = 'medium',
  focusArea: string = 'all_round'
): { primary: string; options: string[]; promotionSuggestion: string } {
  const name = student.name || 'The student';
  const pct = typeof student.percentage === 'string' ? parseFloat(student.percentage) : (student.percentage || 0);
  const grade = student.grade || (pct >= 85 ? 'A+' : pct >= 70 ? 'A' : pct >= 55 ? 'B' : pct >= 40 ? 'C' : 'D');
  const strong = student.strongSubjects && student.strongSubjects.length > 0 ? student.strongSubjects.join(' and ') : 'core academic subjects';
  const weak = student.weakSubjects && student.weakSubjects.length > 0 ? student.weakSubjects.join(' and ') : '';

  let primary = '';
  const options: string[] = [];

  if (pct >= 85 || grade.startsWith('A')) {
    primary = `${name} is an exceptionally bright, sincere, and enthusiastic learner who has delivered outstanding academic results throughout the session. Particularly excels in ${strong} with remarkable conceptual clarity and positive leadership.`;
    options.push(`A wonderful and meritorious academic achievement by ${name}! Demonstrates exemplary discipline, inquisitive thinking, and a sincere joy for learning. Keep up this magnificent spirit!`);
    options.push(`${name} consistently displays exceptional dedication, critical thinking, and proactive classroom participation. Congratulations on a brilliant academic year!`);
  } else if (pct >= 65 || grade.startsWith('B')) {
    primary = `${name} has shown commendable dedication and consistent academic progress this session. Demonstrates strong potential in ${strong}, and with continued curiosity and regular revision, ${name} will attain even higher pinnacles of success.`;
    options.push(`A very positive and commendable effort by ${name}! Always cooperative, attentive, and eager to learn new concepts. Sincere self-study will unlock tremendous academic growth.`);
    options.push(`${name} is a hardworking and well-mannered student who has made steady strides in learning. Encouraged to keep striving for excellence with confidence.`);
  } else if (pct >= 45 || grade.startsWith('C')) {
    primary = `${name} has demonstrated sincere effort, good classroom conduct, and an earnest desire to learn. With regular daily revision and active guidance in ${weak || 'core subjects'}, ${name} has the full capability to achieve outstanding results.`;
    options.push(`${name} is a courteous and attentive student who shows genuine promise. Maintaining daily study discipline and asking questions will boost confidence and lead to great progress.`);
    options.push(`Commendable effort shown by ${name}! Possesses wonderful creativity and learning potential that will flourish with consistent practice and dedicated support.`);
  } else {
    primary = `${name} is an earnest student with immense natural potential. With steady encouragement, structured daily reading, and interactive practice, ${name} is sure to make remarkable strides in the upcoming term.`;
    options.push(`${name} demonstrates positive behavior and good effort in class. With step-by-step guidance and regular revision, ${name} can achieve wonderful milestones.`);
    options.push(`We believe strongly in ${name}'s abilities. Consistent study habits and enthusiastic participation will help ${name} flourish academically.`);
  }

  // Length adjustments
  if (length === 'short') {
    primary = primary.split('. ')[0] + '.';
  } else if (length === 'detailed' && options.length > 0) {
    primary = `${primary} ${options[0]}`;
  }

  const promotionSuggestion = pct >= 40 
    ? `Promoted to the next academic grade with Distinction and Best Wishes` 
    : `Promoted to the next grade with continued teacher support and encouragement`;

  return { primary, options, promotionSuggestion };
}

export default async function generateAiRemarksHandler(req: any, res: any) {
  try {
    const { 
      action,
      apiKey,
      student, 
      students, 
      isBulk = false,
      tone = 'encouraging', // encouraging, warm, inspiring, growth
      length = 'medium', // short, medium, detailed
      focusArea = 'all_round', // all_round, academic, effort, behavior_social, strengths_weaknesses
      customPrompt = '',
      schoolName = ''
    } = req.body || {};

    // Validate key action
    if (action === 'validate_key') {
      const customAi = getGenAI(apiKey);
      if (!customAi) {
        return res.status(400).json({ success: false, error: "Please enter a valid Gemini API key." });
      }
      try {
        const testRes = await customAi.models.generateContent({
          model: "gemini-3.7-flash",
          contents: "Return the single word: OK",
        });
        if (testRes && testRes.text) {
          return res.json({ success: true, message: "Gemini API Key verified successfully! Unlimited remark generations unlocked." });
        }
      } catch (keyErr: any) {
        return res.status(400).json({ success: false, error: `API Key verification failed: ${keyErr?.message || 'Invalid key'}` });
      }
    }

    const ai = getGenAI(apiKey);

    // Check if AI API is available
    if (!ai) {
      console.log("[AI REMARKS] GEMINI_API_KEY not configured. Falling back to intelligent rule-based positive engine.");
      if (isBulk && Array.isArray(students)) {
        const results = students.map((std: StudentAcademicSummary) => {
          const fb = generateSmartFallbackRemark(std, tone, length, focusArea);
          return {
            studentId: (std as any).id || (std as any).studentId || '',
            studentName: std.name,
            remarks: fb.primary,
            options: fb.options,
            promotionStatus: fb.promotionSuggestion
          };
        });
        return res.json({ 
          success: true, 
          isAiPowered: false, 
          results,
          notice: "Remarks generated using built-in positive pedagogical analyzer." 
        });
      } else {
        const targetStudent: StudentAcademicSummary = student || (Array.isArray(students) && students[0]) || { name: 'Student' };
        const fb = generateSmartFallbackRemark(targetStudent, tone, length, focusArea);
        return res.json({
          success: true,
          isAiPowered: false,
          remarks: fb.primary,
          options: [fb.primary, ...fb.options],
          promotionStatus: fb.promotionSuggestion,
          notice: "Remarks generated using built-in positive pedagogical analyzer."
        });
      }
    }

    // Single student AI generation
    if (!isBulk && student) {
      const studentData: StudentAcademicSummary = student;
      const prompt = `You are an inspiring, compassionate, and experienced educator writing the official Teacher's Remarks for a student's school report card.

CRITICAL DIRECTIVE:
All remarks MUST ALWAYS be strictly POSITIVE, ENCOURAGING, INSPIRING, and MOTIVATING.
Never use negative, harsh, punitive, or discouraging words. Even when addressing subjects that need more attention, frame them as exciting growth opportunities, celebrate the student's effort, curiosity, and immense natural potential, and provide uplifting teacher encouragement.

School Context: ${schoolName ? `School: ${schoolName}` : 'K-12 School'}
Student Details:
- Name: ${studentData.name}
- Class: ${studentData.className || 'Not specified'} ${studentData.section ? `Section: ${studentData.section}` : ''}
- Roll Number: ${studentData.rollNo || 'N/A'}
- Overall Percentage: ${studentData.percentage !== undefined ? `${studentData.percentage}%` : 'N/A'}
- Overall Grade: ${studentData.grade || 'N/A'}
- Total Marks: ${studentData.totalMarks || 'N/A'} / ${studentData.maxMarks || 'N/A'}
- Attendance Record: ${studentData.attendance || 'Good attendance and punctuality'}
- Strong Subjects: ${studentData.strongSubjects && studentData.strongSubjects.length > 0 ? studentData.strongSubjects.join(', ') : 'All Core Subjects'}
- Growth Subjects: ${studentData.weakSubjects && studentData.weakSubjects.length > 0 ? studentData.weakSubjects.join(', ') : 'None'}
- Subject Breakdown: ${studentData.subjectsSummary ? JSON.stringify(studentData.subjectsSummary) : 'N/A'}
- Co-Scholastic / Conduct: ${studentData.coScholasticSummary ? JSON.stringify(studentData.coScholasticSummary) : 'N/A'}
${studentData.existingRemarks ? `- Previous/Draft Remark: "${studentData.existingRemarks}"` : ''}

Style Preferences:
- Tone: Always positive, inspiring, and encouraging (${tone})
- Desired Length: ${length} (short = 1-2 sentences ~20-30 words, medium = 2-3 sentences ~35-50 words, detailed = 3-4 sentences ~60-80 words)
- Focus: ${focusArea} (all-round, academic strength, positive effort, good behavior)
${customPrompt ? `- Specific Teacher Notes: "${customPrompt}"` : ''}

Instructions:
1. Write 3 distinct, high-quality, inspiring, and personalized teacher remarks options.
2. Ensure every option is uplifting, authentic, celebrates accomplishments, and encourages continued curiosity.
3. Also generate an encouraging promotion recommendation statement (e.g. "Promoted to Class 5th with Distinction" or "Promoted to the next academic grade with Best Wishes").
4. Return strictly JSON matching the required schema.`;

      const genResult = await generateContentWithFallback(ai, prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            primaryRemark: {
              type: Type.STRING,
              description: "The best, most inspiring and positive primary teacher remark."
            },
            alternativeRemarks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-3 alternative encouraging remark options."
            },
            promotionStatus: {
              type: Type.STRING,
              description: "Encouraging promotion statement suitable for the report card."
            }
          },
          required: ["primaryRemark", "alternativeRemarks"]
        }
      });

      if (!genResult) {
        console.warn("[AI REMARKS] Model busy. Seamlessly using smart pedagogical heuristic engine.");
        const fb = generateSmartFallbackRemark(studentData, tone, length, focusArea);
        return res.json({
          success: true,
          isAiPowered: false,
          remarks: fb.primary,
          options: [fb.primary, ...fb.options],
          promotionStatus: fb.promotionSuggestion,
          notice: "Remark generated using built-in positive pedagogical analyzer."
        });
      }

      let parsed: any = {};
      try {
        parsed = JSON.parse(genResult.text || "{}");
      } catch (err) {
        console.warn("[AI REMARKS] Failed to parse JSON, falling back to regex extraction:", err);
      }

      const primaryRemark = parsed.primaryRemark || parsed.remarks || generateSmartFallbackRemark(studentData, tone, length, focusArea).primary;
      const options = Array.isArray(parsed.alternativeRemarks) && parsed.alternativeRemarks.length > 0
        ? [primaryRemark, ...parsed.alternativeRemarks]
        : [primaryRemark, ...generateSmartFallbackRemark(studentData, tone, length, focusArea).options];
      const promotionStatus = parsed.promotionStatus || generateSmartFallbackRemark(studentData, tone, length, focusArea).promotionSuggestion;

      return res.json({
        success: true,
        isAiPowered: true,
        remarks: primaryRemark,
        options: Array.from(new Set(options)),
        promotionStatus
      });
    }

    // Bulk / Batch whole section AI generation
    if (isBulk && Array.isArray(students) && students.length > 0) {
      const studentsList: StudentAcademicSummary[] = students;
      const batchPrompt = `You are a dedicated, uplifting school educator writing official Report Card Remarks for an entire class section of ${studentsList.length} students.

CRITICAL MANDATE:
Every single student's remark MUST ALWAYS be POSITIVE, INSPIRING, MOTIVATING, and ENCOURAGING.
Analyze their marks, percentages, and strong subjects. Praise their accomplishments, diligence, good behavior, and growth mindset.
Never use discouraging, negative, or harsh language. Even for lower-scoring students, highlight their sincerity, effort, and immense potential, offering warm teacher encouragement. Avoid repetitive cookie-cutter phrasing across students.

School Context: ${schoolName || 'School'}
Settings:
- Tone: Strictly positive & encouraging (${tone})
- Length: ${length}
- Focus: ${focusArea}
${customPrompt ? `- Teacher's General Guidance: "${customPrompt}"` : ''}

Students Section Marks Data:
${JSON.stringify(studentsList.map((s, idx) => ({
  index: idx,
  id: (s as any).id || (s as any).studentId || `std_${idx}`,
  name: s.name,
  className: s.className,
  section: s.section,
  rollNo: s.rollNo,
  percentage: s.percentage,
  grade: s.grade,
  totalMarks: s.totalMarks,
  maxMarks: s.maxMarks,
  attendance: s.attendance,
  strongSubjects: s.strongSubjects,
  weakSubjects: s.weakSubjects
})))}

Instructions:
Generate a unique, highly personalized, and constructive positive teacher remark and a brief promotion status statement for EVERY student in the section.
Return strictly JSON matching the required schema.`;

      const genResult = await generateContentWithFallback(ai, batchPrompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            studentRemarks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Student ID from input" },
                  name: { type: Type.STRING, description: "Student Name" },
                  remarks: { type: Type.STRING, description: "Positive, encouraging, and personalized Teacher's Remark" },
                  promotionStatus: { type: Type.STRING, description: "Positive promotion recommendation status" }
                },
                required: ["id", "remarks"]
              }
            }
          },
          required: ["studentRemarks"]
        }
      });

      if (!genResult) {
        console.warn("[AI REMARKS] Bulk AI generation busy. Seamlessly generating batch remarks with smart heuristics.");
        const results = studentsList.map((std: any, idx: number) => {
          const stdId = String(std.id || std.studentId || `std_${idx}`);
          const fb = generateSmartFallbackRemark(std, tone, length, focusArea);
          return {
            studentId: stdId,
            studentName: std.name,
            remarks: fb.primary,
            promotionStatus: fb.promotionSuggestion
          };
        });
        return res.json({
          success: true,
          isAiPowered: false,
          results,
          notice: "Remarks generated using built-in positive pedagogical analyzer."
        });
      }

      let parsed: any = {};
      try {
        parsed = JSON.parse(genResult.text || "{}");
      } catch (err) {
        console.warn("[AI REMARKS] Bulk JSON parse failed:", err);
      }

      const generatedList = Array.isArray(parsed.studentRemarks) ? parsed.studentRemarks : [];
      const resultMap = new Map<string, { remarks: string; promotionStatus?: string }>();
      generatedList.forEach((item: any) => {
        if (item && item.id) {
          resultMap.set(String(item.id), {
            remarks: item.remarks,
            promotionStatus: item.promotionStatus
          });
        }
      });

      const finalResults = studentsList.map((std: any, idx: number) => {
        const stdId = String(std.id || std.studentId || `std_${idx}`);
        const found = resultMap.get(stdId);
        if (found && found.remarks) {
          return {
            studentId: stdId,
            studentName: std.name,
            remarks: found.remarks,
            promotionStatus: found.promotionStatus || `Promoted to next class`
          };
        } else {
          const fb = generateSmartFallbackRemark(std, tone, length, focusArea);
          return {
            studentId: stdId,
            studentName: std.name,
            remarks: fb.primary,
            promotionStatus: fb.promotionSuggestion
          };
        }
      });

      return res.json({
        success: true,
        isAiPowered: true,
        results: finalResults
      });
    }

    return res.status(400).json({ error: "Invalid request payload. Please supply student data." });
  } catch (error: any) {
    console.warn("[AI REMARKS] Notice in generateAiRemarksHandler:", error?.message || error);
    const { student, students, isBulk = false, tone = 'encouraging', length = 'medium', focusArea = 'all_round' } = req.body || {};
    if (isBulk && Array.isArray(students)) {
      const results = students.map((std: StudentAcademicSummary) => {
        const fb = generateSmartFallbackRemark(std, tone, length, focusArea);
        return {
          studentId: (std as any).id || (std as any).studentId || '',
          studentName: std.name,
          remarks: fb.primary,
          options: fb.options,
          promotionStatus: fb.promotionSuggestion
        };
      });
      return res.json({ success: true, isAiPowered: false, results });
    } else {
      const targetStudent: StudentAcademicSummary = student || (Array.isArray(students) && students[0]) || { name: 'Student' };
      const fb = generateSmartFallbackRemark(targetStudent, tone, length, focusArea);
      return res.json({
        success: true,
        isAiPowered: false,
        remarks: fb.primary,
        options: [fb.primary, ...fb.options],
        promotionStatus: fb.promotionSuggestion
      });
    }
  }
}
