import React, { useState, useEffect, useRef } from 'react';
import { SaasAgent, SaasSchool, WithdrawalRequest, ChatMessage } from '../types';
import { 
  Users, Award, Gift, Copy, Check, LogOut, Landmark, BookOpen, Clock, 
  Building2, School, Globe, HelpCircle, ArrowUpRight, Search, Eye,
  Send, MessageSquare, History, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { 
  saveWithdrawalRequest, subscribeWithdrawalRequests, 
  saveChatMessage, subscribeChatMessages, saveAgentToCloud, parsePrice,
  subscribeGlobalSettings, GlobalSettings
} from '../lib/firebaseSync';
import { renderMessageWithLinks } from '../utils/linkify';


interface AgentDashboardProps {
  agent: SaasAgent;
  schools: SaasSchool[];
  onLogout: () => void;
  onOnboardDirectly: () => void;
}

export default function AgentDashboard({ agent, schools, onLogout, onOnboardDirectly }: AgentDashboardProps) {
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolForView, setSelectedSchoolForView] = useState<SaasSchool | null>(null);

  // Global Settings for universal commission
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({ universalCommissionPercentage: 10 });

  useEffect(() => {
    const unsub = subscribeGlobalSettings((settings) => {
      setGlobalSettings(settings);
    });
    return () => unsub();
  }, []);

  // Derive referred schools
  const referredSchoolsRaw = schools.filter(school => 
    school.referredByAgentId === agent.id || 
    (school.referredByAgentCode && school.referredByAgentCode.toUpperCase() === agent.code.toUpperCase())
  );

  // Deduplicate by ID so no school is shown twice
  const referredSchools: SaasSchool[] = [];
  const seenIds = new Set<string>();
  for (const s of referredSchoolsRaw) {
    if (s && s.id && !seenIds.has(s.id)) {
      seenIds.add(s.id);
      referredSchools.push(s);
    }
  }

  const filteredReferredSchools = referredSchools.filter(school =>
    school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (school.contactPerson && school.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
    school.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const trialCount = referredSchools.filter(s => s.partnershipType !== 'annual' && s.approvalStatus !== 'rejected').length;
  const annualCount = referredSchools.filter(s => s.partnershipType === 'annual' && s.approvalStatus !== 'rejected').length;

  const commissionRate = agent.commissionPercentage !== undefined ? agent.commissionPercentage : globalSettings.universalCommissionPercentage;

  const totalCommissions = referredSchools.reduce((sum, s) => {
    if (s.partnershipType !== 'annual' || s.approvalStatus !== 'approved') return sum;
    const basePrice = s.annualPrice || 0;
    return sum + (basePrice * commissionRate / 100);
  }, 0);

  const pendingCommissions = referredSchools.reduce((sum, s) => {
    if (!s.subscriptionRequest || s.subscriptionRequest.status !== 'pending') return sum;
    const basePrice = s.subscriptionRequest.calculatedTotal || 0;
    return sum + (basePrice * commissionRate / 100);
  }, 0);

  // Dynamic share link
  const shareLink = `${window.location.origin}${window.location.pathname}?ref=${agent.code}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Withdrawals states
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
  const [paymentDetails, setPaymentDetails] = useState<string>(agent.paymentDetails || '');
  const [withdrawalRemarks, setWithdrawalRemarks] = useState<string>('');
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState<boolean>(false);
  const [withdrawalError, setWithdrawalError] = useState<string>('');
  const [payoutSuccess, setPayoutSuccess] = useState<boolean>(false);

  // Support Chat states
  const [showChat, setShowChat] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to withdrawals
  useEffect(() => {
    const unsub = subscribeWithdrawalRequests((reqs) => {
      const agentReqs = reqs.filter(r => 
        r.agentId === agent.id || 
        (r.agentCode && agent.code && r.agentCode.toUpperCase().trim() === agent.code.toUpperCase().trim())
      );
      setWithdrawals(agentReqs);
    }, agent.id);
    return () => unsub();
  }, [agent.id, agent.code]);

  // Subscribe to support chat messages
  useEffect(() => {
    const unsub = subscribeChatMessages((messages) => {
      const agentChats = messages.filter(m => 
        (m.senderId === agent.id && m.receiverId === 'admin') ||
        (m.senderId === 'admin' && m.receiverId === agent.id)
      );
      setChatMessages(agentChats);
    });
    return () => unsub();
  }, [agent.id]);

  // Auto scroll to chat bottom
  useEffect(() => {
    if (showChat) {
      setTimeout(() => {
        chatEndRef.current?.scrollTo({
          top: chatEndRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [showChat, chatMessages]);

  // Mark messages as read when agent views them
  useEffect(() => {
    if (showChat) {
      const unreadMsgs = chatMessages.filter(
        m => m.senderId === 'admin' && m.receiverId === agent.id && !m.read
      );
      unreadMsgs.forEach(async (msg) => {
        try {
          await saveChatMessage({ ...msg, read: true });
        } catch (err) {
          console.error("Failed to mark message as read:", err);
        }
      });
    }
  }, [showChat, chatMessages, agent.id]);

  const unreadCount = chatMessages.filter(m => m.receiverId === agent.id && !m.read).length;

  const approvedWithdrawalsSum = withdrawals
    .filter(w => w.status === 'approved' || w.status === 'paid' || w.status === 'processing')
    .reduce((sum, w) => sum + w.amount, 0);

  const activeWithdrawalsSum = withdrawals
    .filter(w => w.status !== 'rejected')
    .reduce((sum, w) => sum + w.amount, 0);

  const availableBalance = Math.max(0, totalCommissions - activeWithdrawalsSum);

  const activePendingRequest = withdrawals.find(w => w.status === 'pending' || w.status === 'processing');

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawalError('');

    if (activePendingRequest) {
      setWithdrawalError(`You already have a payout request of ₹${activePendingRequest.amount.toLocaleString('en-IN')} with status "${activePendingRequest.status}" currently active. Please wait for the SaaS administrator to review and complete it before requesting another payout.`);
      return;
    }

    const amt = parseFloat(withdrawalAmount);
    if (isNaN(amt) || amt <= 0) {
      setWithdrawalError('Please enter a valid amount greater than zero.');
      return;
    }
    if (amt > availableBalance) {
      setWithdrawalError(`Insufficient commission balance. Max available is ₹${availableBalance.toLocaleString('en-IN')}.`);
      return;
    }
    if (!paymentDetails.trim()) {
      setWithdrawalError('Please specify bank details or PayPal details for payout processing.');
      return;
    }

    setIsRequesting(true);
    try {
      // Automatically save payment details to agent profile if updated
      if (paymentDetails.trim() !== (agent.paymentDetails || '').trim()) {
        const updatedAgent = {
          ...agent,
          paymentDetails: paymentDetails.trim()
        };
        await saveAgentToCloud(updatedAgent);
      }

      const newRequest: WithdrawalRequest = {
        id: `wd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        agentId: agent.id,
        agentName: agent.name,
        agentCode: agent.code,
        senderId: agent.id,
        senderName: agent.name,
        senderCode: agent.code,
        amount: amt,
        paymentDetails: paymentDetails,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        remarks: withdrawalRemarks
      };
      await saveWithdrawalRequest(newRequest);
      setPayoutSuccess(true);
    } catch (err) {
      console.error("Failed to submit withdrawal request:", err);
      setWithdrawalError(`Failed to submit withdrawal request: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const typedText = chatInput.trim();
    if (!typedText) return;

    const newMsg: ChatMessage = {
      id: `chat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      senderId: agent.id,
      senderName: agent.name,
      senderRole: 'agent',
      receiverId: 'admin',
      receiverName: 'SaaS Admin',
      receiverRole: 'admin',
      message: typedText,
      sentAt: new Date().toISOString(),
      read: false
    };

    // Optimistically update input and state instantly
    setChatInput('');
    setChatMessages(prev => {
      if (prev.some(m => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });

    try {
      saveChatMessage(newMsg).catch(err => {
        console.error("Failed to save agent chat in background:", err);
      });
    } catch (err) {
      console.error("Failed to send chat message:", err);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 bg-white border-b border-gray-150 shadow-xs z-40 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-tr from-teal-600 to-emerald-500 rounded-lg text-white">
                <Gift className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight text-slate-900 font-sans block leading-none">
                  SUPER REPORT
                </span>
                <span className="text-[9.5px] uppercase tracking-widest font-black text-teal-600 mt-0.5 block leading-none">
                  Partner Portal
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-1">
                <span className="text-[10.5px] text-slate-500 font-medium">Logged in as:</span>
                <strong className="text-xs text-slate-800">{agent.name}</strong>
                <span className="inline-flex items-center px-1.5 py-0.2 bg-teal-50 border border-teal-100 rounded text-teal-800 font-mono text-[9px] font-bold ml-1">
                  {agent.code}
                </span>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-xl cursor-pointer transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">

        {/* Payment & Payout Status Alerts */}
        {(() => {
          const recentUpdates = withdrawals
            .filter(w => w.status !== 'pending')
            .slice(0, 3); // show top 3 recent updates

          if (recentUpdates.length === 0) return null;

          return (
            <div className="space-y-3 animate-fadeIn">
              <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Payout & Payout Processing Alerts
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentUpdates.map((req) => {
                  let alertBg = "bg-sky-50/50 border-sky-100 text-sky-850";
                  let badgeBg = "bg-sky-500 text-white";
                  let statusLabel = "Processing";
                  let text = `Your payout request of ₹${req.amount.toLocaleString('en-IN')} is being processed. Outbound transfer is in progress.`;
                  let icon = <Clock className="w-4 h-4 text-sky-600 animate-spin" />;

                  if (req.status === 'approved') {
                    alertBg = "bg-indigo-50/50 border-indigo-100 text-indigo-850";
                    badgeBg = "bg-indigo-600 text-white";
                    statusLabel = "Approved";
                    text = `Your payout request of ₹${req.amount.toLocaleString('en-IN')} has been approved! Payout file initiated.`;
                    icon = <CheckCircle2 className="w-4 h-4 text-indigo-600" />;
                  } else if (req.status === 'paid') {
                    alertBg = "bg-emerald-50/60 border-emerald-100 text-emerald-850";
                    badgeBg = "bg-emerald-600 text-white";
                    statusLabel = "Paid / Sent";
                    text = `Payment Sent! ₹${req.amount.toLocaleString('en-IN')} has been successfully transferred to your registered account.`;
                    icon = <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-bounce" />;
                  } else if (req.status === 'rejected') {
                    alertBg = "bg-rose-50/50 border-rose-100 text-rose-850";
                    badgeBg = "bg-rose-600 text-white";
                    statusLabel = "Declined";
                    text = `Your payout request of ₹${req.amount.toLocaleString('en-IN')} has been declined. Remarks: ${req.remarks || 'None'}`;
                    icon = <AlertCircle className="w-4 h-4 text-rose-600" />;
                  }

                  return (
                    <div key={req.id} className={`p-3.5 border rounded-2xl flex items-start gap-3 transition-all bg-white hover:shadow-xs ${alertBg}`}>
                      <div className="p-1.5 bg-white rounded-lg shadow-3xs shrink-0">
                        {icon}
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase tracking-wider ${badgeBg}`}>
                            {statusLabel}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono font-bold">
                            {req.processedAt ? new Date(req.processedAt).toLocaleDateString() : new Date(req.requestedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold leading-relaxed">
                          {text}
                        </p>
                        {req.remarks && req.status !== 'rejected' && (
                          <p className="text-[9.5px] text-slate-500 italic">
                            &ldquo;{req.remarks}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        
        {/* Profile Card & Copy Link Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Agent Info card */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-base font-black text-slate-950 font-sans">{agent.name}</h2>
                  <p className="text-[11px] text-gray-500 font-medium">{agent.email}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                  agent.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  {agent.status || 'Active'}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Referral Code</div>
                  <div className="text-sm font-mono font-black text-teal-700 tracking-wider mt-0.5">
                    {agent.code}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Your Commission Split</div>
                  <div className="text-sm font-extrabold text-slate-800 mt-0.5 flex items-baseline gap-0.5">
                    <span className="text-lg font-black text-slate-950">{commissionRate}</span>
                    <span className="text-xs text-gray-500">% per subscription</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 bg-slate-50 p-3 rounded-xl">
              <Landmark className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[8.5px] uppercase font-bold text-slate-400">Payout Destination Bank</div>
                <div className="text-[10px] text-slate-700 font-semibold truncate leading-normal" title={agent.paymentDetails}>
                  {agent.paymentDetails || "Not registered. Contact SaaS Super Admin."}
                </div>
              </div>
            </div>
          </div>

          {/* Shareable Link & Onboard card */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs lg:col-span-2 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-teal-700">
                <Globe className="w-5 h-5" />
                <h3 className="font-extrabold text-xs tracking-wider uppercase text-slate-950 font-sans">
                  Your Personal Invitation Engine
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Distribute your custom invitation URL or register school parameters directly. Any school that registers through this URL automatically links to your profile, giving you a recurring <strong className="text-teal-700">{commissionRate}% cut</strong> on all sandbox and annual tier payouts.
              </p>
            </div>

            {/* URL Copy Segment */}
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">
                Shareable Registration Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-4 rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shrink-0 border ${
                    copied 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-teal-600 text-white border-teal-600 hover:bg-teal-700'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Direct Onboard Trigger */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-4 border-t border-slate-150">
              <div className="space-y-0.5">
                <div className="text-[10.5px] font-extrabold text-slate-900">Directly Onboard A School</div>
                <p className="text-[9.5px] text-slate-500 leading-tight">Register school parameters directly on behalf of a school admin.</p>
              </div>
              <button
                type="button"
                onClick={onOnboardDirectly}
                className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-lg shadow-teal-600/10 transition-all flex items-center gap-1 cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Register School Now
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-150 p-4 shadow-xs text-center">
            <div className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Total Onboarded</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{referredSchools.length}</div>
            <p className="text-[9px] text-gray-400 mt-1">Schools linked to your code</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-150 p-4 shadow-xs text-center">
            <div className="text-[9px] font-extrabold uppercase text-emerald-600 tracking-wider">Annual Contracts</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{annualCount}</div>
            <p className="text-[9px] text-emerald-500 font-semibold mt-1">
              ({referredSchools.filter(s => s.partnershipType === 'annual' && s.approvalStatus === 'approved').length > 0 
                ? referredSchools.filter(s => s.partnershipType === 'annual' && s.approvalStatus === 'approved').map(s => `₹${(s.annualPrice || 0).toLocaleString('en-IN')}`).join(', ') 
                : '₹0'} value)
            </p>
            {referredSchools.some(s => s.subscriptionRequest?.status === 'pending') && (
              <p className="text-[8.5px] text-amber-600 font-bold mt-1 uppercase tracking-wider animate-pulse">
                ⏳ {referredSchools.filter(s => s.subscriptionRequest?.status === 'pending').length} Upgrades Pending
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-150 p-4 shadow-xs text-center">
            <div className="text-[9px] font-extrabold uppercase text-indigo-600 tracking-wider">Sandbox Trials</div>
            <div className="text-2xl font-black text-indigo-700 mt-1">{trialCount}</div>
            <p className="text-[9px] text-indigo-500 font-semibold mt-1">(₹0 / school value)</p>
          </div>

          <div className="bg-white rounded-2xl border border-emerald-150 p-4 shadow-xs text-center bg-gradient-to-br from-emerald-50/20 to-emerald-50/50 flex flex-col justify-between">
            <div>
              <div className="text-[9px] font-extrabold uppercase text-teal-700 tracking-wider">Available Balance</div>
              <div className="text-2xl font-black text-emerald-600 font-mono mt-1">₹{availableBalance.toLocaleString('en-IN')}</div>
              <div className="mt-1.5 pt-1.5 border-t border-emerald-100/50 space-y-0.5 text-[8.5px] font-semibold text-slate-500 text-left">
                <div className="flex justify-between">
                  <span>Total Earned:</span>
                  <span className="text-slate-900 font-bold">₹{totalCommissions.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid Out / Sent:</span>
                  <span className="text-emerald-700 font-black">₹{withdrawals.filter(w => w.status === 'paid').reduce((sum, w) => sum + w.amount, 0).toLocaleString('en-IN')}</span>
                </div>
                {withdrawals.filter(w => w.status === 'approved' || w.status === 'processing').length > 0 && (
                  <div className="flex justify-between text-indigo-650 font-bold animate-pulse">
                    <span>Approved & Processing:</span>
                    <span>₹{withdrawals.filter(w => w.status === 'approved' || w.status === 'processing').reduce((sum, w) => sum + w.amount, 0).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {pendingCommissions > 0 && (
                  <div className="flex justify-between text-amber-600 font-extrabold animate-pulse">
                    <span>⏳ Est. Pending:</span>
                    <span>₹{pendingCommissions.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            </div>
            {availableBalance > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setWithdrawalError('');
                  setPayoutSuccess(false);
                  setShowWithdrawalModal(true);
                }}
                className="mt-2.5 w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider py-1.5 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95"
              >
                💸 Request Payout
              </button>
            ) : (
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-2.5 bg-slate-50 border border-slate-100 py-1 rounded-md">No Available Balance</p>
            )}
          </div>
        </div>

        {/* Referred Schools List */}
        <div className="bg-white rounded-3xl border border-gray-150 shadow-xs p-6 space-y-4">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
                <School className="w-4 h-4 text-teal-600" />
                Your Onboarded Schools Directory
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Complete view-only ledger of school registries onboarded under your referral code.</p>
            </div>

            <div className="w-full sm:w-64 relative">
              <input
                type="text"
                placeholder="Filter by school name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-1 focus:ring-teal-500"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {filteredReferredSchools.length === 0 ? (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center text-slate-400 space-y-2">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold">No onboarded schools found matching your search.</p>
            </div>
          ) : (
            <div className="border border-gray-150 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full border-collapse text-left text-xs bg-white">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 select-none">
                    <th className="p-3">School Name</th>
                    <th className="p-3">Registration ID</th>
                    <th className="p-3">Contact Person</th>
                    <th className="p-3">Onboarded At</th>
                    <th className="p-3 text-center">Plan Tier</th>
                    <th className="p-3 text-center">Approval Status</th>
                    <th className="p-3 text-center">Your Est. Commission</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredReferredSchools.map(school => {
                    const price = (school.partnershipType === 'annual' && school.approvalStatus === 'approved') ? (school.annualPrice || 0) : 0;
                    const commissionAmount = price * commissionRate / 100;
                    
                    return (
                      <tr key={school.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3">
                          <div className="font-extrabold text-slate-900">{school.name}</div>
                          <div className="text-gray-500 font-semibold text-[10px]">{school.board}</div>
                        </td>
                        <td className="p-3 font-mono font-bold text-[10.5px] text-slate-500 select-all">
                          {school.username}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">{school.contactPerson || 'N/A'}</div>
                          <div className="text-gray-500 text-[10px] font-mono">{school.email || school.mobile || 'N/A'}</div>
                        </td>
                        <td className="p-3 text-slate-500 font-medium">
                          {school.createdAt ? new Date(school.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center gap-1 justify-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${
                              school.partnershipType === 'annual'
                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                            }`}>
                              {school.partnershipType === 'annual' ? '🌟 Annual' : '🧪 Free Tier'}
                            </span>
                            {school.subscriptionRequest?.status === 'pending' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 animate-pulse whitespace-nowrap">
                                ⏳ Upgrade Pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${
                            school.approvalStatus === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : school.approvalStatus === 'rejected'
                              ? 'bg-rose-50 text-rose-700 border-rose-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {school.approvalStatus || 'Pending'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-black text-emerald-600">₹{commissionAmount.toLocaleString('en-IN')}</span>
                            {school.subscriptionRequest?.status === 'pending' && (
                              <span className="text-[9px] font-extrabold text-amber-600 whitespace-nowrap" title="Potential commission upon admin approval of payment">
                                ⏳ ₹{(school.subscriptionRequest.calculatedTotal * commissionRate / 100).toLocaleString('en-IN')} (Est.)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedSchoolForView(school)}
                            className="p-1 px-2 text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-all flex items-center gap-1 cursor-pointer ml-auto"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Withdrawals List */}
        <div className="bg-white rounded-3xl border border-gray-150 shadow-xs p-6 space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-teal-600" />
              Commission Withdrawal History
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Track your requested payouts and processing status.</p>
          </div>

          {withdrawals.length === 0 ? (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center text-slate-400 space-y-2">
              <Landmark className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold">No payout requests submitted yet.</p>
              <p className="text-[10px] text-slate-400">Request payouts when you have available commission balance.</p>
            </div>
          ) : (
            <div className="border border-gray-150 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full border-collapse text-left text-xs bg-white">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 select-none">
                    <th className="p-3">Requested At</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Payment Details</th>
                    <th className="p-3">Remarks / Note</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-semibold text-slate-700">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 text-slate-500 text-[11px] font-mono whitespace-nowrap">
                        {new Date(w.requestedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="p-3 text-slate-900 font-bold font-mono">
                        ₹{w.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-[11px] max-w-[200px] truncate" title={w.paymentDetails}>
                        {w.paymentDetails}
                      </td>
                      <td className="p-3 text-[11px] text-slate-500 max-w-[150px] truncate" title={w.remarks}>
                        {w.remarks || '—'}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          w.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : w.status === 'approved' 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            : w.status === 'processing'
                            ? 'bg-sky-50 text-sky-700 border border-sky-100 animate-pulse'
                            : w.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                        }`}>
                          {w.status === 'paid' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {w.status === 'approved' && <CheckCircle2 className="w-3 h-3 text-indigo-600" />}
                          {w.status === 'processing' && <Clock className="w-3 h-3 text-sky-600 animate-spin" />}
                          {w.status === 'rejected' && <AlertCircle className="w-3 h-3 text-rose-600" />}
                          {w.status === 'pending' && <Clock className="w-3 h-3 text-amber-600" />}
                          {w.status === 'paid' ? 'Paid' : w.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* View Details modal */}
      {selectedSchoolForView && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-100 shadow-2xl p-6 text-slate-900 space-y-5">
            
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <School className="w-4 h-4 text-teal-600" />
                <h3 className="font-extrabold text-sm text-slate-950 uppercase tracking-wider">
                  School Details (View-Only)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSchoolForView(null)}
                className="p-1 hover:bg-slate-50 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">School Name</span>
                <span className="text-xs font-extrabold text-slate-900">{selectedSchoolForView.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">School Login ID</span>
                  <span className="text-xs font-mono font-bold text-slate-700">{selectedSchoolForView.username}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Board affiliation</span>
                  <span className="text-xs font-bold text-slate-700">{selectedSchoolForView.board}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Contact Person</span>
                  <span className="text-xs font-bold text-slate-700">{selectedSchoolForView.contactPerson || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Mobile number</span>
                  <span className="text-xs font-mono font-bold text-slate-700">{selectedSchoolForView.mobile || 'N/A'}</span>
                </div>
              </div>

              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Address on record</span>
                <span className="text-xs font-medium text-slate-700 italic leading-relaxed">{selectedSchoolForView.address || 'N/A'}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-150">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Partner code</span>
                  <span className="inline-flex px-1.5 py-0.5 bg-teal-50 text-teal-800 text-[10px] font-mono font-bold rounded">
                    {selectedSchoolForView.referredByAgentCode || 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Contract Tier</span>
                  <span className="text-xs font-bold text-slate-700 uppercase">
                    {selectedSchoolForView.partnershipType === 'annual' ? '🌟 Annual Plan' : '🧪 Sandbox Trial'}
                  </span>
                </div>
              </div>

              {selectedSchoolForView.subscriptionRequest && (
                <div className="bg-amber-50/50 border border-amber-150 p-3 rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-800 tracking-wider">
                    <Clock className="w-3.5 h-3.5" />
                    Subscription Upgrade Request
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                    <div>
                      <span className="text-[8.5px] uppercase text-gray-400 block">Requested Plan Size</span>
                      <span className="font-bold text-slate-800">{selectedSchoolForView.subscriptionRequest.studentCount} Students</span>
                    </div>
                    <div>
                      <span className="text-[8.5px] uppercase text-gray-400 block">Calculated Price</span>
                      <span className="font-bold text-indigo-600 font-mono">₹{selectedSchoolForView.subscriptionRequest.calculatedTotal.toLocaleString()}/year</span>
                    </div>
                    <div>
                      <span className="text-[8.5px] uppercase text-gray-400 block">Request Status</span>
                      <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[8.5px] font-bold uppercase tracking-wider ${
                        selectedSchoolForView.subscriptionRequest.status === 'approved'
                          ? 'bg-emerald-105 text-emerald-800'
                          : selectedSchoolForView.subscriptionRequest.status === 'rejected'
                          ? 'bg-rose-105 text-rose-800'
                          : 'bg-amber-105 text-amber-800 animate-pulse'
                      }`}>
                        {selectedSchoolForView.subscriptionRequest.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8.5px] uppercase text-gray-400 block">Your Est. Commission</span>
                      <span className="font-bold text-emerald-600 font-mono">₹{(selectedSchoolForView.subscriptionRequest.calculatedTotal * commissionRate / 100).toLocaleString()}/year</span>
                    </div>
                  </div>
                  {selectedSchoolForView.subscriptionRequest.verificationMessage && (
                    <p className="text-[10px] text-slate-500 italic leading-snug pt-1 border-t border-amber-100/50">
                      &ldquo;{selectedSchoolForView.subscriptionRequest.verificationMessage}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>

            <p className="text-[10px] text-amber-600 bg-amber-50 p-2 border border-amber-100 rounded-lg leading-tight font-medium">
              ⚠️ Security Notice: To comply with administrative sandbox isolation, Partner Agents have strictly view-only permissions. They are not permitted to modify school records.
            </p>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSelectedSchoolForView(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Withdrawal Request Modal */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          {payoutSuccess ? (
            <div className="bg-white rounded-3xl w-full max-w-md border border-slate-100 shadow-2xl p-6 text-slate-900 text-center space-y-4 animate-scaleUp">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce shadow-inner">
                <Check className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-slate-900 uppercase tracking-wide">Request Submitted!</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Your payout request was sent successfully and is now pending administrator review.
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[11px] text-slate-600 max-w-sm mx-auto space-y-1.5 text-left font-semibold">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-amber-600 uppercase font-bold">⏳ Pending Review</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount Requested:</span>
                  <span className="text-slate-900 font-extrabold">₹{parseFloat(withdrawalAmount || '0').toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Channel:</span>
                  <span className="text-slate-800 truncate max-w-[180px]" title={paymentDetails}>{paymentDetails}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPayoutSuccess(false);
                  setShowWithdrawalModal(false);
                  setWithdrawalAmount('');
                  setWithdrawalRemarks('');
                }}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-650 text-white font-extrabold text-xs rounded-xl shadow-md hover:from-emerald-700 hover:to-teal-700 active:scale-95 transition-all cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleRequestWithdrawal} className="bg-white rounded-3xl w-full max-w-md border border-slate-100 shadow-2xl p-6 text-slate-900 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-teal-600 animate-pulse" />
                  <h3 className="font-extrabold text-sm text-slate-950 uppercase tracking-wider">
                    Request Payout / Withdrawal
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWithdrawalModal(false)}
                  className="p-1 hover:bg-slate-50 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {withdrawalError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{withdrawalError}</span>
                </div>
              )}

              {activePendingRequest && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-semibold space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-amber-800 font-extrabold uppercase text-[10px] tracking-wider">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 animate-pulse" />
                    Active Request Pending
                  </div>
                  <p className="leading-relaxed text-slate-700">
                    You currently have a payout request of <strong className="text-slate-900">₹{activePendingRequest.amount.toLocaleString('en-IN')}</strong> in <span className="font-extrabold text-amber-700 uppercase">{activePendingRequest.status}</span> status.
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium leading-normal">
                    To prevent duplicate payouts, please wait for the SaaS administrator to process your active request before requesting another.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Available to Withdraw</label>
                  <div className="text-xl font-extrabold text-emerald-600 font-mono">₹{availableBalance.toLocaleString('en-IN')}</div>
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Amount (INR)</label>
                  <input
                    type="number"
                    required
                    disabled={!!activePendingRequest}
                    placeholder={activePendingRequest ? "Payout request is already pending" : "Enter amount to withdraw (e.g. 5000)"}
                    value={activePendingRequest ? '' : withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 bg-slate-50 disabled:bg-slate-100/60 disabled:text-slate-400 rounded-xl outline-none focus:border-teal-500 font-bold text-slate-800"
                    max={availableBalance}
                    min={1}
                    step="any"
                  />
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Payment Method / Bank Details</label>
                  <textarea
                    required
                    rows={2}
                    disabled={!!activePendingRequest}
                    placeholder="Enter Bank Name, Account Number, IFSC Code, or UPI ID / PayPal email"
                    value={paymentDetails}
                    onChange={(e) => setPaymentDetails(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 bg-slate-50 disabled:bg-slate-100/60 disabled:text-slate-400 rounded-xl outline-none focus:border-teal-500 font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Optional note to SaaS Admin</label>
                  <input
                    type="text"
                    disabled={!!activePendingRequest}
                    placeholder="e.g. Requesting payout for approved schools"
                    value={activePendingRequest ? '' : withdrawalRemarks}
                    onChange={(e) => setWithdrawalRemarks(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 bg-slate-50 disabled:bg-slate-100/60 disabled:text-slate-400 rounded-xl outline-none focus:border-teal-500 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowWithdrawalModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRequesting || !!activePendingRequest}
                  className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md"
                >
                  {isRequesting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Request</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Floating Side Support Chat Button */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-end">
        <button
          type="button"
          onClick={() => setShowChat(true)}
          className="relative flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-[11px] uppercase tracking-wider py-3 px-3.5 shadow-xl transition-all cursor-pointer rounded-l-2xl border-l border-y border-teal-500/30 group select-none hover:-translate-x-1 active:scale-95"
          style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}
        >
          {unreadCount > 0 && (
            <span className="absolute -top-2 -left-2 bg-rose-500 text-white text-[9px] font-black w-5.5 h-5.5 flex items-center justify-center rounded-full border-2 border-white shadow-lg animate-bounce normal-case tracking-normal">
              {unreadCount}
            </span>
          )}
          <MessageSquare className="w-4 h-4 text-white -rotate-90 group-hover:scale-110 transition-transform mb-1.5" />
          <span>Support Chat</span>
        </button>
      </div>

      {/* Support Chat Drawer */}
      {showChat && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setShowChat(false)}
          />
          
          {/* Drawer content */}
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-150 flex flex-col z-10 animate-slideLeft">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-teal-600 to-emerald-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs uppercase tracking-wider">Direct Admin Support</h3>
                  <p className="text-[10px] text-teal-100 font-semibold mt-0.5">Direct chat with SaaS Admin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChat(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3.5" ref={chatEndRef}>
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2.5">
                  <MessageSquare className="w-12 h-12 text-slate-300" />
                  <div>
                    <p className="text-xs font-bold">No message history yet.</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Send a message to SaaS Admin to start a conversation!</p>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.senderId === agent.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 tracking-wider px-1">
                        {isMe ? 'You' : msg.senderName}
                      </span>
                      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed font-medium shadow-2xs ${
                        isMe 
                          ? 'bg-teal-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-800 border border-slate-150 rounded-tl-none'
                      }`}>
                        {renderMessageWithLinks(msg.message, isMe)}
                      </div>
                      <span className="text-[8.5px] text-slate-400 mt-0.5 font-semibold px-1 font-mono">
                        {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendChatMessage} className="p-3 border-t border-slate-150 bg-white shrink-0 flex gap-2">
              <input
                type="text"
                placeholder="Type your message to Admin..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs border border-slate-200 bg-slate-50 rounded-xl outline-none focus:border-teal-500 font-semibold"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="px-3 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple internal X icon representation
function X(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
