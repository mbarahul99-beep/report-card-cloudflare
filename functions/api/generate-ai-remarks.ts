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

    const modelName = 'gemini-1.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

    // Bulk Student Generation
    if (body.isBulk && Array.isArray(body.students)) {
      const results = [];
      for (const st of body.students) {
        const prompt = buildStudentPrompt(st, body);
        const remarkText = await callGeminiModel(geminiUrl, prompt);
        results.push({
          studentId: st.id || st.studentId || '',
          studentName: st.name || '',
          remarks: remarkText || 'An encouraging, dedicated student showing good academic progress.',
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
    const remarks = await callGeminiModel(geminiUrl, prompt);

    return Response.json({
      success: true,
      isAiPowered: true,
      remarks: remarks || 'An encouraging, dedicated student showing consistent academic effort.',
      options: [
        remarks,
        `${singleStudent.name || 'The student'} demonstrates a strong commitment to learning and maintains excellent classroom conduct.`,
        `Shows consistent performance across academic subjects and active participation in class activities.`
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
  const pct = student.percentage ?? 75;
  const grade = student.grade || 'B';
  const tone = body.tone || 'encouraging';
  const focus = body.focusArea || 'all_round';
  const strong = (student.strongSubjects || []).join(', ') || 'General Subjects';
  const weak = (student.weakSubjects || []).join(', ');

  let prompt = `Write a constructive, professional 2-3 sentence report card remark for a student named "${name}".\n`;
  prompt += `Academic Percentage: ${pct}%, Overall Grade: ${grade}.\n`;
  prompt += `Strong Area: ${strong}.\n`;
  if (weak) prompt += `Area needing improvement: ${weak}.\n`;
  prompt += `Tone: ${tone}, Focus Area: ${focus}.\n`;
  prompt += `Instructions: Do NOT use negative or demoralizing words. Keep it motivating, realistic, and positive for school report cards. Return ONLY the plain text remark string with no JSON formatting or quotes.`;
  return prompt;
}

async function callGeminiModel(url: string, promptText: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 250
        }
      })
    });

    if (!res.ok) {
      return '';
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return (candidateText || '').trim();
  } catch {
    return '';
  }
}

function computePromotionStatus(student: any): string {
  const pct = student.percentage ?? 75;
  if (pct >= 33) {
    return 'Promoted to Next Higher Class';
  }
  return 'Eligible for Re-Assessment';
}
