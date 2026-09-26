import React, { useState, useEffect } from "react";
import { 
  CreditCard, ShieldCheck, CheckCircle2, AlertTriangle, Users, 
  HelpCircle, Calendar, Sparkles, Receipt, RefreshCw, Check, X,
  ArrowRight, ArrowLeft, School, GraduationCap, CheckCircle
} from "lucide-react";
import { SaasSchool, PricingTier } from "../types";
import { DEFAULT_PRICING_TIERS, loadGlobalSettings, GlobalSettings } from "../lib/firebaseSync";

export function getPrefilledPaymentLink(baseLink: string, school: SaasSchool, studentCount: number, amount: number) {
  const separator = baseLink.includes('?') ? '&' : '?';
  const params: string[] = [];

  // Pass standard tracking parameters
  params.push(`school_id=${encodeURIComponent(school.id)}`);
  params.push(`schoolId=${encodeURIComponent(school.id)}`);
  params.push(`students=${studentCount}`);
  params.push(`amount=${amount}`);

  // Prefill Standard Razorpay fields
  const email = school.email || "";
  const phone = school.mobile || "";
  const contactName = school.contactPerson || school.name || "";

  if (email) {
    params.push(`${encodeURIComponent("prefill[email]")}=${encodeURIComponent(email)}`);
    params.push(`prefill[email]=${encodeURIComponent(email)}`);
    params.push(`email=${encodeURIComponent(email)}`);
  }
  if (phone) {
    params.push(`${encodeURIComponent("prefill[contact]")}=${encodeURIComponent(phone)}`);
    params.push(`prefill[contact]=${encodeURIComponent(phone)}`);
    params.push(`contact=${encodeURIComponent(phone)}`);
    params.push(`phone=${encodeURIComponent(phone)}`);
  }
  if (contactName) {
    params.push(`${encodeURIComponent("prefill[name]")}=${encodeURIComponent(contactName)}`);
    params.push(`prefill[name]=${encodeURIComponent(contactName)}`);
    params.push(`name=${encodeURIComponent(contactName)}`);
  }

  // Prefill Razorpay custom fields (matching labels in screenshot exactly)
  const schoolName = school.name || "";
  const schoolId = school.id || "";

  // 1. Prefill prefixed (Standard Razorpay Page syntax - Fully Encoded Brackets)
  params.push(`${encodeURIComponent("prefill[School Name]")}=${encodeURIComponent(schoolName)}`);
  params.push(`${encodeURIComponent("prefill[School ID]")}=${encodeURIComponent(schoolId)}`);
  params.push(`${encodeURIComponent("prefill[Number of Students]")}=${studentCount}`);
  params.push(`${encodeURIComponent("prefill[Amount]")}=${amount}`);

  // 2. Prefill prefixed (Standard Razorpay Page syntax - Raw Brackets for older parsers)
  params.push(`prefill[${encodeURIComponent("School Name")}]=${encodeURIComponent(schoolName)}`);
  params.push(`prefill[${encodeURIComponent("School ID")}]=${encodeURIComponent(schoolId)}`);
  params.push(`prefill[${encodeURIComponent("Number of Students")}]=${studentCount}`);
  params.push(`prefill[${encodeURIComponent("Amount")}]=${amount}`);

  // 3. Prefill direct keys (Alternative parser syntax without prefill prefix)
  params.push(`${encodeURIComponent("School Name")}=${encodeURIComponent(schoolName)}`);
  params.push(`${encodeURIComponent("School ID")}=${encodeURIComponent(schoolId)}`);
  params.push(`${encodeURIComponent("Number of Students")}=${studentCount}`);
  params.push(`${encodeURIComponent("Amount")}=${amount}`);

  // 4. Lowercase alternative with underscores
  params.push(`${encodeURIComponent("prefill[school_name]")}=${encodeURIComponent(schoolName)}`);
  params.push(`${encodeURIComponent("prefill[school_id]")}=${encodeURIComponent(schoolId)}`);
  params.push(`${encodeURIComponent("prefill[number_of_students]")}=${studentCount}`);
  params.push(`${encodeURIComponent("prefill[amount]")}=${amount}`);
  params.push(`prefill[school_name]=${encodeURIComponent(schoolName)}`);
  params.push(`prefill[school_id]=${encodeURIComponent(schoolId)}`);
  params.push(`prefill[number_of_students]=${studentCount}`);
  params.push(`prefill[amount]=${amount}`);

  // 5. Raw direct lowercase keys
  params.push(`school_name=${encodeURIComponent(schoolName)}`);
  params.push(`school_id=${encodeURIComponent(schoolId)}`);
  params.push(`number_of_students=${studentCount}`);

  // 6. Address & Board descriptors
  if (school.address) {
    params.push(`${encodeURIComponent("prefill[Address]")}=${encodeURIComponent(school.address)}`);
    params.push(`prefill[Address]=${encodeURIComponent(school.address)}`);
    params.push(`address=${encodeURIComponent(school.address)}`);
  }
  if (school.board) {
    params.push(`${encodeURIComponent("prefill[Board]")}=${encodeURIComponent(school.board)}`);
    params.push(`prefill[Board]=${encodeURIComponent(school.board)}`);
    params.push(`board=${encodeURIComponent(school.board)}`);
  }

  return `${baseLink}${separator}${params.join('&')}`;
}

