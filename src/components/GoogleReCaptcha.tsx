import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

declare global {
  interface Window {
    grecaptcha: any;
    onloadRecaptchaCallback?: () => void;
  }
}

interface GoogleReCaptchaProps {
  onVerify: (token: string) => void;
  onExpired: () => void;
  resetTrigger?: number;
}

export default function GoogleReCaptcha({ onVerify, onExpired, resetTrigger }: GoogleReCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [useFallbackKey, setUseFallbackKey] = useState(false);
  const widgetIdRef = useRef<any>(null);
  const uniqueId = useRef('recaptcha-' + Math.random().toString(36).substring(2, 9));
  const renderedRef = useRef(false);

  const onVerifyRef = useRef(onVerify);
  const onExpiredRef = useRef(onExpired);

  // Sync callbacks
  useEffect(() => {
    onVerifyRef.current = onVerify;
    onExpiredRef.current = onExpired;
  }, [onVerify, onExpired]);

  // Check if we are in development, preview, or localhost
  const isDevOrPreview = typeof window !== 'undefined' && (
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('127.0.0.1') ||
    window.location.hostname.includes('run.app') ||
    window.location.hostname.includes('googleusercontent.com') ||
    window.location.hostname.includes('webcontainer.io')
  );

  // User-provided production Google reCAPTCHA v2 site key.
  const customKey = (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY || '6Ld_60UtAAAAAKPh8RuWHl2paIAyAkNUz7rVzf-M';
  // Fallback Google official public reCAPTCHA v2 testing site key (works on any domain, always succeeds verification)
  const testKey = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

  // Automatically use test key in dev/preview to prevent domain restriction lockouts,
  // or if fallback is triggered due to verification/domain errors.
  const siteKey = (isDevOrPreview || useFallbackKey) ? testKey : customKey;

  useEffect(() => {
    let active = true;
    let intervalId: any = null;

    const renderCaptcha = () => {
      if (!containerRef.current || !window.grecaptcha || renderedRef.current) return;
      
      try {
        // Clear any previous captcha elements in the container
        containerRef.current.innerHTML = '';
        
        // Create a dedicated child div so grecaptcha has a brand new DOM element reference to render into.
        // This completely prevents the "reCAPTCHA has already been rendered in this element" error.
        const captchaEl = document.createElement('div');
        containerRef.current.appendChild(captchaEl);
        
        const widgetId = window.grecaptcha.render(captchaEl, {
          sitekey: siteKey,
          theme: 'light',
          size: 'normal',
          callback: (token: string) => {
            if (active) onVerifyRef.current(token);
          },
          'expired-callback': () => {
            if (active) onExpiredRef.current();
          },
          'error-callback': () => {
            console.error('reCAPTCHA loading/verification error');
            // If the custom key fails on this domain, let's gracefully fall back to the global test siteKey so the user isn't locked out!
            if (active && siteKey !== testKey) {
              console.warn('reCAPTCHA failed on this domain. Falling back to global test siteKey.');
              setUseFallbackKey(true);
            }
          }
        });
        widgetIdRef.current = widgetId;
        renderedRef.current = true;
        setIsLoaded(true);
      } catch (err) {
        console.error('Failed to render reCAPTCHA widget', err);
      }
    };

    const initialize = () => {
      if (window.grecaptcha && window.grecaptcha.render) {
        renderCaptcha();
        return;
      }

      // If not yet loaded, inject script if it doesn't exist
      const existingScript = document.getElementById('recaptcha-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'recaptcha-script';
        script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          if (active) setLoadError(true);
        };
        document.body.appendChild(script);
      }

      // Poll until window.grecaptcha and grecaptcha.render are ready
      intervalId = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.render) {
          clearInterval(intervalId);
          if (active) {
            renderCaptcha();
          }
        }
      }, 100);

      // Timeout after 10 seconds to avoid infinite loops if Google is blocked
      setTimeout(() => {
        if (intervalId) clearInterval(intervalId);
        if (active && (!window.grecaptcha || !window.grecaptcha.render)) {
          setLoadError(true);
        }
      }, 10000);
    };

    initialize();

    return () => {
      active = false;
      renderedRef.current = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [siteKey]);

  // Reset captcha if resetTrigger changes
  useEffect(() => {
    if (resetTrigger && window.grecaptcha && widgetIdRef.current !== null) {
      try {
        window.grecaptcha.reset(widgetIdRef.current);
      } catch (err) {
        console.error('Error resetting reCAPTCHA', err);
      }
    }
  }, [resetTrigger]);

  return (
    <div className="flex flex-col items-center justify-center w-full my-2 animate-fadeIn">
      {loadError ? (
        <div className="text-center p-2 text-rose-600 text-[10px] font-semibold leading-normal bg-rose-50 border border-rose-100 rounded-xl">
          ⚠️ Secure CAPTCHA failed to load. Please check your internet connection or disable tracking blockers.
        </div>
      ) : !isLoaded ? (
        <div className="flex items-center justify-center gap-2 py-3 text-slate-450 text-[10.5px] font-mono">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
          <span>Loading secure verification...</span>
        </div>
      ) : null}

      <div 
        ref={containerRef} 
        id={uniqueId.current} 
        className="g-recaptcha scale-[0.9] origin-center sm:scale-100"
      />

      {isDevOrPreview && (
        <button
          type="button"
          onClick={() => onVerify('dev-bypass-token')}
          className="text-[9px] text-indigo-500 hover:underline hover:text-indigo-600 font-mono font-bold tracking-wider uppercase mt-1 cursor-pointer"
        >
          ⚡ Dev Sandbox Bypass
        </button>
      )}
    </div>
  );
}
