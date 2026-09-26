import React from 'react';
import { ExternalLink, CreditCard, ShieldCheck } from 'lucide-react';

/**
 * Parses text and converts:
 * 1. [Button: Text | URL] -> Highly styled, clickable Action Button
 * 2. [Payment: Text | URL] or [Payment: Text | URL | Amount] -> Emerald Secure Payment Button
 * 3. Standard URLs -> Inline stylized link tags
 */
export function renderMessageWithLinks(text: string, isMe?: boolean) {
  if (!text) return null;

  // Extremely robust regex that allows optional spacing inside the brackets, e.g. [ Button: ... ]
  const regex = /(\[\s*Button:\s*[^|\]]+\s*\|\s*[^\]]+\]|\[\s*Payment:\s*[^|\]]+\s*\|\s*[^\]]+\]|https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*|[a-zA-Z0-9.-]+\.me\/[^\s]*)/gi;

  const parts = text.split(regex);
  if (parts.length === 1) {
    return <span>{text}</span>;
  }

  return (
    <span className="space-y-1.5 block">
      {parts.map((part, index) => {
        if (!part) return null;

        const trimmedPart = part.trim();

        // 1. Check if it's an Action Button
        if (/^\[\s*button:/i.test(trimmedPart)) {
          const content = trimmedPart.slice(1, -1); // Remove outer [ and ]
          const colonIndex = content.indexOf(':');
          if (colonIndex !== -1) {
            const body = content.substring(colonIndex + 1);
            const barIndex = body.indexOf('|');
            if (barIndex !== -1) {
              const label = body.substring(0, barIndex).trim();
              let url = body.substring(barIndex + 1).trim();
              if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
              }

              return (
                <span key={index} className="block my-1.5 text-center">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-950 hover:bg-slate-900 text-white font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider rounded-lg sm:rounded-xl shadow-md shadow-blue-950/20 hover:scale-[1.02] active:scale-95 transition-all max-w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">{label}</span>
                    <ExternalLink className="w-3 h-3 text-white/90 shrink-0" />
                  </a>
                </span>
              );
            }
          }
        }

        // 2. Check if it's a Secure Payment Button
        if (/^\[\s*payment:/i.test(trimmedPart)) {
          const content = trimmedPart.slice(1, -1); // Remove outer [ and ]
          const colonIndex = content.indexOf(':');
          if (colonIndex !== -1) {
            const body = content.substring(colonIndex + 1);
            const splitParts = body.split('|');
            if (splitParts.length >= 2) {
              const label = splitParts[0].trim();
              let url = splitParts[1].trim();
              const amount = splitParts[2]?.trim();

              if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
              }

              return (
                <span key={index} className="block my-2 text-center">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={
                      isMe
                        ? "inline-flex flex-col items-center gap-1 p-3 bg-gradient-to-br from-emerald-400 to-teal-600 hover:from-emerald-500 hover:to-teal-700 text-white rounded-2xl shadow-lg shadow-indigo-900/30 hover:scale-[1.02] active:scale-95 transition-all border border-white/30 max-w-xs mx-auto w-full"
                        : "inline-flex flex-col items-center gap-1 p-3 bg-gradient-to-br from-emerald-500 to-teal-700 hover:from-emerald-600 hover:to-teal-800 text-white rounded-2xl shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all border border-emerald-400/20 max-w-xs mx-auto w-full"
                    }
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wide">
                      <CreditCard className="w-4 h-4 text-emerald-100" />
                      <span>{label}</span>
                    </div>
                    
                    {amount && (
                      <div className="text-[10px] font-bold text-emerald-100">
                        Amount: <span className="text-white text-xs font-black">{amount}</span>
                      </div>
                    )}

                    <div className="mt-1 flex items-center gap-1 text-[8px] uppercase tracking-wider text-emerald-100/80 font-mono">
                      <ShieldCheck className="w-3 h-3 text-emerald-300" />
                      <span>Secure Gateway Payment</span>
                    </div>
                  </a>
                </span>
              );
            }
          }
        }

        // 3. Check if it's a generic URL
        if (trimmedPart.match(/https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*|[a-zA-Z0-9.-]+\.me\/[^\s]*/gi)) {
          let href = trimmedPart;
          if (!/^https?:\/\//i.test(href)) {
            href = 'https://' + href;
          }
          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={
                isMe
                  ? "text-blue-100 hover:text-white font-extrabold underline break-all bg-indigo-700/55 px-1.5 py-0.5 rounded mx-0.5 inline-flex items-center gap-0.5 border border-indigo-500/30 shadow-3xs"
                  : "text-indigo-600 hover:text-indigo-800 hover:underline font-extrabold break-all bg-indigo-50 px-1.5 py-0.5 rounded mx-0.5 inline-flex items-center gap-0.5 border border-indigo-100 shadow-3xs"
              }
              onClick={(e) => e.stopPropagation()}
            >
              {part}
              <span className="text-[8px] leading-none shrink-0">↗</span>
            </a>
          );
        }

        // 4. Regular text chunk
        return <span key={index} className="whitespace-pre-wrap">{part}</span>;
      })}
    </span>
  );
}
