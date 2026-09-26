import React, { useState } from 'react';
import { Link, CreditCard, Sparkles, Plus, Check, ShieldAlert, ArrowRight } from 'lucide-react';

interface LinkButtonCreatorProps {
  textValue: string;
  onTextChange: (val: string) => void;
  placeholderText?: string;
}

export default function LinkButtonCreator({ textValue, onTextChange }: LinkButtonCreatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [buttonType, setButtonType] = useState<'standard' | 'payment'>('payment');
  const [buttonText, setButtonText] = useState('Pay Annual Subscription');
  const [targetUrl, setTargetUrl] = useState('https://razorpay.me/@classname');
  const [amount, setAmount] = useState('₹49,999');
  const [showInsertedCheck, setShowInsertedCheck] = useState(false);

  // Quick preset options for ease of use
  const presets = [
    {
      label: "Annual Price (₹49,999)",
      type: "payment" as const,
      text: "Pay Approved Annual Subscription",
      url: "https://razorpay.me/@classname",
      amount: "₹49,999"
    },
    {
      label: "Standard Annual (₹24,999)",
      type: "payment" as const,
      text: "Pay Standard Tier Subscription",
      url: "https://razorpay.me/@classname",
      amount: "₹24,999"
    },
    {
      label: "Schedule Setup Call",
      type: "standard" as const,
      text: "Schedule Onboarding Zoom Call",
      url: "https://calendly.com/classname-setup",
      amount: ""
    }
  ];

  const handleApplyPreset = (p: typeof presets[0]) => {
    setButtonType(p.type);
    setButtonText(p.text);
    setTargetUrl(p.url);
    if (p.amount) setAmount(p.amount);
  };

  const handleInsert = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    let token = '';
    if (buttonType === 'payment') {
      token = `[Payment: ${buttonText.trim()} | ${targetUrl.trim()}${amount ? ` | ${amount.trim()}` : ''}]`;
    } else {
      token = `[Button: ${buttonText.trim()} | ${targetUrl.trim()}]`;
    }

    // Append to existing text
    const space = textValue.trim() ? '\n\n' : '';
    onTextChange(textValue + space + token);
    
    setShowInsertedCheck(true);
    setTimeout(() => {
      setShowInsertedCheck(false);
      setIsOpen(false);
    }, 1200);
  };

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-150 p-2.5 space-y-2 text-left">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setIsOpen(!isOpen);
          }}
          className="text-[10px] font-black text-indigo-700 hover:text-indigo-800 uppercase tracking-wider flex items-center gap-1 cursor-pointer select-none"
        >
          <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
          <span>{isOpen ? 'Close Link Creator' : '✨ Insert Payment / Link Button'}</span>
        </button>
        {isOpen && (
          <span className="text-[8px] font-mono text-slate-400">Generates custom action button</span>
        )}
      </div>

      {isOpen && (
        <div className="pt-2 border-t border-slate-150 space-y-3 animate-fadeIn">
          {/* Quick Presets row */}
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wide">Quick Presets:</span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="px-2 py-0.5 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-[9px] font-semibold text-slate-700 border border-slate-200 rounded-md transition-all cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="text-[8px] font-bold text-slate-500 uppercase block">Button Type</label>
              <div className="grid grid-cols-2 bg-white rounded-lg p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setButtonType('payment')}
                  className={`py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                    buttonType === 'payment' ? 'bg-emerald-600 text-white shadow-3xs' : 'text-slate-600'
                  }`}
                >
                  Payment
                </button>
                <button
                  type="button"
                  onClick={() => setButtonType('standard')}
                  className={`py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                    buttonType === 'standard' ? 'bg-indigo-600 text-white shadow-3xs' : 'text-slate-600'
                  }`}
                >
                  Link
                </button>
              </div>
            </div>

            <div className="space-y-0.5">
              <label className="text-[8px] font-bold text-slate-500 uppercase block">Button Text</label>
              <input
                type="text"
                placeholder="e.g. Pay Annual Subscription"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                className="w-full px-2 py-1 text-[11px] font-bold bg-white border border-slate-250 rounded-lg outline-none text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="text-[8px] font-bold text-slate-500 uppercase block">Target URL</label>
              <input
                type="text"
                placeholder="https://razorpay.me/classname"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full px-2 py-1 text-[11px] font-semibold bg-white border border-slate-250 rounded-lg outline-none text-slate-800 font-mono"
              />
            </div>

            <div className="space-y-0.5">
              <label className="text-[8px] font-bold text-slate-500 uppercase block">
                {buttonType === 'payment' ? 'Amount Tag (Optional)' : 'Amount (N/A)'}
              </label>
              <input
                type="text"
                placeholder="e.g. ₹49,999"
                value={amount}
                disabled={buttonType !== 'payment'}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-2 py-1 text-[11px] font-bold bg-white disabled:bg-slate-100 border border-slate-250 rounded-lg outline-none text-slate-800"
              />
            </div>
          </div>

          {/* Real-time Preview Box */}
          <div className="p-2 border border-slate-200 rounded-lg bg-white space-y-1">
            <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wide">Live Preview:</span>
            <div className="flex justify-center p-1.5 border border-dashed border-slate-150 rounded-md bg-slate-50">
              {buttonType === 'payment' ? (
                <div className="inline-flex flex-col items-center gap-0.5 p-2 bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-xl shadow-xs max-w-xs w-full text-center select-none scale-[0.95]">
                  <div className="flex items-center gap-1 font-black text-[10px] uppercase tracking-wide">
                    <CreditCard className="w-3 h-3 text-emerald-100 animate-bounce" />
                    <span>{buttonText || 'Secure Payment'}</span>
                  </div>
                  {amount && (
                    <div className="text-[9px] font-bold text-emerald-100">
                      Amount: <span className="text-white text-[10px] font-black">{amount}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white font-extrabold text-[9px] uppercase tracking-wider rounded-lg shadow-xs select-none scale-[0.95]">
                  <span>{buttonText || 'Click Here'}</span>
                  <Plus className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleInsert}
              disabled={!buttonText || !targetUrl}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer select-none ${
                showInsertedCheck
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-[1.01]'
              } disabled:bg-slate-200 disabled:text-slate-400`}
            >
              {showInsertedCheck ? (
                <>
                  <Check className="w-3 h-3 text-white" />
                  <span>Inserted Successfully!</span>
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" />
                  <span>Insert Button into Message</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
