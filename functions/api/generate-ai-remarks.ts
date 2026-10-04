// POST /api/generate-ai-remarks — Cloudflare Pages Function for Gemini AI Remark Generation & Key Validation
export async function onRequestPost(context: any) {
  const { env, request } = context;
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return Response.json({ success: false, error: 'Content-Type must be application/json' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON payload in request body' }, { status: 400 });
    }

    const apiKey = (body.apiKey || body.key || env.GEMINI_API_KEY || '').trim();

    // 1. Action: Validate Gemini API Key
    if (body.action === 'validate_key' || (body.apiKey && !body.student && !body.students)) {
      if (!apiKey) {
        return Response.json({ success: false, valid: false, error: 'API key is required for validation.' }, { status: 400 });
      }

      try {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        if (geminiRes.ok) {
          return Response.json({
            success: true,
            valid: true,
            message: '✨ Gemini API Key verified! Unlimited generations enabled.'
          });
        } else {
          let errData: any = {};
          try { errData = await geminiRes.json(); } catch {}
          const errMsg = errData?.error?.message || `API key validation failed (HTTP ${geminiRes.status})`;
          return Response.json({
            success: false,
            valid: false,
            error: errMsg
          }, { status: 400 });
        }
      } catch (valErr: any) {
        return Response.json({
          success: false,
          valid: false,
          error: valErr?.message || 'Failed to connect to Google AI Studio for key validation.'
        }, { status: 500 });
      }
    }

    // 2. Action: Generate AI Remarks for Single or Bulk Students
    if (!apiKey) {
      return Response.json({
        success: false,
        error: 'No Gemini API Key provided. Please connect your free Gemini API key in settings.'
      }, { status: 400 });
    }

    // Bulk Student Generation
    if (body.isBulk && Array.isArray(body.students)) {
      const results = [];
      for (const st of body.students) {
        const prompt = buildStudentPrompt(st, body);
        let remarkText = await callGeminiModel(apiKey, prompt);
        if (!remarkText || !remarkText.trim()) {
          remarkText = generateDynamicFallbackRemark(st, body);
        }
        results.push({
          studentId: st.id || st.studentId || '',
          studentName: st.name || '',
          remarks: remarkText,
          promotionStatus: computePromotionStatus(st)
        });
      }

      return Response.json({
        success: true,
        isAiPowered: true,
        results
      });
    }

    // Single Student Generation
    const singleStudent = body.student || {};
    const prompt = buildStudentPrompt(singleStudent, body);
    let remarks = await callGeminiModel(apiKey, prompt);
    if (!remarks || !remarks.trim()) {
      remarks = generateDynamicFallbackRemark(singleStudent, body);
    }

    const option2 = `${singleStudent.name || 'The student'} demonstrates steady engagement in classroom learning, exhibiting commendable conduct in co-scholastic activities and strong personal discipline.`;
    const option3 = `Shows consistent effort across academic subjects, active participation in school activities, and positive growth potential.`;

    return Response.json({
      success: true,
      isAiPowered: true,
      remarks: remarks,
      options: [
        remarks,
        option2,
        option3
      ],
      promotionStatus: computePromotionStatus(singleStudent)
    });

  } catch (err: any) {
    console.error('[generate-ai-remarks handler error]:', err);
    return Response.json({ success: false, error: err?.message || 'Server error during remark generation' }, { status: 500 });
  }
}

function buildStudentPrompt(student: any, body: any): string {
  const name = student.name || 'Student';
  const pct = student.percentage ?? 0;
  const grade = student.grade || 'E';
  const tone = body.tone || 'encouraging';
  const focus = body.focusArea || 'all_round';
  const lengthMode = (body.length || 'medium').toLowerCase();

  let lengthInstruction = '';
  if (lengthMode === 'short') {
    lengthInstruction = 'Generate EXACTLY 1 short, concise sentence (maximum 15 words total). Do NOT write multiple sentences.';
  } else if (lengthMode === 'detailed') {
    lengthInstruction = 'Generate a detailed 3-4 sentence comprehensive remark (45-60 words total) providing in-depth academic & co-scholastic feedback.';
  } else {
    lengthInstruction = 'Generate a balanced 2 sentence remark (20-30 words total).';
  }

  // Format academic performance details
  let academicStr = `Overall Percentage: ${pct}%, Grade: ${grade}.`;
  if (Array.isArray(student.subjectsSummary) && student.subjectsSummary.length > 0) {
    const subjList = student.subjectsSummary
      .map((s: any) => `${s.name}: ${s.marks}/${s.maxMarks}${s.grade ? ` (Grade ${s.grade})` : ''}`)
      .join(', ');
    academicStr += ` Subject Breakdown: ${subjList}.`;
  } else if (student.strongSubjects && student.strongSubjects.length > 0) {
    academicStr += ` Strong Areas: ${student.strongSubjects.join(', ')}.`;
  }
  if (student.weakSubjects && student.weakSubjects.length > 0) {
    academicStr += ` Needs attention in: ${student.weakSubjects.join(', ')}.`;
  }

  // Format co-scholastic details
  let coScholasticStr = '';
  if (Array.isArray(student.coScholasticSummary) && student.coScholasticSummary.length > 0) {
    const csList = student.coScholasticSummary
      .map((cs: any) => `${cs.name}: Grade ${cs.grade}`)
      .join(', ');
    coScholasticStr = `Co-Scholastic & Personal Development: ${csList}.`;
  }

  let prompt = `You are an experienced school teacher writing a personalized, positive, and constructive report card remark for a student named "${name}".\n\n`;
  prompt += `STUDENT ACADEMIC PERFORMANCE:\n${academicStr}\n\n`;
  if (coScholasticStr) {
    prompt += `STUDENT CO-SCHOLASTIC PERFORMANCE:\n${coScholasticStr}\n\n`;
  }
  if (student.attendance) {
    prompt += `ATTENDANCE: ${student.attendance}\n\n`;
  }
  prompt += `TEACHER PREFERENCES:\nTone: ${tone}, Focus Area: ${focus}, Desired Length: ${lengthMode}.\n`;
  if (body.customPrompt) {
    prompt += `Custom Teacher Instruction: ${body.customPrompt}\n`;
  }

  prompt += `\nCRITICAL INSTRUCTIONS:\n`;
  prompt += `1. LENGTH REQUIREMENT: ${lengthInstruction}\n`;
  prompt += `2. You MUST generate a personalized remark specifically tailored to "${name}" using their exact academic subject marks and co-scholastic grades provided above.\n`;
  prompt += `3. NEVER use generic boilerplate or identical phrases across different students.\n`;
  prompt += `4. Maintain a constructive, motivating, and encouraging tone suitable for an official school report card.\n`;
  prompt += `5. Output ONLY the plain text remark string with no JSON formatting, headings, or quotes.`;

  return prompt;
}