interface SubscriptionBillingProps {
  school: SaasSchool;
  onRefreshSchool: () => void;
  setActiveTab?: (tab: 'dashboard' | 'preview' | 'branding' | 'subjects' | 'grades' | 'students' | 'portal' | 'teachers' | 'saas_owner' | 'classwise_report' | 'sub_marks_entry' | 'security_desk' | 'results_analysis' | 'agent_dashboard' | 'gallery_templates') => void;
}

export default function SubscriptionBilling({ school, onRefreshSchool, setActiveTab }: SubscriptionBillingProps) {
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(DEFAULT_PRICING_TIERS);
  
  const [studentCountInput, setStudentCountInput] = useState<number>(() => {
    return school.maxStudentsLimit || 100;
  });

  const [wizardStep, setWizardStep] = useState<'select' | 'checkout' | 'free_activated' | 'premium_submitted'>( 'select' );
  const [lastCreatedTrackingLink, setLastCreatedTrackingLink] = useState<string>('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  const activatedRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to the activation message screen
  useEffect(() => {
    if ((wizardStep === 'free_activated' || wizardStep === 'premium_submitted') && activatedRef.current) {
      activatedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [wizardStep]);

  // Load configured pricing tiers (school-specific or global settings)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await loadGlobalSettings();
        setGlobalSettings(settings);
        if (school.pricingTiers && school.pricingTiers.length > 0) {
          setPricingTiers(school.pricingTiers);
        } else if (settings.pricingTiers && settings.pricingTiers.length > 0) {
          setPricingTiers(settings.pricingTiers);
        } else {
          setPricingTiers(DEFAULT_PRICING_TIERS);
        }
      } catch (err) {
        console.warn("Failed to load pricing config:", err);
        setPricingTiers(school.pricingTiers || DEFAULT_PRICING_TIERS);
      }
    };
    loadSettings();
  }, [school]);

  // Dynamically calculate subscription cost based on students count input
  const calculateRateAndTotal = (countVal: number) => {
    const sorted = [...pricingTiers].sort((a, b) => a.minStudents - b.minStudents);
    const matched = sorted.find(t => countVal >= t.minStudents && countVal <= t.maxStudents);
    
    let rate = 20;
    let paymentLink = matched?.paymentLink || undefined;
    if (matched) {
      rate = matched.pricePerStudent;
    } else {
      const highestTier = sorted[sorted.length - 1];
      if (highestTier && countVal > highestTier.maxStudents) {
        rate = highestTier.pricePerStudent;
        paymentLink = highestTier.paymentLink;
      } else if (sorted[0]) {
        rate = sorted[0].pricePerStudent;
        paymentLink = sorted[0].paymentLink;
      }
    }
    return {
      rate,
      total: countVal * rate,
      matchedRange: matched ? `${matched.minStudents} to ${matched.maxStudents} students` : `${countVal} students scale`,
      paymentLink
    };
  };

  const { rate: calculatedRate, total: calculatedTotal, matchedRange } = calculateRateAndTotal(studentCountInput);

  const relaunchTrackingLink = (() => {
    const reqCount = school.subscriptionRequest?.studentCount || studentCountInput;
    const { paymentLink: tierPaymentLink, total } = calculateRateAndTotal(reqCount);
    const paymentLink = tierPaymentLink || globalSettings?.presetPaymentLink || "https://rzp.io/rzp/ja1SBVeJ";
    return getPrefilledPaymentLink(paymentLink, school, reqCount, total);
  })();

  // Activate / Choose Free Plan
  const handleActivateFreePlan = async () => {
    try {
      setIsSubmittingRequest(true);
      const schoolRef = doc(db, 'schools', school.id);
      
      // Free plan has limits: 50 students, 1 teacher, and clears any pending upgrade requests
      await updateDoc(schoolRef, {
        partnershipType: 'trial' as const,
        maxStudentsLimit: 50,
        maxTeachersLimit: 1,
        maxCumulativeStudentsLimit: 100,
        subscriptionRequest: null,
        updatedAt: new Date().toISOString()
      });

      setLocalFeedback("🎉 Free Plan (50 students, 1 teacher limit) successfully activated!");
      setWizardStep('free_activated');
      setTimeout(() => setLocalFeedback(null), 5000);
      onRefreshSchool();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to activate Free Plan: ${err.message}`);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Submit Premium Upgrade and Redirect to Payment Link
  const handleProceedPayment = async () => {
    if (studentCountInput <= 0) {
      alert("Please enter a valid number of students to proceed.");
      return;
    }

    try {
      setIsSubmittingRequest(true);
      const schoolRef = doc(db, 'schools', school.id);
      
      const reqData = {
        studentCount: studentCountInput,
        calculatedTotal: calculatedTotal,
        status: 'pending' as const,
        paymentStatus: 'pending' as const,
        verificationMessage: "The payment status is being verified and will be updated within 24 hours. Till then, the school admin will continue to use the free plan.",
        requestedAt: new Date().toISOString()
      };
      
      // Update school document in Firestore with pending request
      await updateDoc(schoolRef, {
        subscriptionRequest: reqData,
        updatedAt: new Date().toISOString()
      });

      // Send a targeted notification to the cloud
      const notifId = `notif_upgr_req_${Date.now()}`;
      const notifRef = doc(db, 'notifications', notifId);
      await setDoc(notifRef, {
        id: notifId,
        title: "⏳ Subscription Payment Verification Pending",
        message: `Your upgrade request for "${school.name}" to the Premium Plan with ${studentCountInput} student licenses (₹${calculatedTotal.toLocaleString()}/year) was submitted. Our admins are verifying the payment status and will activate your profile within 24 hours.`,
        type: 'info',
        sentAt: new Date().toISOString(),
        targetSchoolIds: [school.id],
        readBy: []
      });

      // Open Configured Preset Payment Link in new tab
      const { paymentLink: tierPaymentLink } = calculateRateAndTotal(studentCountInput);
      const paymentLink = tierPaymentLink || globalSettings?.presetPaymentLink || "https://rzp.io/rzp/ja1SBVeJ";
      
      const trackingLink = getPrefilledPaymentLink(paymentLink, school, studentCountInput, calculatedTotal);
      setLastCreatedTrackingLink(trackingLink);
      
      try {
        window.open(trackingLink, "_blank");
      } catch (popErr) {
        console.warn("Popup blocked or aborted by browser/user:", popErr);
      }

      setWizardStep('premium_submitted');
      onRefreshSchool();
    } catch (err: any) {
      console.error(err);
      alert(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleCancelUpgradeRequest = async () => {
    if (!window.confirm("Are you sure you want to cancel your pending subscription upgrade request?")) {
      return;
    }
    
    try {
      setIsSubmittingRequest(true);
      const schoolRef = doc(db, 'schools', school.id);
      await updateDoc(schoolRef, {
        subscriptionRequest: null,
        updatedAt: new Date().toISOString()
      });
      
      alert("Upgrade request cancelled successfully.");
      onRefreshSchool();
    } catch (err: any) {
      console.error(err);
      alert(`Cancellation failed: ${err.message}`);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const isAnnual = school.partnershipType === "annual";
  const trialExpired = school.trialUntil ? new Date(school.trialUntil).getTime() < Date.now() : false;
  const isPendingVerification = !!school.subscriptionRequest && school.subscriptionRequest.status !== 'approved';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Active Subscription Summary Banner */}
      <div className={`relative overflow-hidden rounded-3xl border p-6 text-left transition-all ${
        isAnnual 
          ? "bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30 shadow-xs" 
          : "bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-500/20 shadow-xs"
      }`}>
        <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase shadow-3xs ${
              isAnnual 
                ? "bg-emerald-600 text-white" 
                : "bg-indigo-600 text-white"
            }`}>
              {isAnnual ? "👑 Active Plan: Premium Annual" : "⚡ Active Plan: Free Plan"}
            </span>

            <h3 className="text-lg sm:text-xl font-black text-slate-800 font-sans tracking-tight">
              {school.name} Subscription Center
            </h3>

            <div className="flex flex-wrap gap-2 text-[10px] font-mono mt-1">
              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                School ID: <strong className="text-slate-900 select-all font-black">{school.id}</strong>
              </span>
              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                Portal Code: <strong className="text-indigo-700 select-all font-black">{school.portalCode || "N/A"}</strong>
              </span>
              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                Login ID: <strong className="text-slate-900 select-all font-black">{school.username}</strong>
              </span>
            </div>

            <p className="text-xs text-slate-600 max-w-xl font-medium leading-relaxed">
              {isAnnual 
                ? `Thank you for your premium partnership! Your Premium Annual Subscription is active with unlimited school-wide record capabilities (licensed up to ${school.maxStudentsLimit} students).`
                : `Your school is currently registered on the Free Plan. Under the Free Plan, you can register a maximum of 50 students and 1 teacher profile. Upgrade to Premium for larger schools and custom settings.`
              }
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0 bg-white/95 backdrop-blur-xs p-4 rounded-2xl border border-slate-200/80 min-w-[220px] shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>Subscription Status</span>
            </div>
            <span className="text-sm font-black text-slate-800 font-mono">
              {isAnnual 
                ? (school.trialUntil 
                    ? `👑 Expires: ${new Date(school.trialUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}` 
                    : "👑 Premium Active") 
                : "🎁 Permanent Free Plan"}
            </span>
            <span className="text-[10px] font-bold text-slate-500 mt-0.5">
              {isAnnual ? `Licensed for ${school.maxStudentsLimit} students` : "50 Students & 1 Teacher Limit"}
            </span>
          </div>
        </div>

        {/* Current Student Quota Details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-200/50">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Registered Students</span>
            <span className="text-base font-extrabold text-slate-800 font-mono">{school.activeStudentsCount || 0} students</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Quota Student Limit</span>
            <span className="text-base font-extrabold text-slate-800 font-mono">
              {school.maxStudentsLimit ? `${school.maxStudentsLimit} profiles` : "50 profiles (Free)"}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Teacher Profile Limit</span>
            <span className="text-base font-extrabold text-indigo-600 font-mono">
              {school.maxTeachersLimit !== undefined 
                ? `${school.maxTeachersLimit} profiles` 
                : (school.partnershipType === 'annual' ? "1000 profiles" : "1 profile (Free)")}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
              {school.partnershipType === 'annual' ? 'Partnership Fee' : 'Post-Trial Rate'}
            </span>
            <span className="text-base font-extrabold text-emerald-600 font-mono">
              {school.partnershipType === 'annual'
                ? (school.annualPrice ? `₹${school.annualPrice.toLocaleString()}/year` : (school.trialPrice || 'N/A'))
                : (school.trialPrice || 'N/A')
              }
            </span>
          </div>
        </div>
      </div>

      {localFeedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-850 p-4 rounded-xl text-xs font-bold text-left flex items-center gap-2 animate-slideDown shadow-3xs">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>{localFeedback}</span>
        </div>
      )}

      {/* Verification Pending Message */}
      {isPendingVerification ? (
        <div className={`border rounded-3xl p-6 text-left space-y-4 shadow-sm ${
          school.subscriptionRequest?.paymentStatus === 'failed' 
            ? "bg-rose-50/50 border-rose-250" 
            : school.subscriptionRequest?.paymentStatus === 'success'
            ? "bg-emerald-50/50 border-emerald-250"
            : "bg-amber-50/50 border-amber-250"
        }`}>
          <div className="flex gap-3.5 items-start">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-3xs border ${
              school.subscriptionRequest?.paymentStatus === 'failed'
                ? "bg-rose-500/10 border-rose-500/20 text-rose-600"
                : school.subscriptionRequest?.paymentStatus === 'success'
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                : "bg-amber-500/10 border-amber-500/20 text-amber-600"
            }`}>
              {school.subscriptionRequest?.paymentStatus === 'failed' ? (
                <X className="w-5 h-5" />
              ) : school.subscriptionRequest?.paymentStatus === 'success' ? (
                <Check className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div className="space-y-1.5 flex-1">
              <h4 className={`text-sm font-black uppercase tracking-wider font-mono ${
                school.subscriptionRequest?.paymentStatus === 'failed'
                  ? "text-rose-850"
                  : school.subscriptionRequest?.paymentStatus === 'success'
                  ? "text-emerald-850"
                  : "text-amber-850"
              }`}>
                {school.subscriptionRequest?.paymentStatus === 'failed'
                  ? "❌ Payment Verification Failed"
                  : school.subscriptionRequest?.paymentStatus === 'success'
                  ? "✅ Payment Verified / Success"
                  : "⏳ Payment Status Under Verification"
                }
              </h4>
              <p className={`text-xs leading-relaxed font-sans font-medium ${
                school.subscriptionRequest?.paymentStatus === 'failed'
                  ? "text-rose-700"
                  : school.subscriptionRequest?.paymentStatus === 'success'
                  ? "text-emerald-700"
                  : "text-amber-700"
              }`}>
                Your request to upgrade to the Premium Plan with <strong>{school.subscriptionRequest?.studentCount} student licenses</strong> (₹{school.subscriptionRequest?.calculatedTotal?.toLocaleString()}/year) was submitted.
              </p>
              <div className={`p-3 border rounded-xl inline-block mt-1 w-full bg-white/75 ${
                school.subscriptionRequest?.paymentStatus === 'failed'
                  ? "border-rose-200/50"
                  : school.subscriptionRequest?.paymentStatus === 'success'
                  ? "border-emerald-200/50"
                  : "border-amber-200/50"
              }`}>
                <span className={`text-[11px] font-extrabold block ${
                  school.subscriptionRequest?.paymentStatus === 'failed'
                    ? "text-rose-800"
                    : school.subscriptionRequest?.paymentStatus === 'success'
                    ? "text-emerald-800"
                    : "text-amber-800"
                }`}>
                  🔔 Verification Status Message:
                </span>
                <span className={`text-[11.5px] font-bold block mt-0.5 ${
                  school.subscriptionRequest?.paymentStatus === 'failed'
                    ? "text-rose-750 font-mono"
                    : school.subscriptionRequest?.paymentStatus === 'success'
                    ? "text-emerald-750 font-mono"
                    : "text-amber-750 font-mono"
                }`}>
                  "{school.subscriptionRequest?.verificationMessage || "The payment status is being verified and will be updated within 24 hours. Till then, the school admin will continue to use the free plan."}"
                </span>
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-200/40 flex flex-col sm:flex-row gap-3">
            <a
              href={relaunchTrackingLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 font-extrabold text-xs uppercase py-2.5 px-4 rounded-xl transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-1.5 border text-center ${
                school.subscriptionRequest?.paymentStatus === 'failed'
                  ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-600"
                  : school.subscriptionRequest?.paymentStatus === 'success'
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
                  : "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
              }`}
            >
              <span>Launch Payment Portal Again</span>
            </a>
            <button
              onClick={handleCancelUpgradeRequest}
              disabled={isSubmittingRequest}
              className={`flex-1 font-black text-xs uppercase py-2.5 px-4 rounded-xl transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-1.5 border bg-white ${
                school.subscriptionRequest?.paymentStatus === 'failed'
                  ? "text-rose-800 hover:bg-rose-50 border-rose-200"
                  : school.subscriptionRequest?.paymentStatus === 'success'
                  ? "text-emerald-800 hover:bg-emerald-50 border-emerald-250"
                  : "text-amber-800 hover:bg-amber-50 border-amber-200"
              }`}
            >
              {isSubmittingRequest ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>Cancel Request &amp; Start Over</span>
              )}
            </button>
          </div>
        </div>
      ) : isAnnual ? (
        // Premium User: No further upgrade wizard necessary
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/5">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-base font-black text-slate-800">👑 Full Premium Access Activated</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Your subscription is fully verified and active. You have complete platform administration, unlimited layouts, custom report generation, and parent sync.
            </p>
          </div>
        </div>
      ) : (
        // Upgrade Wizard Steps
        <div className="transition-all">
          {wizardStep === 'select' ? (
            <div className="space-y-6">
              <div className="text-left">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Choose Partnership Plan</h4>
                <p className="text-[11px] text-slate-500">Configure your report card system with Free or Premium features</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                {/* Free Plan Card */}
                <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 text-left flex flex-col justify-between space-y-6 shadow-3xs hover:border-slate-300 transition-all relative">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <span className="bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full">
                        🎁 Basic Plan
                      </span>
                      <span className="text-sm font-bold text-slate-400">Always Free</span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-base sm:text-lg font-black text-slate-800 font-sans tracking-tight">Free Starter Plan</h4>
                      <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">₹0 <span className="text-xs font-medium text-slate-500 font-sans">/ forever</span></p>
                    </div>

                    <div className="h-px bg-slate-100" />

                    <ul className="space-y-2 text-xs font-bold text-slate-650">
                      <li className="flex items-center gap-2 text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Max 50 Student Records</span>
                      </li>
                      <li className="flex items-center gap-2 text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Max 1 Teacher Profile</span>
                      </li>
                      <li className="flex items-center gap-2 text-slate-400 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-slate-200 shrink-0" />
                        <span>Standard School Branding Only</span>
                      </li>
                      <li className="flex items-center gap-2 text-slate-400 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-slate-200 shrink-0" />
                        <span>Basic Layout Printouts</span>
                      </li>
                    </ul>
                  </div>

                  {school.partnershipType === 'trial' ? (
                    <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-center py-3.5 px-4 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-3xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[3]" />
                      <span>Free Starter Active</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleActivateFreePlan}
                      disabled={isSubmittingRequest}
                      className="w-full bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 text-slate-800 font-extrabold text-xs uppercase py-3 px-4 rounded-xl transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-1.5 border border-slate-300"
                    >
                      {isSubmittingRequest ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Activate Free Plan</span>
                      )}
                    </button>
                  )}
                </div>

                {/* Premium Plan Card */}
                <div className="bg-gradient-to-br from-indigo-500/5 via-white to-indigo-500/10 border-2 border-indigo-500/60 rounded-3xl p-6 text-left flex flex-col justify-between space-y-6 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <span className="bg-indigo-600 text-white text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full shadow-3xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-yellow-200" />
                        <span>Recommended</span>
                      </span>
                      <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">Premium Plan</span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-base sm:text-lg font-black text-slate-800 font-sans tracking-tight">Annual Premium Suite</h4>
                      <p className="text-xl sm:text-2xl font-black text-indigo-700 font-mono">₹ Dynamic <span className="text-xs font-medium text-slate-500 font-sans">/ student / year</span></p>
                    </div>

                    <div className="h-px bg-indigo-100" />

                    <ul className="space-y-2 text-xs font-bold text-slate-650">
                      <li className="flex items-center gap-2 text-indigo-950">
                        <CheckCircle2 className="w-4 h-4 text-indigo-650 shrink-0" />
                        <span>Unlimited Student Quotas (Customizable)</span>
                      </li>
                      <li className="flex items-center gap-2 text-indigo-950">
                        <CheckCircle2 className="w-4 h-4 text-indigo-650 shrink-0" />
                        <span>Unlimited Teacher Accounts</span>
                      </li>
                      <li className="flex items-center gap-2 text-indigo-950">
                        <CheckCircle2 className="w-4 h-4 text-indigo-650 shrink-0" />
                        <span>Full Custom School Branding &amp; Watermarks</span>
                      </li>
                      <li className="flex items-center gap-2 text-indigo-950">
                        <CheckCircle2 className="w-4 h-4 text-indigo-650 shrink-0" />
                        <span>Premium Multi-Layout Report Card Builder</span>
                      </li>
                      <li className="flex items-center gap-2 text-indigo-950">
                        <CheckCircle2 className="w-4 h-4 text-indigo-650 shrink-0" />
                        <span>1.5x Student Strength Buffer Protection</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-indigo-950 uppercase tracking-wide flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-indigo-650" />
                        <span>Total Students in School:</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={studentCountInput}
                        onChange={(e) => setStudentCountInput(Math.max(1, parseInt(e.target.value, 10) || 0))}
                        className="w-full bg-white border-2 border-indigo-200 focus:border-indigo-500 focus:outline-none rounded-xl py-2 px-3 font-extrabold font-mono text-sm transition-all"
                        placeholder="Enter student count"
                      />
                    </div>

                    <button
                      onClick={() => setWizardStep('checkout')}
                      className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-650 text-white font-extrabold text-xs uppercase py-3.5 px-4 rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 border border-indigo-700 active:scale-98"
                    >
                      <span>Proceed Pay</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : wizardStep === 'free_activated' ? (
            // Free Tier Activated Message Page
            <div ref={activatedRef} className="bg-emerald-50/40 border border-emerald-200 rounded-3xl p-8 text-left space-y-6 shadow-sm animate-fadeIn">
              <div className="flex items-center gap-4 border-b border-emerald-100 pb-4">
                <div className="w-12 h-12 bg-emerald-100 border border-emerald-200 text-emerald-650 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h4 className="text-base sm:text-lg font-black text-emerald-950 leading-tight">🎉 Free Starter Plan Successfully Activated!</h4>
                  <p className="text-xs text-emerald-800 font-medium">Your educational portal is now online and ready to build lists.</p>
                </div>
              </div>

              {localFeedback && (
                <div className="bg-emerald-650 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl text-center shadow-md animate-bounce">
                  {localFeedback}
                </div>
              )}

              <div className="space-y-4">
                <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Plan Details & Active Credentials</h5>
                <div className="bg-white border border-slate-150 rounded-2xl p-4 space-y-3 font-mono text-xs">
                  <div className="grid grid-cols-2 py-1.5 border-b border-slate-100 font-sans text-slate-700">
                    <span className="font-bold">Institution Name:</span>
                    <span className="text-right text-slate-900 font-black">{school.name}</span>
                  </div>
                  <div className="grid grid-cols-2 py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-bold font-sans">School Database ID:</span>
                    <span className="text-right text-indigo-700 font-black select-all">{school.id}</span>
                  </div>
                  <div className="grid grid-cols-2 py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-bold font-sans">Portal Access ID:</span>
                    <span className="text-right text-slate-900 font-black select-all">{school.portalCode || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-2 py-1.5 border-b border-slate-100 font-sans">
                    <span className="text-slate-500 font-bold">Active Quotas:</span>
                    <span className="text-right text-slate-900 font-bold">50 Students limit &bull; 1 Teacher</span>
                  </div>
                  <div className="grid grid-cols-2 py-1.5 font-sans">
                    <span className="text-emerald-750 font-bold">Status:</span>
                    <span className="text-right text-emerald-800 font-black uppercase tracking-wider">Active Free Trial</span>
                  </div>
                </div>

                <div className="bg-amber-50/60 border border-amber-200 text-amber-950 rounded-xl p-3.5 text-xs font-medium leading-relaxed">
                  <strong className="text-amber-950 font-black block uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-650" />
                    Portal Fully Unlocked:
                  </strong>
                  You can now access the full school registry, assign teachers, construct scholastic structures, and log semester evaluations. Use the navigation sidebar to explore different administration tabs.
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {setActiveTab && (
                  <button
                    onClick={() => setActiveTab('students')}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-650 text-white font-extrabold text-xs uppercase py-3.5 px-4 rounded-xl transition-all cursor-pointer shadow-md text-center hover:scale-101 active:scale-99"
                  >
                    Go to Registry Tab
                  </button>
                )}
                <button
                  onClick={() => setWizardStep('select')}
                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs uppercase py-3.5 px-4 rounded-xl transition-all cursor-pointer shadow-3xs text-center"
                >
                  View Partnership Plans
                </button>
              </div>
            </div>
          ) : wizardStep === 'premium_submitted' ? (
            // Premium Request Registered & Assistance Page
            <div ref={activatedRef} className="bg-indigo-50/40 border border-indigo-150 rounded-3xl p-8 text-left space-y-6 shadow-sm animate-fadeIn">
              <div className="flex items-center gap-4 border-b border-indigo-100 pb-4">
                <div className="w-12 h-12 bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-full flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <h4 className="text-base sm:text-lg font-black text-indigo-950 leading-tight">⏳ Premium Activation Request Submitted!</h4>
                  <p className="text-xs text-indigo-800 font-medium">Your request is registered. Standard verification turnaround is under 24 hours.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white border border-indigo-100 rounded-2xl p-4.5 space-y-4 shadow-3xs">
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    A secure transaction payload has been initialized for <strong className="text-slate-900 font-black">{school.name}</strong> to license <strong className="text-indigo-800 font-black font-mono">{studentCountInput} students</strong>.
                  </p>

                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
                    <span className="font-extrabold block text-[10px] uppercase tracking-wider text-amber-800">
                      💡 Important Payment Processing Information
                    </span>
                    <span className="leading-relaxed block">
                      If the checkout webpage was blocked by your browser's pop-up blocker, or you accidentally closed the payment flow, please use the verified direct secure link below to proceed with activation processing:
                    </span>
                  </div>

                  {lastCreatedTrackingLink && (
                    <a
                      href={lastCreatedTrackingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase py-3.5 px-4 rounded-xl transition-all shadow-md text-center hover:scale-101 active:scale-99 flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-4 h-4 shrink-0" />
                      <span>Open Secure Payment Gateway</span>
                    </a>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3 font-mono text-xs">
                  <div className="grid grid-cols-2 py-1.5 border-b border-slate-100 font-sans text-slate-700">
                    <span className="font-bold">Institution Name:</span>
                    <span className="text-right text-slate-900 font-black">{school.name}</span>
                  </div>
                  <div className="grid grid-cols-2 py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-bold font-sans">Required Student Licenses:</span>
                    <span className="text-right text-slate-900 font-black">{studentCountInput} student profiles</span>
                  </div>
                  <div className="grid grid-cols-2 py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-bold font-sans">Payment Amount:</span>
                    <span className="text-right text-indigo-700 font-black">₹{calculatedTotal.toLocaleString()} / year</span>
                  </div>
                  <div className="grid grid-cols-2 py-1.5 font-sans">
                    <span className="text-amber-700 font-bold">Verification Status:</span>
                    <span className="text-right text-amber-800 font-black uppercase tracking-wider">Verification Pending</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => setWizardStep('select')}
                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs uppercase py-3.5 px-4 rounded-xl transition-all cursor-pointer shadow-3xs text-center"
                >
                  View Partnership Plans
                </button>
              </div>
            </div>
          ) : (
            // Checkout Summary Step
            <div className="bg-white border border-slate-200 rounded-3xl p-6 text-left space-y-6 shadow-xs animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <button
                  onClick={() => setWizardStep('select')}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-xs font-black uppercase transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Selection</span>
                </button>
                <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-3xs font-mono">
                  Step 2: Payment Activation Request
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-black text-slate-800">Checkout Premium Partnership Invoice</h4>
                  <p className="text-xs text-slate-500">Please review the details below to initialize premium access activation.</p>
                </div>

                {/* Invoice Table */}
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-2 text-xs font-bold text-slate-600 py-1.5 border-b border-slate-200/60">
                    <span>Description</span>
                    <span className="text-right">Details / Metrics</span>
                  </div>

                  <div className="grid grid-cols-2 text-xs font-bold text-slate-700 py-1 border-b border-slate-200/40">
                    <span className="font-semibold">Target School:</span>
                    <span className="text-right text-slate-900 font-extrabold">{school.name}</span>
                  </div>

                  <div className="grid grid-cols-2 text-xs font-bold text-slate-700 py-1 border-b border-slate-200/40">
                    <span className="font-semibold">School ID:</span>
                    <span className="text-right text-indigo-700 font-mono font-extrabold select-all">{school.id}</span>
                  </div>

                  <div className="grid grid-cols-2 text-xs font-bold text-slate-700 py-1 border-b border-slate-200/40">
                    <span className="font-semibold">Registered Student Profiles:</span>
                    <span className="text-right text-slate-900 font-extrabold font-mono">{studentCountInput} student licenses</span>
                  </div>



                  <div className="grid grid-cols-2 text-xs font-bold text-slate-700 py-2 pt-3 font-sans">
                    <span className="text-slate-800 font-black text-sm">Total Price due:</span>
                    <span className="text-right font-black text-indigo-700 font-mono text-lg leading-none">
                      ₹{calculatedTotal.toLocaleString()} <span className="text-[10px] font-bold text-indigo-500 font-sans">/ year</span>
                    </span>
                  </div>
                </div>

                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-1.5 text-[11px] font-medium leading-relaxed text-indigo-850">
                  <span className="font-black text-indigo-950 block uppercase tracking-wide flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-650" />
                    <span>Instant Pipeline Activation Process:</span>
                  </span>
                  <span>
                    Upon clicking <strong>Pay and activate</strong>, you will be redirected to the secure portal payment link. Simultaneously, a request is submitted automatically on the SaaS dashboard. The SaaS admin checks payment details and activates your profile. Till then, your school profile can still use the Free Plan.
                  </span>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setWizardStep('select')}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs uppercase py-3 px-4 rounded-xl transition-all cursor-pointer shadow-3xs text-center"
                >
                  Back
                </button>

                <button
                  onClick={handleProceedPayment}
                  disabled={isSubmittingRequest}
                  className="flex-2 bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-350 text-white font-extrabold text-xs uppercase py-3 px-4 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 active:scale-98"
                >
                  {isSubmittingRequest ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Pay and activate (₹{calculatedTotal.toLocaleString()})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
