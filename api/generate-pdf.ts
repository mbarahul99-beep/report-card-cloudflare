import PDFDocument from "pdfkit";

function formatFatherName(name?: string | null): string {
  if (!name || !name.trim()) return '';
  const trimmed = name.trim();
  if (/^(mr\.?|shri|late|dr\.?|prof\.?)\s+/i.test(trimmed)) {
    if (/^mr\.?\s+/i.test(trimmed)) {
      const rest = trimmed.replace(/^mr\.?\s+/i, '').trim();
      return rest ? `Mr. ${rest}` : 'Mr.';
    }
    return trimmed;
  }
  return `Mr. ${trimmed}`;
}

function formatMotherName(name?: string | null): string {
  if (!name || !name.trim()) return '';
  const trimmed = name.trim();
  if (/^(mrs\.?|smt\.?|ms\.?|late|dr\.?|prof\.?)\s+/i.test(trimmed)) {
    if (/^mrs\.?\s+/i.test(trimmed)) {
      const rest = trimmed.replace(/^mrs\.?\s+/i, '').trim();
      return rest ? `Mrs. ${rest}` : 'Mrs.';
    }
    return trimmed;
  }
  return `Mrs. ${trimmed}`;
}

function formatHeight(val?: string | number | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (!str) return '';
  const numericPart = str.replace(/\s*(cm|c\.m\.|centimeter|centimeters)\s*$/i, '').trim();
  return numericPart ? `${numericPart} CM` : str;
}

function formatWeight(val?: string | number | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (!str) return '';
  const numericPart = str.replace(/\s*(kg|k\.g\.|kilogram|kilograms)\s*$/i, '').trim();
  return numericPart ? `${numericPart} KG` : str;
}

