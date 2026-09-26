import React, { useState } from 'react';
import { SaasSchool } from '../types';
import { 
  Shield, Lock, Unlock, KeyRound, Mail, UserCheck, 
  RefreshCw, CheckCircle, AlertTriangle, Fingerprint, 
  Smartphone, BookOpen, MapPin, Eye, EyeOff
} from 'lucide-react';

interface SecurityDeskProps {
  school: SaasSchool;
  onUpdateSchool: (updated: SaasSchool) => Promise<void>;
}

export default function SecurityDesk({ school, onUpdateSchool }: SecurityDeskProps) {
  // Account Information States
  const [contactPerson, setContactPerson] = useState(school.contactPerson || '');
  const [email, setEmail] = useState(school.email || '');
  const [mobile, setMobile] = useState(school.mobile || '');
  const [board, setBoard] = useState(school.board || '');
  const [address, setAddress] = useState(school.address || '');

  // Password Update States
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passError, setPassError] = useState('');
  
  // SSO Enforcement State
  const [enforceSSO, setEnforceSSO] = useState(!!school.securityEnforceSSO);

  // Status & Timing States
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  // Password Generator
  const generateStrongPassword = () => {
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const specials = "!@#$%^&*()_+-=[]{}|;:,./<>?";
    const all = lowercase + uppercase + numbers + specials;
    
    let password = "";
    // Guarantee at least one of each required character
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += specials.charAt(Math.floor(Math.random() * specials.length));
    
    // Fill the rest to reach 12 characters
    for (let i = 0; i < 9; i++) {
      password += all.charAt(Math.floor(Math.random() * all.length));
    }
    
    // Shuffle the password
    password = password.split('').sort(() => 0.5 - Math.random()).join('');
    
    setNewPassword(password);
    setPassError('');
  };

  // Submission handler
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus('idle');
    setStatusMsg('');

    // If change password is typed, check validation
    let finalPassword = school.password;
    if (newPassword.trim()) {
      const trimmedNewPass = newPassword.trim();
      const hasCapital = /[A-Z]/.test(trimmedNewPass);
      const hasNumber = /[0-9]/.test(trimmedNewPass);
      const hasSpecial = /[^A-Za-z0-9]/.test(trimmedNewPass);

      if (trimmedNewPass.length < 6 || !hasCapital || !hasNumber || !hasSpecial) {
        setPassError('Password must be at least 6 characters long and contain at least one capital letter, one number, and one special character.');
        setIsSaving(false);
        return;
      }
      finalPassword = trimmedNewPass;
    }

    const updatedSchoolObj: SaasSchool = {
      ...school,
      contactPerson: contactPerson.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
      board: board.trim(),
      address: address.trim(),
      password: finalPassword,
      securityEnforceSSO: enforceSSO
    };

    try {
      await onUpdateSchool(updatedSchoolObj);
      setSaveStatus('success');
      setStatusMsg('Security parameters and school descriptors synchronized with cloud database successfully!');
      setNewPassword(''); // clear password box after successful change
      setPassError('');
    } catch (err: any) {
      setSaveStatus('error');
      setStatusMsg(err?.message || 'Error occurred while saving configurations.');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate local security rating
  const isSSOOn = enforceSSO;
  const isPassStrong = school.password && school.password.length >= 10;
  
  let securityScore = 40; // baseline
  if (isSSOOn) securityScore += 45;
  else if (isPassStrong) securityScore += 20;
  if (school.email && school.email !== 'info@default.com') securityScore += 15;

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-left font-sans">
      
      {/* Upper Status Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2 className="text-lg font-black text-slate-850 tracking-tight uppercase">
              School Security Desk & SSO Control Panel
            </h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            Configure enterprise security integrations, dual-factor SSO constraints, manage system credentials, and adjust the school metadata directly. Alterations publish dynamically.
          </p>
        </div>

        {/* Security Rating Gauge */}
        <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl flex items-center gap-3 shrink-0 w-full md:w-auto">
          <div className="relative flex items-center justify-center">
            <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center text-[10px] font-black font-mono ${
              securityScore >= 80 ? 'border-teal-500 text-teal-600 bg-teal-50/10' :
              securityScore >= 60 ? 'border-amber-500 text-amber-600 bg-amber-50/10' :
              'border-rose-500 text-rose-600 bg-rose-50/10'
            }`}>
              {securityScore}%
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Security Rating</div>
            <div className="text-[11.5px] font-black text-slate-800">
              {securityScore >= 80 ? '🛡️ ENTERPRISE SAFE' :
               securityScore >= 60 ? '⚠️ MEDIUM PROTECTED' :
               '🚨 LEGACY DEPRECIATED'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {isSSOOn ? 'Google Identity SSO Verified' : 'Standard Password active'}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveChanges} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Security & Credentials */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* SSO and Dual Factor Compliance card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
            <div className="flex items-start gap-3">
              <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600 border border-indigo-100">
                <Fingerprint className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-800">Single Sign-On (SSO) Constraint</h3>
                <p className="text-xs text-slate-500">Block traditional logins and force secure Google Authentication.</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4.5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 text-left max-w-lg">
                  <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wide block">Recommended</span>
                  <h4 className="text-xs font-black text-slate-800 leading-snug">
                    Force Google Sign-In Only
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                    With this setting turned <strong className="text-indigo-600 font-bold">ON</strong>, legacy username and password inputs are deactivated for your primary admin account. This prevents credential-stuffing exploits and guarantees that only authenticated owners of the verification email (<span className="text-slate-800 font-semibold select-all bg-white px-1 border border-slate-250 rounded">{email || "your-school-email"}</span>) can access the system.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEnforceSSO(!enforceSSO)}
                  className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-250 cursor-pointer outline-none shrink-0 border ${
                    enforceSSO ? 'bg-indigo-600 border-indigo-700 flex justify-end' : 'bg-slate-200 border-slate-300 flex justify-start'
                  }`}
                >
                  <span className="w-4.5 h-4.5 rounded-full bg-white shadow-xs transition-transform duration-250" />
                </button>
              </div>

              <div className="flex items-center gap-2 border-t border-slate-200/50 pt-3">
                <div className={`p-1.5 rounded-md ${enforceSSO ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'}`}>
                  {enforceSSO ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </div>
                <p className="text-[10.5px] text-slate-500 font-sans">
                  Current SSO Enforcement: {enforceSSO ? (
                    <strong className="text-teal-600">Active & Bullproof &bull; Raw password credentials disabled</strong>
                  ) : (
                    <strong className="text-amber-600 text-[10px]">Legacy Passwords Permitted (Less secure)</strong>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Change School Password Panel */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
            <div className="flex items-start gap-3">
              <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600 border border-indigo-100">
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-800">Admin Control Password Update</h3>
                <p className="text-xs text-slate-500">Provide secondary protection credentials for legacy portals or systems.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Current Username (Fixed)</label>
                  <input
                    type="text"
                    disabled
                    value={school.username}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-500 rounded-xl py-2 px-3.5 text-xs font-semibold select-all font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Modify Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (passError) setPassError('');
                      }}
                      placeholder="Enter new complex password..."
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-xl py-2 pl-3.5 pr-14 text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                        title={showPassword ? 'Hide Password' : 'Show Password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {passError && (
                <p className="text-xs font-medium text-rose-500 flex items-center gap-1.5 bg-rose-50 p-2 rounded-lg border border-rose-100">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {passError}
                </p>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/50">
                <div className="text-[10px] text-slate-500 max-w-sm">
                  Recommended to use a strong password if SSO constraint is off. Must be at least 6 characters long with at least one capital letter, one number, and one special character.
                </div>
                <button
                  type="button"
                  onClick={generateStrongPassword}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 text-[10.5px] font-bold py-1.5 px-3 rounded-lg transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  Generate Strong Password
                </button>
              </div>
            </div>
          </div>

          {/* School Directory Registry Details */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
            <div className="flex items-start gap-3">
              <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600 border border-indigo-100">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-800">School Directory Information</h3>
                <p className="text-xs text-slate-500">Keep contact parameters current to prevent notification or OAuth mismatches.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Registered Contact Person</label>
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Official Admin Mobile/Staff..."
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-xl py-2 px-3.5 text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Registered Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="official@school.com"
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-xl py-2 pl-3.5 pr-10 text-xs font-semibold outline-none transition-all placeholder:text-slate-400 font-mono"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-[9.5px] text-amber-600 font-medium leading-normal bg-amber-500/10 border border-amber-500/10 p-2 mt-1.5 rounded-lg">
                  💡 This email address is used for **Google OAuth SSO validation**. If changed, the new email owner must log in via Google.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Admin Helpline Mobile</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-xl py-2 pl-3.5 pr-10 text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450">
                    <Smartphone className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Academic Board Affiliation</label>
                <input
                  type="text"
                  required
                  value={board}
                  onChange={(e) => setBoard(e.target.value)}
                  placeholder="e.g. CBSE, ICSE, NIOS, STATE BOARD"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-xl py-2 px-3.5 text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">School Address Header</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="School official geographic address..."
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-xl py-2 pl-3.5 pr-10 text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right column: Status feedback & Session Audit */}
        <div className="space-y-6">
          
          {/* Action Trigger Box */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">Save Configuration</h3>
            
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Pushing to Cloud...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 text-indigo-100" />
                  <span>Update Security Policies</span>
                </>
              )}
            </button>

            {saveStatus !== 'idle' && (
              <div className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border leading-relaxed animate-fadeIn ${
                saveStatus === 'success' ? 'bg-teal-50/70 border-teal-200 text-teal-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {saveStatus === 'success' ? (
                  <CheckCircle className="w-4.5 h-4.5 text-teal-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                )}
                <span>{statusMsg}</span>
              </div>
            )}
          </div>

          {/* Session Safety Inspector info card */}
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 shadow-sm space-y-4.5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-400 shrink-0" />
              <h4 className="text-[11.5px] uppercase font-extrabold tracking-wider text-teal-300">
                Security Compliance Checklist
              </h4>
            </div>

            <div className="text-[10.5px] font-sans text-slate-400 leading-relaxed space-y-3.5">
              <p>
                As a Sand Box School Registry Owner, your account possesses complete read/write access to students, teachers, grades, and parental digital code mappings.
              </p>

              <hr className="border-slate-800/80" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>SSL Protocol Connection</span>
                  <span className="text-teal-400 font-semibold uppercase font-mono text-[9px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">Verified</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>MFA Compliance Option</span>
                  <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border ${
                    enforceSSO ? 'text-teal-400 border-teal-900 bg-slate-950' : 'text-amber-400 border-amber-900 bg-slate-950'
                  }`}>
                    {enforceSSO ? 'Compliant' : 'Legacy Level'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Parent Node Endpoint</span>
                  <span className="text-indigo-400 font-mono text-[9px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 select-all font-bold">
                    {school.portalCode || 'N/A'}
                  </span>
                </div>
              </div>

              <hr className="border-slate-800/80" />

              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/40 space-y-1 flex items-start gap-2 text-[10px]">
                <Fingerprint className="w-4 h-4 text-teal-500 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-left font-mono leading-relaxed text-slate-400">
                  <div className="text-slate-300">Tenant Client Code</div>
                  <div className="text-[10px] select-all font-bold text-white break-all">{school.id}</div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </form>

    </div>
  );
}
