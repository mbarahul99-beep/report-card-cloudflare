import React from 'react';
import { Shield, Lock, FileText, CheckCircle2, X } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fadeIn">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-teal-950 px-5 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="bg-teal-500/15 p-1.5 rounded-lg border border-teal-500/20 text-teal-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider font-sans">K-12 Student Privacy Directive</h3>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight leading-none">Enterprise Compliance & Sandbox Security</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body (scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-700 text-xs leading-relaxed font-sans scrollbar-thin">
          
          <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-indigo-700 font-bold">
              <Lock className="w-4 h-4" />
              <span className="text-[11px] uppercase tracking-wide">Strict Database Sandboxing</span>
            </div>
            <p className="text-slate-600 leading-normal text-[11px]">
              Every school on the School Report Card platform is allocated a cryptographically and logically isolated database partition. All data reads, writes, and updates are strictly sandboxed under the school's unique, system-generated path (<code>/schools/{"{schoolId}"}/...</code>). Cross-tenant database queries or unauthorized cross-school lookups are prevented by physical network segregation and robust Firestore security policies.
            </p>
          </div>

          {/* FERPA Section */}
          <div className="space-y-1.5">
            <h4 className="font-extrabold text-slate-900 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              1. FERPA Compliance (K-12 Educational Records)
            </h4>
            <p className="text-slate-600 text-[11px]">
              Under the Family Educational Rights and Privacy Act (FERPA), schools are required to secure students' personally identifiable information (PII). School Report Card complies with FERPA mandates by:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-1 pt-1">
              <li className="flex items-start gap-2 bg-slate-50/50 p-2 border border-slate-100 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-650 shrink-0 mt-0.5" />
                <span className="text-[10px] text-slate-600">Restricting grades and bio-data access to authorized classroom teachers and school administrators only.</span>
              </li>
              <li className="flex items-start gap-2 bg-slate-50/50 p-2 border border-slate-100 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-650 shrink-0 mt-0.5" />
                <span className="text-[10px] text-slate-600">Prohibiting public indexing, commercial use, tracking, or sharing of any grade card sheets or attendance registries.</span>
              </li>
            </ul>
          </div>

          {/* COPPA Section */}
          <div className="space-y-1.5">
            <h4 className="font-extrabold text-slate-900 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              2. COPPA Compliance (Under-13 Child Safety)
            </h4>
            <p className="text-slate-600 text-[11px]">
              Consistent with the Children's Online Privacy Protection Act (COPPA), we do not solicit, track, or collect personal information directly from students under the age of 13.
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-1 pt-1">
              <li className="flex items-start gap-2 bg-slate-50/50 p-2 border border-slate-100 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-650 shrink-0 mt-0.5" />
                <span className="text-[10px] text-slate-600">School rosters are provisioned solely by school administrators who maintain verifiable parental consent.</span>
              </li>
              <li className="flex items-start gap-2 bg-slate-50/50 p-2 border border-slate-100 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-650 shrink-0 mt-0.5" />
                <span className="text-[10px] text-slate-600">No student profiles or marks can be accessed by anonymous web crawlers, search bots, or third-party advertisers.</span>
              </li>
            </ul>
          </div>

          {/* GDPR Section */}
          <div className="space-y-1.5">
            <h4 className="font-extrabold text-slate-900 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              3. GDPR & Data Sovereignty
            </h4>
            <p className="text-slate-600 text-[11px]">
              For global schools operating under GDPR, we support the Right to Be Forgotten and full student data erasure:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-1 pt-1">
              <li className="flex items-start gap-2 bg-slate-50/50 p-2 border border-slate-100 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-650 shrink-0 mt-0.5" />
                <span className="text-[10px] text-slate-600">Admins can permanently purge students or whole classes into the secure Recycle Bin and permanently empty them.</span>
              </li>
              <li className="flex items-start gap-2 bg-slate-50/50 p-2 border border-slate-100 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-650 shrink-0 mt-0.5" />
                <span className="text-[10px] text-slate-600">SSL data transport encryption (HTTPS) is enforced end-to-end to protect communication channels.</span>
              </li>
            </ul>
          </div>

          {/* Security Standards */}
          <div className="space-y-2 bg-slate-950 text-slate-300 rounded-xl p-4 font-mono text-[10px]">
            <p className="font-extrabold text-teal-400 uppercase tracking-wider text-[11px] font-sans">🛡️ Active Cloud Security Guards</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
              <div>• SSL Transit Protocol: <span className="text-white">TLS 1.3 Strict</span></div>
              <div>• Tenant Isolation: <span className="text-white">Active (Firestore Sandboxing)</span></div>
              <div>• Google SSO Integration: <span className="text-white">Supported (Passwordless OAuth2)</span></div>
              <div>• Database Audits: <span className="text-white">Platform Admin Monitored</span></div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-150 px-5 py-3 text-right shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wider px-4 py-2 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            I Acknowledge Security Protocol
          </button>
        </div>

      </div>
    </div>
  );
}