// Helper function to fetch and download images concurrently on the server
async function getImageBuffer(url: string): Promise<Buffer | null> {
  if (!url) return null;
  try {
    if (url.startsWith('data:')) {
      const parts = url.split(',');
      if (parts.length > 1) {
        return Buffer.from(parts[1], 'base64');
      }
    }
    let fetchUrl = url;
    if (url.startsWith('/')) {
      fetchUrl = `http://localhost:3000${url}`;
    }
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch image from URL: ${fetchUrl}, status: ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error(`Error fetching image buffer for ${url}:`, err);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  try {
    const body = req.body || {};
    const isBulk = body.isBulk === true;
    const studentsToRender = isBulk ? (Array.isArray(body.students) ? body.students : []) : [body];

    if (studentsToRender.length === 0) {
      return res.status(400).json({ error: "No students provided for PDF generation." });
    }

    // Since branding is shared across the class in bulk mode, we grab the first student's branding
    const firstPayload = studentsToRender[0];
    const firstBranding = firstPayload.branding || {};
    
    // Concurrently fetch common branding assets once to optimize server speed
    const [logoBuffer, rightLogoBuffer, bannerBuffer, watermarkBuffer] = await Promise.all([
      getImageBuffer(firstBranding.logoUrl),
      getImageBuffer(firstBranding.rightLogoUrl),
      getImageBuffer(firstBranding.nameBannerUrl),
      getImageBuffer(firstBranding.watermarkLogoUrl)
    ]);

    // Concurrently fetch all student photo buffers
    const photoBuffers = await Promise.all(
      studentsToRender.map((s: any) => getImageBuffer(s.student?.photoUrl))
    );

    const orientation = firstBranding.printOrientation === "landscape" ? "landscape" : "portrait";

    // Initialize document
    const doc = new PDFDocument({
      size: "A4",
      layout: orientation,
      margins: { top: 35, bottom: 35, left: 35, right: 35 },
      bufferPages: true,
      autoPageBreaks: false
    } as any);

    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader("Content-Type", "application/pdf");
      if (isBulk) {
        res.setHeader("Content-Disposition", "attachment; filename=Bulk_Official_Report_Cards.pdf");
      } else {
        const safeStudentName = (firstPayload.student?.name || "student").replace(/[^a-zA-Z0-9]/g, "_");
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=${safeStudentName}_Official_Report_Card.pdf`);
      }
      res.send(pdfData);
    });

    doc.on("error", (err: any) => {
      console.error("PDFKit stream rendering error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "PDF Kit stream pipeline error: " + err.message });
      }
    });

    // Helper to draw clean table cells with background and text alignment
    const drawCell = (x: number, y: number, w: number, h: number, text: string, bg: string | null, textColor: string, align: 'left' | 'center' | 'right', isBold: boolean = false, isOblique: boolean = false, fontSize: number = 7) => {
      if (bg) {
        doc.save();
        doc.rect(x, y, w, h).fill(bg);
        doc.restore();
      }
      doc.save();
      doc.rect(x, y, w, h).lineWidth(0.5).strokeColor("#94A3B8").stroke();
      doc.restore();
      
      doc.fillColor(textColor);
      if (isBold) {
        doc.font("Helvetica-Bold");
      } else if (isOblique) {
        doc.font("Helvetica-Oblique");
      } else {
        doc.font("Helvetica");
      }
      doc.fontSize(fontSize);
      
      const textH = doc.currentLineHeight();
      const textY = y + (h - textH) / 2 + 0.5;
      const textX = align === 'left' ? x + 4 : x;
      const textW = align === 'left' ? w - 6 : w;
      doc.text(text, textX, textY, { width: textW, align: align, lineBreak: false });
    };

    // Render each student card as a separate page
    for (let i = 0; i < studentsToRender.length; i++) {
      if (i > 0) {
        doc.addPage({
          size: "A4",
          layout: orientation,
          margins: { top: 35, bottom: 35, left: 35, right: 35 },
          autoPageBreaks: false
        } as any);
      }

      const p = studentsToRender[i];
      const branding = p.branding || {};
      const student = p.student || {};
      const grades = p.grades || { scholastic: {}, co_scholastic: {}, activity: {}, attendance: {} };
      const rawFields = Array.isArray(p.fieldsToRender) ? p.fieldsToRender : [];
      const fieldsToRender = rawFields.filter((f: any) => {
        if (f.disabledAll || f.disabled === true) return false;
        if (f.disabledClasses && student.className && f.disabledClasses.includes(student.className)) return false;
        return true;
      });
      const subjects = Array.isArray(p.subjects) ? p.subjects : [];
      const scoreColumns = Array.isArray(p.scoreColumns) ? p.scoreColumns : [];
      const gradeScales = Array.isArray(p.gradeScales) ? p.gradeScales : [];
      const coGradeScales = Array.isArray(p.coGradeScales) ? p.coGradeScales : [];
      const signatures = Array.isArray(p.signatures) ? p.signatures : [];
      const overall = p.overall || {};
      const signatories = p.signatories || {};

      const themeColor = branding.themeColor || "#4F46E5";
      const borderColor = branding.borderColor || themeColor;

      const schoolName = branding.schoolName || "DEMO PUBLIC SCHOOL";
      const tagline = branding.tagline || "";
      const address = branding.address || "Main Campus";
      const helpline = branding.helpline || branding.phone || "N/A";
      const email = branding.email || "N/A";
      const website = branding.website || "N/A";
      const termLabel = p.termLabel || branding.termHeaderLabel || "Annual Report Card";

      const scholasticTerm1Disabled = p.scholasticTerm1Disabled === true;
      const scholasticTerm2Disabled = p.scholasticTerm2Disabled === true;
      const scholasticTerm3Disabled = p.scholasticTerm3Disabled === true;
      const coScholasticOneColumn = p.coScholasticOneColumn === true;
      const hideGradingScale = p.hideGradingScale === true;
      const pureGradeBased = p.pureGradeBased === true;
      const gradingScaleAfterSignatures = p.gradingScaleAfterSignatures === true;
      const gradingScaleLayout = p.gradingScaleLayout || 'side-by-side';
      const subjectSpecificMaxMarksEnabled = p.subjectSpecificMaxMarksEnabled === true;
      const enableSubjectGrouping = p.enableSubjectGrouping === true;
      const hideTerm1Total = p.hideTerm1Total === true;
      const hideTerm1Grade = p.hideTerm1Grade === true;
      const hideTerm2Total = p.hideTerm2Total === true;
      const hideTerm2Grade = p.hideTerm2Grade === true;
      const hideTerm3Total = p.hideTerm3Total === true;
      const hideTerm3Grade = p.hideTerm3Grade === true;
      const hideOverallTotal = p.hideOverallTotal === true;
      const hideOverallGrade = p.hideOverallGrade === true;

      const term1Enabled = branding.term1Enabled !== false && !scholasticTerm1Disabled;
      const term2Enabled = branding.term2Enabled !== false && !scholasticTerm2Disabled;
      const term3Enabled = branding.term3Enabled === true && !scholasticTerm3Disabled;
      const showOverall = (term1Enabled ? 1 : 0) + (term2Enabled ? 1 : 0) + (term3Enabled ? 1 : 0) > 1;

      const isLandscape = orientation === "landscape";

      // --- DOUBLE BORDERS ---
      doc.save();
      doc.rect(15, 15, doc.page.width - 30, doc.page.height - 30).lineWidth(3).strokeColor(borderColor).stroke();
      doc.rect(18.5, 18.5, doc.page.width - 37, doc.page.height - 37).lineWidth(1).strokeColor(borderColor).stroke();
      doc.restore();

      // --- WATERMARK OVERLAY ---
      if (branding.showWatermark) {
        doc.save();
        const opacity = branding.watermarkOpacity ?? 0.05;
        doc.opacity(opacity);
        
        if (branding.watermarkType === 'logo' && watermarkBuffer) {
          const size = branding.watermarkSize ?? 220;
          const wx = (doc.page.width - size) / 2;
          const wy = (doc.page.height - size) / 2;
          doc.image(watermarkBuffer, wx, wy, { width: size, height: size });
        } else {
          const text = branding.watermarkText || "sandbox";
          doc.fillColor("#000000");
          doc.font("Helvetica-Bold").fontSize(branding.watermarkSize ?? 60);
          doc.translate(doc.page.width / 2, doc.page.height / 2);
          doc.rotate(-30);
          doc.text(text, -doc.widthOfString(text) / 2, -doc.currentLineHeight() / 2);
        }
        doc.restore();
      }

      // --- HEADER / BRANDING BLOCK ---
      if (bannerBuffer) {
        doc.image(bannerBuffer, 35, 35, { 
          width: doc.page.width - 70, 
          height: 65, 
          fit: [doc.page.width - 70, 65], 
          align: 'center', 
          valign: 'center' 
        });
      } else {
        if (logoBuffer) {
          const logoSize = branding.logoSize ?? 65;
          doc.save();
          if (branding.logoCircular !== false) {
            doc.circle(35 + logoSize / 2, 35 + logoSize / 2, logoSize / 2).clip();
          }
          doc.image(logoBuffer, 35, 35, { width: logoSize, height: logoSize });
          doc.restore();
          
          if (branding.logoBorder !== false) {
            doc.circle(35 + logoSize / 2, 35 + logoSize / 2, logoSize / 2).lineWidth(1.2).strokeColor(themeColor).stroke();
          }
        } else {
          // Fallback Default Logo (Circle with "Logo" text) when logoUrl is empty/missing
          const logoSize = branding.logoSize ?? 65;
          doc.save();
          if (branding.logoCircular !== false) {
            doc.circle(35 + logoSize / 2, 35 + logoSize / 2, logoSize / 2).clip();
          }
          doc.rect(35, 35, logoSize, logoSize).fill("#FFFFFF");
          doc.restore();
          
          doc.save();
          doc.circle(35 + logoSize / 2, 35 + logoSize / 2, logoSize / 2 - 1).lineWidth(1.8).strokeColor(themeColor).stroke();
          doc.fillColor(themeColor)
             .font("Helvetica-Bold")
             .fontSize(logoSize * 0.22)
             .text("LOGO", 35, 35 + logoSize / 2 - (logoSize * 0.11), { align: "center", width: logoSize });
          doc.restore();
        }

        if (rightLogoBuffer) {
          const rightLogoSize = branding.rightLogoSize ?? 65;
          const rx = doc.page.width - 35 - rightLogoSize;
          doc.save();
          if (branding.logoCircular !== false) {
            doc.circle(rx + rightLogoSize / 2, 35 + rightLogoSize / 2, rightLogoSize / 2).clip();
          }
          doc.image(rightLogoBuffer, rx, 35, { width: rightLogoSize, height: rightLogoSize });
          doc.restore();
          
          if (branding.logoBorder !== false) {
            doc.circle(rx + rightLogoSize / 2, 35 + rightLogoSize / 2, rightLogoSize / 2).lineWidth(1.2).strokeColor(themeColor).stroke();
          }
        }

        const textLeft = branding.logoSize ? branding.logoSize + 50 : 110;
        const textRight = rightLogoBuffer ? doc.page.width - (branding.rightLogoSize ? branding.rightLogoSize + 50 : 110) : doc.page.width - 35;
        const textWidth = textRight - textLeft;
        
        const nameSize = branding.schoolNameFontSize ? Math.min(branding.schoolNameFontSize * 0.75, 18) : 16;
        doc.font("Helvetica-Bold")
           .fontSize(nameSize)
           .fillColor(themeColor)
           .text(schoolName.toUpperCase(), textLeft, 38, { align: "center", width: textWidth });
        
        let textY = 38 + nameSize + 4;
        if (tagline) {
          const taglineSize = branding.headerDetailsFontSize ? Math.min(branding.headerDetailsFontSize * 0.75, 8.5) : 8;
          doc.font("Helvetica-Bold")
             .fontSize(taglineSize)
             .fillColor("#475569")
             .text(tagline.toUpperCase(), textLeft, textY, { align: "center", width: textWidth });
          textY += taglineSize + 3;
        }
        
        if (address) {
          const addressSize = branding.headerDetailsFontSize ? Math.min(branding.headerDetailsFontSize * 0.75, 8) : 7.5;
          doc.font("Helvetica-Bold")
             .fontSize(addressSize)
             .fillColor("#64748B")
             .text(address, textLeft, textY, { align: "center", width: textWidth });
          textY += addressSize + 3;
        }
        
        const contactSize = branding.headerDetailsFontSize ? Math.min((branding.headerDetailsFontSize || 11) - 1.5, 7.5) : 7;
        doc.font("Helvetica")
           .fontSize(contactSize)
           .fillColor("#475569")
           .text(`Helpline: ${helpline}  |  Email: ${email}  |  Website: ${website}`, textLeft, textY, { align: "center", width: textWidth });
      }

      // --- SEPARATOR SECTION ---
      doc.save();
      doc.moveTo(35, 110)
         .lineTo(doc.page.width - 35, 110)
         .lineWidth(1.2)
         .strokeColor(themeColor)
         .stroke();
      doc.restore();

      // --- MAIN REPORT CARD BADGES ---
      const titleText = termLabel.toUpperCase();
      doc.font("Helvetica-Bold").fontSize(8.5);
      const titleW = doc.widthOfString(titleText) + 24;
      const titleX = (doc.page.width - titleW) / 2;
      const titleY = 118;
      
      doc.roundedRect(titleX, titleY, titleW, 18, 2).fill(themeColor);
      doc.fillColor("#FFFFFF").text(titleText, titleX, titleY + 5, { align: "center", width: titleW });
      
      const rawSession = branding.session || "2022-2023";
      const sessionText = rawSession.toLowerCase().includes("session") ? rawSession : `Session ${rawSession}`;
      doc.font("Helvetica-Bold").fontSize(7.5);
      const sessW = doc.widthOfString(sessionText.toUpperCase()) + 16;
      const sessX = (doc.page.width - sessW) / 2;
      const sessY = 141;
      
      doc.roundedRect(sessX, sessY, sessW, 13, 2).lineWidth(0.75).strokeColor(themeColor).stroke();
      doc.fillColor("#1E293B").text(sessionText.toUpperCase(), sessX, sessY + 3, { align: "center", width: sessW });

      // --- STUDENT PERSONAL PROFILE CARD ---
      const profileY = isLandscape ? 135 : 160;
      const profileH = isLandscape ? 45 : 72;
      const profileW = doc.page.width - 70;
      
      doc.roundedRect(35, profileY, profileW, profileH, 3).fillAndStroke("#F8FAFC", "#CBD5E1");

      // Dynamic student photo sizing & rendering
      const photoW = branding.studentPhotoWidth ?? (isLandscape ? 40 : 58);
      const photoH = branding.studentPhotoHeight ?? (isLandscape ? 38 : 64);
      const px = doc.page.width - 35 - 10 - photoW;
      const py = profileY + (profileH - photoH) / 2;
      
      doc.roundedRect(px, py, photoW, photoH, 3).lineWidth(1).strokeColor(themeColor).stroke();
      const currentPhotoBuffer = photoBuffers[i];
      if (currentPhotoBuffer) {
        doc.save();
        doc.roundedRect(px + 1, py + 1, photoW - 2, photoH - 2, 2).clip();
        doc.image(currentPhotoBuffer, px + 1, py + 1, { cover: [photoW - 2, photoH - 2], align: 'center', valign: 'center' });
        doc.restore();
      } else {
        doc.font("Helvetica").fontSize(6.5).fillColor("#94A3B8").text("STUDENT", px, py + photoH / 2 - 8, { align: 'center', width: photoW });
        doc.text("PHOTO", px, py + photoH / 2, { align: 'center', width: photoW });
      }

      // Profile grid fields layout
      const mid = Math.ceil(fieldsToRender.length / 2);
      const col1 = fieldsToRender.slice(0, mid);
      const col2 = fieldsToRender.slice(mid);
      
      const drawFields = (fields: any[], startX: number, endX: number) => {
        let fieldY = profileY + (isLandscape ? 4 : 7);
        const stepY = isLandscape ? 8.2 : 12;
        const fontSize = isLandscape ? 6.5 : 7.5;
        fields.forEach((field: any) => {
          let val = student[field.id] || "N/A";
          if (field.id === "section") val = student.section || "A";
          if (field.id === "className") val = student.className || "N/A";
          if (field.id === "rollNo") val = student.rollNo || "N/A";
          if (field.id === "admissionNo") val = student.admissionNo || "N/A";
          if (field.id === "fatherName") val = student.fatherName ? formatFatherName(student.fatherName) : "N/A";
          if (field.id === "motherName") val = student.motherName ? formatMotherName(student.motherName) : "N/A";
          if (field.id === "height") val = student.height ? formatHeight(student.height) : "N/A";
          if (field.id === "weight") val = student.weight ? formatWeight(student.weight) : "N/A";
          
          const labelText = `${field.label.toUpperCase()}:`;
          doc.font("Helvetica-Bold").fontSize(fontSize).fillColor("#475569");
          doc.text(labelText, startX, fieldY, { width: 100 });
          
          const labelW = Math.max(doc.widthOfString(labelText) + 5, isLandscape ? 60 : 80);
          const valX = startX + labelW;
          
          doc.save();
          doc.strokeColor("#CBD5E1").lineWidth(0.5).dash(1, { space: 1.5 });
          doc.moveTo(valX, fieldY + (isLandscape ? 6 : 7)).lineTo(endX, fieldY + (isLandscape ? 6 : 7)).stroke();
          doc.restore();
          
          doc.font("Helvetica-Bold").fontSize(fontSize).fillColor("#1E293B");
          doc.text(String(val).toUpperCase(), valX + 2, fieldY - 0.5, { width: endX - valX - 2, lineBreak: false });
          
          fieldY += stepY;
        });
      };
      
      const col1StartX = 45;
      const col1EndX = 35 + Math.floor(profileW * 0.42);
      const col2StartX = col1EndX + 15;
      const col2EndX = px - 15;
      
      drawFields(col1, col1StartX, col1EndX);
      drawFields(col2, col2StartX, col2EndX);

      // --- NESTED SCHOLASTIC PERFORMANCE TABLE ---
      const tableTop = profileY + profileH + 8;
      const tableW = doc.page.width - 70;

      const scholasticSubjects = subjects.filter((s: any) => s.type === 'scholastic');

      // Metric calculations per student
      const getMidpointPercentForGrade = (gradeName: string) => {
        if (!gradeName) return 0;
        const cleanGrade = String(gradeName).trim().toUpperCase();
        const match = gradeScales.find((scale: any) => scale.grade.trim().toUpperCase() === cleanGrade);
        if (match) {
          return (match.minPercent + match.maxPercent) / 2;
        }
        return 0;
      };

      const getEquivalentMark = (val: any, maxMarks: number) => {
        const parsedMax = Number(maxMarks) || 0;
        if (val === undefined || val === null || val === '-' || val === '') return 0;
        if (typeof val === 'string' && isNaN(Number(val))) {
          const midPercent = getMidpointPercentForGrade(val);
          return (midPercent / 100) * parsedMax;
        }
        return Number(val) || 0;
      };

      const getGradeForPercent = (pctVal: number) => {
        for (const scale of gradeScales) {
          if (pctVal >= scale.minPercent && pctVal <= scale.maxPercent) {
            return scale.grade;
          }
        }
        return "-";
      };

      const getGradeFromMark = (mark: number, maxM: number) => {
        if (!maxM || maxM <= 0) return "-";
        const pctVal = (mark / maxM) * 100;
        return getGradeForPercent(pctVal);
      };

      const studentMetrics: Record<string, any> = {};
      scholasticSubjects.forEach((sub: any) => {
        const scoreSheet = grades.scholastic[sub.id] || { term1: {}, term2: {}, term3: {} };
        const sumOfColumnMaxMarksForSub = scoreColumns.reduce((sum, col) => sum + (sub.customMaxMarks?.[col.id] ?? col.maxMarks), 0);
        const sumOfColumnMaxMarks = scoreColumns.reduce((sum, col) => sum + col.maxMarks, 0);
        const subMaxMarks = subjectSpecificMaxMarksEnabled ? sumOfColumnMaxMarksForSub : (sub.maxMarks ?? sumOfColumnMaxMarks);

        let t1Sum = term1Enabled ? scoreColumns.reduce((sum, col) => {
          const val = scoreSheet.term1?.[col.id];
          const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
          return sum + getEquivalentMark(val, colMax);
        }, 0) : 0;

        let t2Sum = term2Enabled ? scoreColumns.reduce((sum, col) => {
          const val = scoreSheet.term2?.[col.id];
          const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
          return sum + getEquivalentMark(val, colMax);
        }, 0) : 0;

        let t3Sum = term3Enabled ? scoreColumns.reduce((sum, col) => {
          const val = scoreSheet.term3?.[col.id];
          const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
          return sum + getEquivalentMark(val, colMax);
        }, 0) : 0;

        if (!subjectSpecificMaxMarksEnabled && subMaxMarks !== sumOfColumnMaxMarks && sumOfColumnMaxMarks > 0) {
          if (term1Enabled) t1Sum = (t1Sum / sumOfColumnMaxMarks) * subMaxMarks;
          if (term2Enabled) t2Sum = (t2Sum / sumOfColumnMaxMarks) * subMaxMarks;
          if (term3Enabled) t3Sum = (t3Sum / sumOfColumnMaxMarks) * subMaxMarks;
        }

        let overallScore = 0;
        let termsCount = 0;
        if (term1Enabled) { overallScore += t1Sum; termsCount++; }
        if (term2Enabled) { overallScore += t2Sum; termsCount++; }
        if (term3Enabled) { overallScore += t3Sum; termsCount++; }

        const maxOverall = subMaxMarks * termsCount;
        const pct = maxOverall > 0 ? (overallScore / maxOverall) * 100 : 0;
        const grade = getGradeForPercent(pct);

        studentMetrics[sub.id] = {
          term1Total: Math.round(t1Sum * 10) / 10,
          term2Total: Math.round(t2Sum * 10) / 10,
          term3Total: Math.round(t3Sum * 10) / 10,
          overall: Math.round(overallScore * 10) / 10,
          overallRound: Math.round(overallScore),
          percentage: pct,
          grade
        };
      });

      // Calculate table subcolumn structure
      const showT1Total = !hideTerm1Total;
      const showT1Grade = !pureGradeBased && !hideTerm1Grade;
      const t1ColsCount = scoreColumns.length + (showT1Total ? 1 : 0) + (showT1Grade ? 1 : 0);

      const showT2Total = !hideTerm2Total;
      const showT2Grade = !pureGradeBased && !hideTerm2Grade;
      const t2ColsCount = scoreColumns.length + (showT2Total ? 1 : 0) + (showT2Grade ? 1 : 0);

      const showT3Total = !hideTerm3Total;
      const showT3Grade = !pureGradeBased && !hideTerm3Grade;
      const t3ColsCount = scoreColumns.length + (showT3Total ? 1 : 0) + (showT3Grade ? 1 : 0);

      const showOverallTotal = !pureGradeBased && !hideOverallTotal;
      const showOverallGrade = !hideOverallGrade;
      const overallColsCount = showOverall ? ((showOverallTotal ? 1 : 0) + (showOverallGrade ? 1 : 0)) : 0;

      const totalOtherCols = (term1Enabled ? t1ColsCount : 0) + 
                             (term2Enabled ? t2ColsCount : 0) + 
                             (term3Enabled ? t3ColsCount : 0) + 
                             overallColsCount;

      let otherColW = 0;
      let finalSubjW = 0;
      if (totalOtherCols > 0) {
        if (pureGradeBased) {
          // Grade-only mode: keep grade columns at minimal required width (e.g. 50-65pt) so subject names get full width
          const targetOtherW = isLandscape ? 50 : 60;
          otherColW = Math.max(35, Math.min(targetOtherW, Math.floor((tableW * 0.4) / totalOtherCols)));
          const actualRemainingW = otherColW * totalOtherCols;
          finalSubjW = tableW - actualRemainingW;
        } else {
          const colSubjectW = Math.max(120, Math.floor(tableW * 0.28));
          const remainingW = tableW - colSubjectW;
          otherColW = Math.floor(remainingW / totalOtherCols);
          const actualRemainingW = otherColW * totalOtherCols;
          finalSubjW = tableW - actualRemainingW;
        }
      } else {
        finalSubjW = tableW;
      }

      const subCols: any[] = [];
      let currentX = 35 + finalSubjW;

      const addTermCols = (termId: string, termHeaderStr: string, showTotal: boolean, showGrade: boolean, totalHeaderLabel: string) => {
        const startX = currentX;
        scoreColumns.forEach((col: any) => {
          const text = (col.id === 'hy') 
            ? (termId === 'term1' ? (branding.term1ExamLabel || col.name) : termId === 'term2' ? (branding.term2ExamLabel || col.name) : (branding.term3ExamLabel || col.name)) 
            : col.name;
          subCols.push({ termId, colId: col.id, label: (col.label || text || col.id).toUpperCase(), x: currentX });
          currentX += otherColW;
        });
        if (showTotal) {
          subCols.push({ termId, colId: 'total', label: totalHeaderLabel.toUpperCase(), x: currentX });
          currentX += otherColW;
        }
        if (showGrade) {
          subCols.push({ termId, colId: 'grade', label: 'GRADE', x: currentX });
          currentX += otherColW;
        }
        return { label: termHeaderStr, x: startX, width: currentX - startX };
      };

      const termHeaders: any[] = [];
      if (term1Enabled && t1ColsCount > 0) {
        termHeaders.push(addTermCols('term1', branding.term1Label || "Term 1", showT1Total, showT1Grade, branding.term1TotalLabel || (pureGradeBased ? "Grade" : "Total")));
      }
      if (term2Enabled && t2ColsCount > 0) {
        termHeaders.push(addTermCols('term2', branding.term2Label || "Term 2", showT2Total, showT2Grade, branding.term2TotalLabel || (pureGradeBased ? "Grade" : "Total")));
      }
      if (term3Enabled && t3ColsCount > 0) {
        termHeaders.push(addTermCols('term3', branding.term3Label || "Term 3", showT3Total, showT3Grade, branding.term3TotalLabel || (pureGradeBased ? "Grade" : "Total")));
      }
      if (showOverall && overallColsCount > 0) {
        const startX = currentX;
        if (showOverallTotal) {
          subCols.push({ termId: 'overall', colId: 'total', label: (branding.totalMarksHeaderLabel || 'TOTAL').toUpperCase(), x: currentX });
          currentX += otherColW;
        }
        if (showOverallGrade) {
          subCols.push({ termId: 'overall', colId: 'grade', label: (branding.gradeHeaderLabel || 'GRADE').toUpperCase(), x: currentX });
          currentX += otherColW;
        }
        termHeaders.push({ label: branding.overallResultsHeaderLabel || 'OVERALL', x: startX, width: currentX - startX });
      }

      const rowH = (isLandscape || scholasticSubjects.length > 8) ? 11 : 14;
      const tableFontSize = (isLandscape || scholasticSubjects.length > 8) ? 6 : 7;

      const headerBg = "#E2E8F0";
      const headerText = "#1E293B";

      // Header Row 1: MAIN SCHOLASTIC TITLE
      const scholasticTitleText = branding.scholasticPerformanceHeaderLabel || branding.scholasticLabel || "SCHOLASTIC PERFORMANCE";
      drawCell(35, tableTop, tableW, rowH, scholasticTitleText.toUpperCase(), headerBg, headerText, 'center', true, false, tableFontSize + 0.5);

      // Header Row 2: MERGED TERM HEADERS
      drawCell(35, tableTop + rowH, finalSubjW, rowH, "", headerBg, headerText, 'center', true);
      termHeaders.forEach(th => {
        drawCell(th.x, tableTop + rowH, th.width, rowH, th.label.toUpperCase(), headerBg, headerText, 'center', true, false, tableFontSize);
      });

      // Header Row 3: EXAMS & MARKS METRIC HEADERS
      drawCell(35, tableTop + rowH * 2, finalSubjW, rowH, (branding.scholasticSubjectsHeaderLabel || "SUBJECTS").toUpperCase(), headerBg, headerText, 'left', true, false, tableFontSize);
      subCols.forEach(sc => {
        drawCell(sc.x, tableTop + rowH * 2, otherColW, rowH, sc.label, headerBg, headerText, 'center', true, false, tableFontSize - 0.2);
      });

      // Render Subject Rows
      let currentY = tableTop + rowH * 3;
      scholasticSubjects.forEach((subj: any, idx: number) => {
        const isFirstInGroup = enableSubjectGrouping && subj.group && (idx === 0 || scholasticSubjects[idx - 1]?.group !== subj.group);
        if (isFirstInGroup) {
          // Draw group banner across table
          drawCell(35, currentY, tableW, rowH, subj.group.toUpperCase(), "#F1F5F9", "#0F172A", 'left', true, false, tableFontSize + 0.3);
          currentY += rowH;
        }

        const bg = idx % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
        const subjText = (enableSubjectGrouping && subj.group)
          ? `  - ${subj.name.startsWith('- ') ? subj.name.substring(2) : subj.name}` 
          : (subj.name.startsWith('- ') ? `  - ${subj.name.substring(2)}` : subj.name);
        
        // Subject cell
        drawCell(35, currentY, finalSubjW, rowH, subjText, bg, "#334155", 'left', true, false, tableFontSize);
        
        // Subject marks columns cells
        subCols.forEach(sc => {
          let val = "-";
          const subGrades = grades.scholastic[subj.id] || {};
          const metrics = studentMetrics[subj.id] || {};
          const sumOfColumnMaxMarksForSub = scoreColumns.reduce((sum: number, col: any) => sum + (subj.customMaxMarks?.[col.id] ?? col.maxMarks), 0);
          const sumOfColumnMaxMarks = scoreColumns.reduce((sum: number, col: any) => sum + col.maxMarks, 0);
          const subMaxMarks = subjectSpecificMaxMarksEnabled ? sumOfColumnMaxMarksForSub : (subj.maxMarks ?? sumOfColumnMaxMarks);

          if (sc.termId === 'overall') {
            if (sc.colId === 'total') {
              val = subjectSpecificMaxMarksEnabled 
                ? `${metrics.overallRound || 0}/${(subMaxMarks * ((term1Enabled?1:0)+(term2Enabled?1:0)+(term3Enabled?1:0)))}`
                : (metrics.overallRound?.toString() || "-");
            } else if (sc.colId === 'grade') {
              val = metrics.grade || "-";
            }
          } else {
            const termGrades = subGrades[sc.termId] || {};
            if (sc.colId === 'total') {
              const termSum = sc.termId === 'term1' ? metrics.term1Total : sc.termId === 'term2' ? metrics.term2Total : metrics.term3Total;
              if (pureGradeBased) {
                val = getGradeFromMark(termSum || 0, subMaxMarks);
              } else {
                val = subjectSpecificMaxMarksEnabled ? `${termSum || 0}/${subMaxMarks}` : (termSum?.toString() || "0");
              }
            } else if (sc.colId === 'grade') {
              const termSum = sc.termId === 'term1' ? metrics.term1Total : sc.termId === 'term2' ? metrics.term2Total : metrics.term3Total;
              val = getGradeFromMark(termSum || 0, subMaxMarks);
            } else {
              const rawVal = termGrades[sc.colId];
              const resolvedVal = (rawVal === undefined || rawVal === null || rawVal === '') ? 0 : rawVal;
              const colMax = subj.customMaxMarks?.[sc.colId] ?? scoreColumns.find((c: any) => c.id === sc.colId)?.maxMarks ?? 100;
              if (pureGradeBased) {
                val = getGradeFromMark(resolvedVal, colMax);
              } else {
                val = subjectSpecificMaxMarksEnabled ? `${resolvedVal}/${colMax}` : String(resolvedVal);
              }
            }
          }
          
          const isGrd = sc.colId === 'grade' || (pureGradeBased && sc.colId === 'total');
          drawCell(sc.x, currentY, otherColW, rowH, String(val || "-"), bg, isGrd ? themeColor : "#1E293B", 'center', isGrd, false, tableFontSize);
        });

        currentY += rowH;
      });

      // --- OVERALL AGGREGATE DASHBOARD BOX ---
      const boxY = currentY + (isLandscape ? 5 : 8);
      const boxH = isLandscape ? 24 : 32;
      doc.roundedRect(35, boxY, tableW, boxH, 3).fillAndStroke("#F8FAFC", "#CBD5E1");
      
      const hideAttendance = p.hideAttendance === true;
      const metricColsCount = hideAttendance ? 3 : 4;
      const metricColW = Math.floor(tableW / metricColsCount);
      
      const drawMetric = (label: string, value: string, xPos: number, highlight: boolean = false) => {
        doc.font("Helvetica-Bold").fontSize(isLandscape ? 6 : 7).fillColor("#475569").text(label.toUpperCase(), xPos, boxY + (isLandscape ? 4 : 7), { align: "center", width: metricColW });
        doc.font("Helvetica-Bold").fontSize(isLandscape ? 7.5 : 8.5).fillColor(highlight ? themeColor : "#1E293B").text(value, xPos, boxY + (isLandscape ? 12 : 17), { align: "center", width: metricColW });
      };
      
      let curMetricX = 35;
      drawMetric(branding.totalMarksHeaderLabel || "AGGREGATE TOTAL", `${overall.totalMarks} / ${overall.maxMarks}`, curMetricX);
      curMetricX += metricColW;
      
      drawMetric(branding.gradePercentageLabel || "OVERALL PERCENT", overall.percentage || "N/A", curMetricX);
      curMetricX += metricColW;
      
      drawMetric(branding.gradeHeaderLabel || "FINAL GRADE", overall.grade || "N/A", curMetricX, true);
      curMetricX += metricColW;
      
      if (!hideAttendance) {
        drawMetric(branding.attendanceLabel || "ATTENDANCE", overall.attendance || "Present", curMetricX);
      }
      
      currentY = boxY + boxH;

      // --- CO-SCHOLASTIC & ACTIVITY TABLES ---
      const activeSections = p.coScholasticSections && p.coScholasticSections.length > 0
        ? p.coScholasticSections
        : [
            {
              id: 'co_scholastic',
              title: branding.personalityHeaderLabel || "PART 2: CO-SCHOLASTIC ASSESSMENT",
              subjectHeader: branding.personalitySubjectHeaderLabel || "SUBJECT AREA DOMAINS",
              gradingScaleText: '5-Point Scale',
              term1Enabled: term1Enabled,
              term2Enabled: term2Enabled,
              type: 'co_scholastic'
            },
            {
              id: 'activity',
              title: branding.coCurricularHeaderLabel || "PART 3: CO-CURRICULAR AREA & SKILLS",
              subjectHeader: branding.coCurricularSubjectHeaderLabel || "ACTIVITY AREAS",
              gradingScaleText: '3-Point Scale',
              term1Enabled: term1Enabled && !branding.coCurricularDisabled,
              term2Enabled: term2Enabled && !branding.coCurricularDisabled,
              type: 'activity'
            }
          ];

      const printableSections = activeSections.filter((sec: any) => {
        const secT1 = term1Enabled && sec.term1Enabled !== false;
        const secT2 = term2Enabled && sec.term2Enabled !== false;
        const secT3 = term3Enabled && sec.term3Enabled !== false;
        return secT1 || secT2 || secT3;
      });

      const coRowH = (isLandscape || scholasticSubjects.length > 8) ? 10 : 12;
      const coFontSize = (isLandscape || scholasticSubjects.length > 8) ? 6 : 6.5;

      const drawCoScholasticTable = (x: number, y: number, w: number, sec: any, matchingSubjs: any[]) => {
        const secT1 = term1Enabled && sec.term1Enabled !== false;
        const secT2 = term2Enabled && sec.term2Enabled !== false;
        const secT3 = term3Enabled && sec.term3Enabled !== false;
        
        const termColsCount = (secT1 ? 1 : 0) + (secT2 ? 1 : 0) + (secT3 ? 1 : 0);
        const termW = Math.floor(w * 0.16);
        const subjW = w - (termW * termColsCount);
        
        const hRow = isLandscape ? 11 : 14;
        
        // Header Row 1: Section Title
        drawCell(x, y, w, hRow, sec.title.toUpperCase(), headerBg, headerText, 'center', true, false, coFontSize + 0.3);
        
        // Header Row 2: Columns Headers
        drawCell(x, y + hRow, subjW, hRow, sec.subjectHeader.toUpperCase(), headerBg, headerText, 'left', true, false, coFontSize);
        let curX = x + subjW;
        if (secT1) {
          drawCell(curX, y + hRow, termW, hRow, (branding.term1Label || "Term 1").toUpperCase(), headerBg, headerText, 'center', true, false, coFontSize);
          curX += termW;
        }
        if (secT2) {
          drawCell(curX, y + hRow, termW, hRow, (branding.term2Label || "Term 2").toUpperCase(), headerBg, headerText, 'center', true, false, coFontSize);
          curX += termW;
        }
        if (secT3) {
          drawCell(curX, y + hRow, termW, hRow, (branding.term3Label || "Term 3").toUpperCase(), headerBg, headerText, 'center', true, false, coFontSize);
          curX += termW;
        }
        
        // Subject Rows
        let curY = y + hRow * 2;
        matchingSubjs.forEach((sub, sIdx) => {
          const isFirstInGroup = enableSubjectGrouping && sub.group && (sIdx === 0 || matchingSubjs[sIdx - 1]?.group !== sub.group);
          if (isFirstInGroup) {
            drawCell(x, curY, w, coRowH, sub.group.toUpperCase(), "#F1F5F9", "#0F172A", 'left', true, false, coFontSize + 0.2);
            curY += coRowH;
          }

          const bg = sIdx % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
          const subText = (enableSubjectGrouping && sub.group)
            ? `  - ${sub.name.startsWith('- ') ? sub.name.substring(2) : sub.name}` 
            : (sub.name.startsWith('- ') ? `  - ${sub.name.substring(2)}` : sub.name);

          drawCell(x, curY, subjW, coRowH, subText, bg, "#334155", 'left', false, false, coFontSize);
          
          let subX = x + subjW;
          const gradesMap = sec.type === 'activity' ? (grades.activity || {}) : (grades.co_scholastic || {});
          const scVal = gradesMap[sub.id] || { term1: '-', term2: '-', term3: '-' };
          
          if (secT1) {
            drawCell(subX, curY, termW, coRowH, scVal.term1 || "-", bg, "#334155", 'center', true, false, coFontSize);
            subX += termW;
          }
          if (secT2) {
            drawCell(subX, curY, termW, coRowH, scVal.term2 || "-", bg, "#334155", 'center', true, false, coFontSize);
            subX += termW;
          }
          if (secT3) {
            drawCell(subX, curY, termW, coRowH, scVal.term3 || "-", bg, "#334155", 'center', true, false, coFontSize);
            subX += termW;
          }
          curY += coRowH;
        });
        
        return curY;
      };

      let coScholasticEndY = currentY;
      if (printableSections.length > 0) {
        const sectionsToDraw: any[] = [];
        printableSections.forEach((sec: any) => {
          const matching = subjects.filter((s: any) => 
            s.sectionId === sec.id || 
            (s.type === sec.type && (!s.sectionId || s.sectionId === sec.id))
          );
          if (matching.length > 0) {
            sectionsToDraw.push({ sec, matching });
          }
        });
        
        if (sectionsToDraw.length > 0) {
          const yStart = currentY + (isLandscape ? 5 : 10);
          if (sectionsToDraw.length > 1 && !coScholasticOneColumn) {
            // Draw side-by-side
            const tableWidth = Math.floor((tableW - 12) / 2);
            const h1 = drawCoScholasticTable(35, yStart, tableWidth, sectionsToDraw[0].sec, sectionsToDraw[0].matching);
            const h2 = drawCoScholasticTable(35 + tableWidth + 12, yStart, tableWidth, sectionsToDraw[1].sec, sectionsToDraw[1].matching);
            coScholasticEndY = Math.max(h1, h2);
          } else {
            // Draw stacked
            let curY = yStart;
            sectionsToDraw.forEach(std => {
              curY = drawCoScholasticTable(35, curY, tableW, std.sec, std.matching) + 6;
            });
            coScholasticEndY = curY - 6;
          }
        }
      }

      // --- REMARKS & CONGRATULATIONS BOX ---
      const remarksY = coScholasticEndY + (isLandscape ? 4 : 8);
      const remarksBoxH = isLandscape ? 20 : 28;
      doc.rect(35, remarksY, tableW, remarksBoxH).lineWidth(0.75).strokeColor("#CBD5E1").stroke();

      const congratulationsDisabled = branding.congratulationsDisabled === true;
      const colRemarksW = congratulationsDisabled ? tableW : Math.floor(tableW * 0.72);

      // Draw Teacher Remarks text
      doc.font("Helvetica-Bold").fontSize(isLandscape ? 6 : 7).fillColor("#1E293B").text("TEACHER'S REMARKS:", 42, remarksY + (isLandscape ? 3 : 4));
      const remarksText = student.remarks || "Student has demonstrated magnificent educational and sportsmanship levels throughout the calendar sessions.";
      doc.font("Helvetica-Oblique").fontSize(isLandscape ? 5.8 : 6.5).fillColor("#334155").text(remarksText, 42, remarksY + (isLandscape ? 10 : 13), { width: colRemarksW - 14, height: isLandscape ? 8 : 12, lineBreak: true });

      if (!congratulationsDisabled) {
        const promoX = 35 + colRemarksW;
        const promoW = tableW - colRemarksW;
        doc.save();
        doc.moveTo(promoX, remarksY).lineTo(promoX, remarksY + remarksBoxH).lineWidth(0.5).strokeColor("#CBD5E1").stroke();
        doc.restore();
        
        const promoText = student.promotionStatus || "Congratulations! You are promoted.";
        doc.font("Helvetica-Bold").fontSize(isLandscape ? 6.5 : 7.5).fillColor(themeColor).text(promoText.toUpperCase(), promoX + 4, remarksY + (isLandscape ? 6 : 10), { width: promoW - 8, align: 'center' });
      }

      // --- GRADING SCALE ROW ---
      const drawGradingScales = (y: number) => {
        const resolvedGradeScales = (gradeScales && gradeScales.length > 0) ? gradeScales : [
          { grade: 'A1', minPercent: 91, maxPercent: 100, point: 10 },
          { grade: 'A2', minPercent: 81, maxPercent: 90, point: 9 },
          { grade: 'B1', minPercent: 71, maxPercent: 80, point: 8 },
          { grade: 'B2', minPercent: 61, maxPercent: 70, point: 7 },
          { grade: 'C1', minPercent: 51, maxPercent: 60, point: 6 },
          { grade: 'C2', minPercent: 41, maxPercent: 50, point: 5 },
          { grade: 'D', minPercent: 33, maxPercent: 40, point: 4 },
          { grade: 'E', minPercent: 0, maxPercent: 32, point: 3 }
        ];
        const resolvedCoGradeScales = (coGradeScales && coGradeScales.length > 0) ? coGradeScales : [
          { score: 'A', description: 'Exemplary' },
          { score: 'B', description: 'Very Good' },
          { score: 'C', description: 'Good' },
          { score: 'D', description: 'Fair' },
          { score: 'E', description: 'Needs Imp.' }
        ];

        const labelSize = isLandscape ? 5.5 : 6.5;
        const cellH = isLandscape ? 9 : 11;
        const fontSizeScale = isLandscape ? 5 : 5.8;

        doc.font("Helvetica-Bold").fontSize(labelSize).fillColor("#64748B").text("SCHOLASTIC GRADING SCALE", 35, y);
        
        // Scholastic scale table
        const colW = Math.floor(tableW * 0.58);
        const cellW = Math.floor(colW / (resolvedGradeScales.length + 1));
        
        // Row 1: Range (%)
        drawCell(35, y + 6, cellW, cellH, "Range (%)", "#F8FAFC", "#64748B", 'center', true, false, fontSizeScale);
        resolvedGradeScales.forEach((gs, gIdx) => {
          drawCell(35 + cellW * (gIdx + 1), y + 6, cellW, cellH, `${gs.minPercent}-${gs.maxPercent}`, null, "#334155", 'center', false, false, fontSizeScale);
        });
        
        // Row 2: Grade
        drawCell(35, y + 6 + cellH, cellW, cellH, "Grade", "#F8FAFC", "#64748B", 'center', true, false, fontSizeScale);
        resolvedGradeScales.forEach((gs, gIdx) => {
          drawCell(35 + cellW * (gIdx + 1), y + 6 + cellH, cellW, cellH, gs.grade, null, themeColor, 'center', true, false, fontSizeScale);
        });
        
        // Co-scholastic scale table side-by-side
        const coScaleX = 35 + colW + 12;
        const coScaleW = tableW - colW - 12;
        const coCellW = Math.floor(coScaleW / resolvedCoGradeScales.length);
        
        doc.font("Helvetica-Bold").fontSize(labelSize).fillColor("#64748B").text("CO-SCHOLASTIC GRADING SCALE", coScaleX, y);
        
        // Row 1: Score
        resolvedCoGradeScales.forEach((cgs, cgIdx) => {
          drawCell(coScaleX + coCellW * cgIdx, y + 6, coCellW, cellH, cgs.score, "#F8FAFC", themeColor, 'center', true, false, fontSizeScale);
        });
        // Row 2: Description
        resolvedCoGradeScales.forEach((cgs, cgIdx) => {
          drawCell(coScaleX + coCellW * cgIdx, y + 6 + cellH, coCellW, cellH, cgs.description, null, "#334155", 'center', false, false, fontSizeScale);
        });

        return y + 6 + cellH * 2;
      };

      let scaleEndY = remarksY + remarksBoxH + (isLandscape ? 4 : 6);
      if (!hideGradingScale && !gradingScaleAfterSignatures) {
        scaleEndY = drawGradingScales(scaleEndY);
      }

      // --- SIGNATORIES (ANCHORED RELATIVE TO BOTTOM) ---
      const sigLineY = doc.page.height - (isLandscape ? 50 : 75);
      const sigsToRender = (signatures && signatures.length > 0)
        ? signatures
        : [
            { id: 'parent', label: branding.signParentName || "Parent's Signature" },
            { id: 'incharge', label: branding.signInchargeName || "Class Incharge Signature" },
            { id: 'principal', label: branding.signPrincipalName || "Principal Signature" }
          ];

      const sigColW = Math.floor(tableW / sigsToRender.length);

      sigsToRender.forEach((sig: any, sIdx: number) => {
        const sx = 35 + sigColW * sIdx;
        const lineW = Math.min(isLandscape ? 85 : 110, sigColW - 15);
        const lineX = sx + (sigColW - lineW) / 2;
        
        doc.save();
        doc.moveTo(lineX, sigLineY).lineTo(lineX + lineW, sigLineY).lineWidth(0.75).strokeColor("#334155").stroke();
        doc.restore();

        doc.font("Helvetica-Bold").fontSize(isLandscape ? 6 : 7).fillColor("#334155");
        doc.text(sig.label.toUpperCase(), sx, sigLineY + (isLandscape ? 4 : 5), { width: sigColW, align: "center" });
      });

      if (!hideGradingScale && gradingScaleAfterSignatures) {
        // Draw scale right below signatures
        drawGradingScales(sigLineY + (isLandscape ? 12 : 16));
      }

      // Academic verification footer note
      const footerY = doc.page.height - (isLandscape ? 26 : 42);
      doc.font("Helvetica").fontSize(isLandscape ? 5 : 5.5).fillColor("#64748B").text("Authorized Academic Verification System  |  Secured via Super Report Multi-Tenant Guard", 35, footerY, { align: "center", width: doc.page.width - 70 });
    }

    doc.end();

  } catch (err: any) {
    console.error("Server-side PDF compile failure:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Could not generate PDF server-side: " + err.message });
    }
  }
}