async function callGeminiModel(apiKey: string, promptText: string): Promise<string> {
  const models = [
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.5-pro'
  ];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300
          }
        })
      });

      if (!res.ok) continue;

      const data = await res.json().catch(() => ({}));
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText && candidateText.trim()) {
        return candidateText.trim();
      }
    } catch {
      continue;
    }
  }

  return '';
}

function generateDynamicFallbackRemark(student: any, body: any): string {
  const name = student.name || 'Student';
  const pct = student.percentage ?? 0;
  const grade = student.grade || 'E';
  const lengthMode = (body?.length || 'medium').toLowerCase();

  let highestSubj = '';
  let lowestSubj = '';
  if (Array.isArray(student.subjectsSummary) && student.subjectsSummary.length > 0) {
    const sorted = [...student.subjectsSummary].sort((a: any, b: any) => {
      const pctA = a.maxMarks ? (a.marks / a.maxMarks) : 0;
      const pctB = b.maxMarks ? (b.marks / b.maxMarks) : 0;
      return pctB - pctA;
    });
    highestSubj = sorted[0]?.name || '';
    if (sorted.length > 1) {
      lowestSubj = sorted[sorted.length - 1]?.name || '';
    }
  } else if (student.strongSubjects && student.strongSubjects.length > 0) {
    highestSubj = student.strongSubjects[0];
  }

  let coScholasticStrength = '';
  if (Array.isArray(student.coScholasticSummary) && student.coScholasticSummary.length > 0) {
    const topCs = student.coScholasticSummary.find((cs: any) => cs.grade === 'A+' || cs.grade === 'A') || student.coScholasticSummary[0];
    if (topCs) {
      coScholasticStrength = `${topCs.name} (Grade ${topCs.grade})`;
    }
  }

  // SHORT MODE: 1 concise sentence
  if (lengthMode === 'short') {
    if (pct >= 85) {
      return `${name} exhibits outstanding academic performance (${pct}%, Grade ${grade}) and exemplary classroom conduct.`;
    } else if (pct >= 70) {
      return `${name} maintains strong academic consistency (Grade ${grade}) and positive participation in school activities.`;
    } else if (pct >= 50) {
      return `${name} shows steady classroom learning (Grade ${grade}) and good engagement in co-scholastic domains.`;
    } else {
      return `${name} displays positive learning potential and continues to work towards strengthening core academics.`;
    }
  }

  // MEDIUM & DETAILED MODE
  let s1 = '';
  if (pct >= 85) {
    s1 = `${name} has achieved outstanding academic results this session with an overall Grade ${grade} (${pct}%).`;
    if (highestSubj) s1 += ` Demonstrates exceptional analytical skills and mastery in ${highestSubj}.`;
  } else if (pct >= 70) {
    s1 = `${name} shows strong academic commitment and commendable progress, earning an overall Grade ${grade} (${pct}%).`;
    if (highestSubj) s1 += ` Performs particularly well in ${highestSubj}.`;
  } else if (pct >= 50) {
    s1 = `${name} displays steady learning effort across subjects, securing an overall Grade ${grade} (${pct}%).`;
    if (highestSubj) s1 += ` Shows good engagement in ${highestSubj}.`;
  } else if (pct > 0) {
    s1 = `${name} shows developing academic progress (Grade ${grade}, ${pct}%) and requires targeted support to reach full potential.`;
    if (highestSubj) s1 += ` Shows positive interest in ${highestSubj}.`;
  } else {
    s1 = `${name} exhibits potential in daily classroom activities and continues to work towards strengthening foundational learning.`;
  }

  let s2 = '';
  if (coScholasticStrength) {
    s2 = `In co-scholastic domains, ${name} stands out in ${coScholasticStrength}, showing active participation and team spirit.`;
  } else {
    s2 = `${name} maintains positive classroom discipline, works well with peers, and displays good civic behavior.`;
  }

  if (lengthMode === 'medium') {
    return `${s1} ${s2}`;
  }

  // DETAILED MODE: 3 sentences
  let s3 = '';
  if (lowestSubj) {
    s3 = `With regular study habits and guidance in ${lowestSubj}, ${name} can significantly boost overall academic achievement.`;
  } else {
    s3 = `Consistent practice and active participation will help ${name} achieve greater academic heights in the coming session.`;
  }

  return `${s1} ${s2} ${s3}`;
}

function computePromotionStatus(student: any): string {
  const pct = student.percentage ?? 75;
  if (pct >= 33) {
    return 'Promoted to Next Higher Class';
  }
  return 'Eligible for Re-Assessment';
}
