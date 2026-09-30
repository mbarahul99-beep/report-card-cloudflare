import React, { useState } from 'react';
import { SchoolBranding } from '../types';
import { Palette, School, MapPin, Phone, Globe, Calendar, Mail, Award, Save, CheckCircle2, CloudUpload, RefreshCw, Sparkles, Upload, Trash2, Link2, Stamp } from 'lucide-react';
import { normalizeExternalImageUrl, isGoogleDriveUrl, compressAndResizeWatermark } from '../utils/imageUrlHelper';
import { uploadImageToR2 } from '../utils/r2Uploader';

function compressAndResizeImage(file: File, maxDimension: number, quality: number, callback: (base64: string) => void) {
  const reader = new FileReader();
  reader.onloadend = () => {
    const rawResult = reader.result as string;
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const isPNG = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
          
          if (!isPNG) {
            // Always fill with solid white background to prevent transparent areas from rendering as black for non-transparent formats
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          const outputFormat = isPNG ? 'image/png' : 'image/jpeg';
          const compressedBase64 = canvas.toDataURL(outputFormat, quality);
          callback(compressedBase64);
        } else {
          callback(rawResult);
        }
      } catch (err) {
        console.warn("Canvas resizing failing, using original base64:", err);
        callback(rawResult);
      }
    };
    img.onerror = () => {
      callback(rawResult);
    };
    img.src = rawResult;
  };
  reader.readAsDataURL(file);
}

interface BrandingSettingsProps {
  branding: SchoolBranding;
  onUpdate: (updatedBranding: SchoolBranding) => void;
  onSave?: () => void;
  isSaving?: boolean;
  saveSuccess?: boolean;
}

export default function BrandingSettings({ 
  branding, 
  onUpdate, 
  onSave, 
  isSaving = false, 
  saveSuccess = false 
}: BrandingSettingsProps) {
  const [localSavedNotice, setLocalSavedNotice] = useState(false);
  
  const hndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    onUpdate({
      ...branding,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleManualSave = () => {
    if (onSave) {
      onSave();
    }
    setLocalSavedNotice(true);
    setTimeout(() => {
      setLocalSavedNotice(false);
    }, 3000);
  };

  const showSavedState = saveSuccess || localSavedNotice;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-6 space-y-6">
      {/* Header & Save Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h2 className="text-xl font-bold font-sans text-gray-900 flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-600" />
            School Identity &amp; Header Branding
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Configure school identity, header typography, font sizes, colors, and logos. Changes automatically save to local storage and synchronize across all report cards.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/60 rounded-lg text-emerald-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Auto-Sync Active
          </div>

          <button
            type="button"
            onClick={handleManualSave}
            disabled={isSaving}
            id="btn_save_branding_top"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer ${
              showSavedState
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white'
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : showSavedState ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                Saved &amp; Synced!
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Header Settings
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-semibold text-gray-650 block">School Logo Image & Formatting</label>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 bg-gray-50 border border-gray-100 rounded-xl">
            <div className="lg:col-span-6 flex items-center gap-4">
              {branding.logoUrl ? (
                <div className="relative shrink-0">
                  <img 
                    src={branding.logoUrl} 
                    alt="School Logo Preview" 
                    className={`w-16 h-16 object-contain ${branding.logoBorder !== false ? 'bg-white p-1.5 border border-gray-250 shadow-xs' : ''} ${branding.logoCircular !== false ? 'rounded-full' : 'rounded-lg'}`}
                  />
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...branding, logoUrl: "" })}
                    className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center shadow-xs transition-colors text-[9px] font-bold"
                    title="Remove Logo"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 bg-gray-100 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 font-bold text-xs shrink-0">
                  No Logo
                </div>
              )}
              <div className="flex flex-col gap-2 w-full">
                <input
                  type="text"
                  name="logoUrl"
                  value={branding.logoUrl || ""}
                  onChange={hndChange}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Paste web URL of the school logo (png/jpeg)..."
                  id="brand_logo_url_input"
                />
                <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold px-3.5 py-2 rounded-lg text-center transition-colors select-none flex items-center justify-center gap-1">
                  Upload School Logo Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        compressAndResizeImage(file, 200, 0.9, async (compressedBase64) => {
                          const r2Url = await uploadImageToR2(compressedBase64, 'logos');
                          onUpdate({ ...branding, logoUrl: r2Url });
                        });
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="lg:col-span-6 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-gray-200/60 pt-3 lg:pt-0 lg:pl-4 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-600">Logo Scale Display Size:</span>
                  <span className="font-mono text-indigo-600 font-bold">{branding.logoSize !== undefined ? branding.logoSize : 92}px</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="200"
                  step="2"
                  value={branding.logoSize !== undefined ? branding.logoSize : 92}
                  onChange={(e) => onUpdate({ ...branding, logoSize: parseInt(e.target.value) })}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  id="brand_logo_size"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="logoCircular"
                  checked={branding.logoCircular !== false}
                  onChange={(e) => onUpdate({ ...branding, logoCircular: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                  id="brand_logo_circular"
                />
                <label htmlFor="brand_logo_circular" className="text-xs font-semibold text-gray-700 cursor-pointer select-none">
                  Enable Circle Frame shape for Logo (Default)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="logoBorder"
                  checked={branding.logoBorder !== false}
                  onChange={(e) => onUpdate({ ...branding, logoBorder: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                  id="brand_logo_border"
                />
                <label htmlFor="brand_logo_border" className="text-xs font-semibold text-gray-700 cursor-pointer select-none">
                  Enable Border box & Background around Logo (Default)
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-semibold text-gray-650 block">School Secondary/Right Logo Image (Optional)</label>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 bg-gray-50 border border-gray-100 rounded-xl">
            <div className="lg:col-span-6 flex items-center gap-4">
              {branding.rightLogoUrl ? (
                <div className="relative shrink-0">
                  <img 
                    src={branding.rightLogoUrl} 
                    alt="School Right Logo Preview" 
                    className={`w-16 h-16 object-contain ${branding.logoBorder !== false ? 'bg-white p-1.5 border border-gray-250 shadow-xs' : ''} ${branding.logoCircular !== false ? 'rounded-full' : 'rounded-lg'}`}
                  />
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...branding, rightLogoUrl: "" })}
                    className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center shadow-xs transition-colors text-[9px] font-bold"
                    title="Remove Logo"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 bg-gray-100 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 font-bold text-xs shrink-0">
                  No Logo
                </div>
              )}
              <div className="flex flex-col gap-2 w-full">
                <input
                  type="text"
                  name="rightLogoUrl"
                  value={branding.rightLogoUrl || ""}
                  onChange={hndChange}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Paste web URL of the right logo (png/jpeg)..."
                  id="brand_right_logo_url_input"
                />
                <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold px-3.5 py-2 rounded-lg text-center transition-colors select-none flex items-center justify-center gap-1">
                  Upload Right Logo Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        compressAndResizeImage(file, 200, 0.9, async (compressedBase64) => {
                          const r2Url = await uploadImageToR2(compressedBase64, 'logos');
                          onUpdate({ ...branding, rightLogoUrl: r2Url });
                        });
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="lg:col-span-6 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-gray-200/60 pt-3 lg:pt-0 lg:pl-4 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-600">Right Logo Scale Display Size:</span>
                  <span className="font-mono text-indigo-600 font-bold">{branding.rightLogoSize !== undefined ? branding.rightLogoSize : 92}px</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="200"
                  step="2"
                  value={branding.rightLogoSize !== undefined ? branding.rightLogoSize : 92}
                  onChange={(e) => onUpdate({ ...branding, rightLogoSize: parseInt(e.target.value) })}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  id="brand_right_logo_size"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Name Banner Landscape Image Option Panel */}
        <div className="space-y-2 md:col-span-2 p-4 bg-indigo-50/25 border border-indigo-100 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider">NEW</span>
            <label className="text-xs font-bold text-slate-850">School Name PNG/Landscape Banner (Optional Option)</label>
          </div>
          <p className="text-[11.5px] text-gray-500 leading-normal">
            Optionally upload or specify a beautiful landscape-sized image containing the School Name and typography details to display <strong>in place of the typed name header text</strong>.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
            {branding.nameBannerUrl ? (
              <div className="relative shrink-0 max-w-full sm:max-w-[245px] border border-indigo-200 rounded-lg bg-white p-1 text-center">
                <img 
                  src={branding.nameBannerUrl} 
                  alt="School Name Banner Override" 
                  className="h-14 w-auto object-contain max-w-full mx-auto" 
                />
                <button
                  type="button"
                  onClick={() => onUpdate({ ...branding, nameBannerUrl: "" })}
                  className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center shadow-xs transition-colors text-[9px] font-bold"
                  title="Remove Banner"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="w-full sm:w-[245px] h-14 bg-indigo-50/40 border border-dashed border-indigo-100 rounded-lg flex items-center justify-center text-[10px] text-indigo-400 font-bold font-mono shrink-0 select-none">
                No custom banner (Using school name)
              </div>
            )}
            <div className="flex flex-col gap-2 w-full">
              <input
                type="text"
                name="nameBannerUrl"
                value={branding.nameBannerUrl || ""}
                onChange={hndChange}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Paste direct banner image URL (PNG/JPEG) or upload..."
                id="brand_name_banner_url_input"
              />
              <label className="cursor-pointer bg-slate-850 hover:bg-slate-950 text-white text-[11px] font-semibold px-3.5 py-2 rounded-lg text-center transition-colors select-none flex items-center justify-center gap-1">
                Upload Landscape School Name/Header Banner
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      compressAndResizeImage(file, 800, 0.95, async (compressedBase64) => {
                        const r2Url = await uploadImageToR2(compressedBase64, 'logos', `banner_${Date.now()}`);
                        onUpdate({ ...branding, nameBannerUrl: r2Url });
                      });
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-indigo-100/50 mt-1">
            <input
              type="checkbox"
              name="hideSchoolDetails"
              checked={branding.hideSchoolDetails === true}
              onChange={hndChange}
              className="w-4 h-4 text-indigo-600 rounded border-gray-350 focus:ring-indigo-500 cursor-pointer"
              id="brand_hide_school_details"
            />
            <label htmlFor="brand_hide_school_details" className="text-xs font-semibold text-gray-700 cursor-pointer select-none">
              Hide text tagline, address, helpline, website/email details (useful if these details are already pre-embedded in your banner image)
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 block">School Name</label>
          <div className="relative">
            <School className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              name="schoolName"
              value={branding.schoolName || ""}
              onChange={hndChange}
              id="brand_school_name"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold"
              placeholder="e.g. DEMO PUBLIC SCHOOL"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 block">Board Affiliation / Tagline</label>
          <div className="relative">
            <Award className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              name="tagline"
              value={branding.tagline || ""}
              onChange={hndChange}
              id="brand_tagline"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
              placeholder="e.g. Affiliated to CBSE Delhi | Affiliation No. 123456"
            />
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-semibold text-gray-600 block">Address Location</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              name="address"
              value={branding.address || ""}
              onChange={hndChange}
              id="brand_address"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
              placeholder="e.g. 85, Sunil Park, Opp. MBD Mall, Ludhiana 141012"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 block">Helpline Numbers</label>
          <div className="relative">
            <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              name="helpline"
              value={branding.helpline || ""}
              onChange={hndChange}
              id="brand_helpline"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
              placeholder="e.g. +91 161 1234567, 9876543210"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 block">Official Website</label>
          <div className="relative">
            <Globe className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              name="website"
              value={branding.website || ""}
              onChange={hndChange}
              id="brand_website"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
              placeholder="e.g. www.superreportschool.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 block">Official Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              name="email"
              value={branding.email || ""}
              onChange={hndChange}
              id="brand_email"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
              placeholder="e.g. info@superreportschool.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 block">Academic Session Year</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              name="session"
              value={branding.session || ""}
              onChange={hndChange}
              id="brand_session"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
              placeholder="e.g. Session 2022-2023"
            />
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-semibold text-gray-600 block">Report Card Title Heading</label>
          <div className="relative">
            <Award className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              name="reportCardTitle"
              value={branding.reportCardTitle || "Annual Examination Report Card"}
              onChange={hndChange}
              id="brand_report_card_title"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold"
              placeholder="e.g. Annual Examination Report Card"
            />
          </div>
        </div>
      </div>

      {/* Background Watermark & Security Stamp Configuration Section */}
      <div className="border-t border-gray-100 pt-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Background Watermark &amp; Security Stamp Setup
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure school watermark emblem or security text overlay rendered subtly behind report card grades.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50/70 border border-indigo-150 px-3 py-1.5 rounded-xl">
            <input
              type="checkbox"
              id="brand_show_watermark"
              name="showWatermark"
              checked={branding.showWatermark === true}
              onChange={(e) => onUpdate({ ...branding, showWatermark: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="brand_show_watermark" className="text-xs font-bold text-indigo-900 cursor-pointer select-none">
              Enable Watermark Stamp
            </label>
          </div>
        </div>

        {branding.showWatermark && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-4.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
            {/* Controls (Left 7 Cols) */}
            <div className="md:col-span-7 space-y-4">
              {/* Type Switch: Text vs Logo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Stamp Mode</label>
                <div className="flex gap-4 p-1.5 bg-white rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-bold select-none px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="brand_wm_type"
                      checked={branding.watermarkType === 'text'}
                      onChange={() => onUpdate({ ...branding, watermarkType: 'text' })}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>Text Stamp</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-bold select-none px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="brand_wm_type"
                      checked={branding.watermarkType !== 'text'}
                      onChange={() => {
                        onUpdate({
                          ...branding,
                          watermarkType: 'logo',
                          watermarkLogoUrl: branding.watermarkLogoUrl || branding.logoUrl || '',
                          watermarkSize: (!branding.watermarkSize || branding.watermarkSize === 120) ? 320 : branding.watermarkSize
                        });
                      }}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>Logo / Image Stamp</span>
                  </label>
                </div>
              </div>

              {branding.watermarkType === 'text' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Stamp Text</label>
                  <input
                    type="text"
                    value={branding.watermarkText || ""}
                    onChange={(e) => onUpdate({ ...branding, watermarkText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-sm font-black text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="e.g. DEMO PUBLIC SCHOOL or CONFIDENTIAL"
                  />
                  <p className="text-[10px] text-gray-400">Renders diagonal watermark text centered across the report card.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Upload Image & Remove */}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-xs transition-all select-none">
                      <Upload className="w-3.5 h-3.5" />
                      Upload Watermark Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            compressAndResizeWatermark(f, async (b64) => {
                              const r2Url = await uploadImageToR2(b64, 'watermarks', `wm_${Date.now()}`);
                              onUpdate({ ...branding, watermarkLogoUrl: r2Url });
                            });
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {branding.watermarkLogoUrl && (
                      <button
                        type="button"
                        onClick={() => onUpdate({ ...branding, watermarkLogoUrl: '' })}
                        className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-xl transition-colors cursor-pointer"
                        title="Remove watermark image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove Image
                      </button>
                    )}
                  </div>

                  {/* Google Drive or Web Link Input */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                        <Link2 className="w-3 h-3 text-indigo-500" />
                        Or Paste Google Drive / Web Link:
                      </span>
                      {branding.watermarkLogoUrl && isGoogleDriveUrl(branding.watermarkLogoUrl) && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Google Drive Link Converted
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={branding.watermarkLogoUrl || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const normalized = normalizeExternalImageUrl(val);
                        onUpdate({ ...branding, watermarkLogoUrl: normalized });
                      }}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData('text');
                        if (text) {
                          e.preventDefault();
                          const normalized = normalizeExternalImageUrl(text);
                          onUpdate({ ...branding, watermarkLogoUrl: normalized });
                        }
                      }}
                      className="w-full px-3 py-2 border text-xs rounded-xl bg-white font-mono text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Paste Google Drive share link (e.g. drive.google.com/file/d/...) or web image URL..."
                    />
                    <p className="text-[10px] text-slate-400 leading-tight">
                      💡 <strong>Google Drive:</strong> Paste any share link. Ensure the file permission is set to <em>&ldquo;Anyone with the link can view&rdquo;</em>.
                    </p>
                  </div>

                  {/* Visual Thumbnail */}
                  {branding.watermarkLogoUrl && (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-3 shadow-2xs">
                      <div
                        className="relative w-14 h-14 rounded-lg border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden"
                        style={{
                          backgroundImage: 'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
                          backgroundSize: '12px 12px',
                          backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px'
                        }}
                      >
                        <img
                          src={normalizeExternalImageUrl(branding.watermarkLogoUrl)}
                          alt="Watermark Stamp Preview"
                          className="max-w-full max-h-full object-contain pointer-events-none"
                          style={{ opacity: Math.max(0.2, branding.watermarkOpacity ?? 0.15) }}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {branding.watermarkLogoUrl.startsWith('data:')
                              ? 'Local Image File (Uploaded)'
                              : isGoogleDriveUrl(branding.watermarkLogoUrl)
                                ? 'Google Drive Direct Link'
                                : 'Web Image URL'}
                          </span>
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                            Ready
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-500 leading-tight">
                          Stamp is active and configured for report cards.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Coverage / Layout Mode for Logo Watermarks */}
                  <div className="space-y-2 pt-2 border-t border-dashed border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-600 block">Watermark Page Coverage / Layout:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={`flex flex-col gap-1 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        branding.watermarkLayout === 'full_page'
                          ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="radio"
                            name="brand_wm_layout"
                            checked={branding.watermarkLayout === 'full_page'}
                            onChange={() => onUpdate({ ...branding, watermarkLayout: 'full_page' })}
                            className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs font-bold text-slate-800">Full Page (A4 Sheet)</span>
                        </div>
                        <span className="text-[9px] text-slate-500 leading-tight">
                          Covers entire report card background.
                        </span>
                      </label>

                      <label className={`flex flex-col gap-1 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        branding.watermarkLayout !== 'full_page'
                          ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="radio"
                            name="brand_wm_layout"
                            checked={branding.watermarkLayout !== 'full_page'}
                            onChange={() => onUpdate({ ...branding, watermarkLayout: 'center' })}
                            className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs font-bold text-slate-800">Centered Stamp</span>
                        </div>
                        <span className="text-[9px] text-slate-500 leading-tight">
                          Scalable emblem centered in the page.
                        </span>
                      </label>
                    </div>

                    {branding.watermarkLayout === 'full_page' && (
                      <div className="flex items-center justify-between p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-150">
                        <span className="text-[10px] font-bold text-indigo-900">A4 Fitting Mode:</span>
                        <select
                          value={branding.watermarkFit || 'fill'}
                          onChange={(e) => onUpdate({ ...branding, watermarkFit: e.target.value as any })}
                          className="text-xs font-bold border border-indigo-200 rounded-lg px-2.5 py-1 bg-white text-indigo-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="fill">Exact 100% Page Fit (Fill Edges)</option>
                          <option value="cover">Proportional Cover (Crop Excess)</option>
                          <option value="contain">Fit Proportional (Contain)</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sliders for Size and Opacity */}
              <div className={`grid ${branding.watermarkLayout === 'full_page' && branding.watermarkType === 'logo' ? 'grid-cols-1' : 'grid-cols-2'} gap-3 text-xs font-bold text-slate-600 pt-2 border-t border-dashed border-slate-200`}>
                {!(branding.watermarkLayout === 'full_page' && branding.watermarkType === 'logo') && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px]">Stamp Size:</span>
                      <span className="font-mono text-indigo-600 font-black">{branding.watermarkSize || (branding.watermarkType === 'logo' ? 320 : 120)}px</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="1200"
                      step="10"
                      value={branding.watermarkSize || (branding.watermarkType === 'logo' ? 320 : 120)}
                      onChange={(e) => onUpdate({ ...branding, watermarkSize: parseInt(e.target.value) })}
                      className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px]">Opacity:</span>
                    <span className="font-mono text-indigo-600 font-black">{Math.round((branding.watermarkOpacity ?? 0.08) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.40"
                    step="0.01"
                    value={branding.watermarkOpacity ?? 0.08}
                    onChange={(e) => onUpdate({ ...branding, watermarkOpacity: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Live Watermark Simulation Preview (Right 5 Cols) */}
            <div className="md:col-span-5 p-4 bg-white rounded-xl border border-slate-200 flex flex-col justify-between shadow-2xs">
              <div>
                <span className="text-[10px] font-black text-slate-700 block uppercase tracking-wide mb-2.5">
                  Live Watermark Stamp Preview
                </span>
                <div className="relative w-full h-56 bg-slate-50/50 border border-slate-200 rounded-lg p-3 overflow-hidden flex flex-col justify-between">
                  {/* Sample Header */}
                  <div className="flex justify-between items-center border-b pb-1.5 text-[9px] text-slate-400 font-bold">
                    <span>ACADEMIC REPORT CARD</span>
                    <span>{branding.session || '2024-2025'}</span>
                  </div>

                  {/* Watermark in background */}
                  {branding.showWatermark && (
                    <div className={`absolute inset-0 pointer-events-none select-none overflow-hidden z-0 ${
                      branding.watermarkLayout === 'full_page' && branding.watermarkType === 'logo'
                        ? 'w-full h-full'
                        : 'flex items-center justify-center'
                    }`}>
                      {branding.watermarkType === 'logo' ? (
                        (branding.watermarkLogoUrl || branding.logoUrl) ? (
                          <img
                            src={normalizeExternalImageUrl(branding.watermarkLogoUrl || branding.logoUrl)}
                            alt="Watermark Stamp"
                            className="pointer-events-none select-none"
                            style={
                              branding.watermarkLayout === 'full_page'
                                ? {
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: (branding.watermarkFit || 'fill') as any,
                                    opacity: branding.watermarkOpacity ?? 0.08
                                  }
                                : {
                                    objectFit: 'contain',
                                    maxHeight: '85%',
                                    maxWidth: '85%',
                                    opacity: branding.watermarkOpacity ?? 0.08,
                                    width: `${Math.min(170, (branding.watermarkSize || 320) * 0.45)}px`,
                                    height: `${Math.min(170, (branding.watermarkSize || 320) * 0.45)}px`
                                  }
                            }
                            referrerPolicy="no-referrer"
                          />
                        ) : null
                      ) : (
                        <span
                          className="font-black uppercase rotate-[-25deg] tracking-widest text-center select-none font-sans"
                          style={{
                            opacity: branding.watermarkOpacity ?? 0.08,
                            color: 'rgb(17, 24, 39)',
                            fontSize: `${Math.min(26, (branding.watermarkSize || 120) * 0.22)}px`
                          }}
                        >
                          {branding.watermarkText || branding.schoolName || 'WATERMARK'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Sample Marks Table Mock */}
                  <div className="relative z-10 space-y-1 my-auto">
                    <table className="w-full text-[8px] border-collapse bg-white/80 backdrop-blur-[1px] rounded shadow-2xs">
                      <thead>
                        <tr className="border-b text-slate-600 bg-slate-100/80">
                          <th className="p-0.5 text-left font-bold">Subject</th>
                          <th className="p-0.5 text-center font-bold">Marks</th>
                          <th className="p-0.5 text-center font-bold">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                        <tr><td className="p-0.5">Mathematics</td><td className="p-0.5 text-center font-mono">94/100</td><td className="p-0.5 text-center font-bold text-emerald-600">A1</td></tr>
                        <tr><td className="p-0.5">Science</td><td className="p-0.5 text-center font-mono">89/100</td><td className="p-0.5 text-center font-bold text-emerald-600">A2</td></tr>
                        <tr><td className="p-0.5">English Core</td><td className="p-0.5 text-center font-mono">92/100</td><td className="p-0.5 text-center font-bold text-emerald-600">A1</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Sample Footer */}
                  <div className="flex justify-between items-center text-[7.5px] text-slate-400 border-t pt-1 font-semibold">
                    <span>Principal Signature</span>
                    <span className="font-mono text-[7px] text-emerald-600">Verified Stamp</span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 mt-2 text-center">
                This watermark preview shows live appearance behind report card grades.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Font & Header Typography Section */}
      <div className="border-t border-gray-100 pt-5 space-y-4">

        <div>
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-indigo-600" />
            Header Elements Font &amp; Size Customization
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Increase or decrease font-sizes, select custom typography, and see real-time preview updates for report card headers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* School Name Customization */}
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-3.5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-indigo-700 block mb-2">School Name Typography</span>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-600">Font Size:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...branding, schoolNameFontSize: Math.max(12, ((branding.schoolNameFontSize || 26) - 1)) })}
                      className="w-6 h-6 rounded bg-white border border-gray-200 text-gray-700 font-black hover:bg-gray-100 active:scale-95 flex items-center justify-center text-xs shadow-2xs"
                      title="Decrease font size"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="12"
                      max="64"
                      value={branding.schoolNameFontSize || 26}
                      onChange={(e) => onUpdate({ ...branding, schoolNameFontSize: parseInt(e.target.value) || 26 })}
                      className="w-13 text-center px-1 py-0.5 border border-gray-200 rounded text-xs font-mono font-bold bg-white text-indigo-650"
                    />
                    <span className="text-[10px] text-gray-500 font-medium">px</span>
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...branding, schoolNameFontSize: Math.min(64, ((branding.schoolNameFontSize || 26) + 1)) })}
                      className="w-6 h-6 rounded bg-white border border-gray-200 text-gray-700 font-black hover:bg-gray-100 active:scale-95 flex items-center justify-center text-xs shadow-2xs"
                      title="Increase font size"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="12"
                  max="64"
                  step="1"
                  value={branding.schoolNameFontSize || 26}
                  onChange={(e) => onUpdate({ ...branding, schoolNameFontSize: parseInt(e.target.value) })}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <label className="text-xs font-semibold text-gray-600 block">Font Family:</label>
              <select
                name="schoolNameFontFamily"
                value={branding.schoolNameFontFamily || "Georgia, serif"}
                onChange={(e) => onUpdate({ ...branding, schoolNameFontFamily: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              >
                <option value="Georgia, serif">Georgia (Classic Serif)</option>
                <option value="'Inter', sans-serif">Inter (Clean Modern Sans)</option>
                <option value="'JetBrains Mono', monospace">JetBrains Mono (Tech Mono)</option>
                <option value="'Times New Roman', Times, serif">Times New Roman (Elegant Roman)</option>
                <option value="Arial, Helvetica, sans-serif">Arial / Helvetica (Standard Sans)</option>
                <option value="'Trebuchet MS', sans-serif">Trebuchet MS (Soft Stylish Sans)</option>
                <option value="'Courier New', Courier, monospace">Courier New (Classic Custom Typewriter)</option>
                <option value="'Brush Script MT', cursive">Brush Script MT (Dynamic Script)</option>
                <option value="'Impact', Charcoal, sans-serif">Impact (Bold Block Grotesk)</option>
                <option value="'Garamond', serif">Garamond (Exquisite Vintage Serif)</option>
              </select>
            </div>
          </div>

          {/* Sub Header Elements Customization */}
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-3.5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-indigo-700 block mb-2">Tagline, Address &amp; Info</span>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-600">Font Size:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...branding, headerDetailsFontSize: Math.max(7, Number(((branding.headerDetailsFontSize || 10.5) - 0.5).toFixed(1))) })}
                      className="w-6 h-6 rounded bg-white border border-gray-200 text-gray-700 font-black hover:bg-gray-100 active:scale-95 flex items-center justify-center text-xs shadow-2xs"
                      title="Decrease font size"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="7"
                      max="28"
                      step="0.5"
                      value={branding.headerDetailsFontSize || 10.5}
                      onChange={(e) => onUpdate({ ...branding, headerDetailsFontSize: parseFloat(e.target.value) || 10.5 })}
                      className="w-13 text-center px-1 py-0.5 border border-gray-200 rounded text-xs font-mono font-bold bg-white text-indigo-650"
                    />
                    <span className="text-[10px] text-gray-500 font-medium">px</span>
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...branding, headerDetailsFontSize: Math.min(28, Number(((branding.headerDetailsFontSize || 10.5) + 0.5).toFixed(1))) })}
                      className="w-6 h-6 rounded bg-white border border-gray-200 text-gray-700 font-black hover:bg-gray-100 active:scale-95 flex items-center justify-center text-xs shadow-2xs"
                      title="Increase font size"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="7"
                  max="28"
                  step="0.5"
                  value={branding.headerDetailsFontSize || 10.5}
                  onChange={(e) => onUpdate({ ...branding, headerDetailsFontSize: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <label className="text-xs font-semibold text-gray-650 block">Font Family:</label>
              <select
                name="headerDetailsFontFamily"
                value={branding.headerDetailsFontFamily || "sans-serif"}
                onChange={(e) => onUpdate({ ...branding, headerDetailsFontFamily: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              >
                <option value="sans-serif">Default System Sans</option>
                <option value="'Inter', sans-serif">Inter (Clean Modern Sans)</option>
                <option value="Georgia, serif">Georgia (Classic Serif)</option>
                <option value="'JetBrains Mono', monospace">JetBrains Mono (Tech Mono)</option>
                <option value="'Times New Roman', Times, serif">Times New Roman (Elegant Roman)</option>
                <option value="Arial, Helvetica, sans-serif">Arial / Helvetica (Standard Sans)</option>
                <option value="'Trebuchet MS', sans-serif">Trebuchet MS (Soft Stylish Sans)</option>
                <option value="monospace">Standard Monospace</option>
                <option value="'Garamond', serif">Garamond (Exquisite Vintage Serif)</option>
              </select>
            </div>
          </div>

          {/* Report Card Title Heading Font Size */}
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-3.5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-indigo-700 block mb-2">Report Card Title Typography</span>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-600">Title Size:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...branding, reportCardTitleFontSize: Math.max(9, ((branding.reportCardTitleFontSize || 14) - 1)) })}
                      className="w-6 h-6 rounded bg-white border border-gray-200 text-gray-700 font-black hover:bg-gray-100 active:scale-95 flex items-center justify-center text-xs shadow-2xs"
                      title="Decrease title font size"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="9"
                      max="32"
                      value={branding.reportCardTitleFontSize || 14}
                      onChange={(e) => onUpdate({ ...branding, reportCardTitleFontSize: parseInt(e.target.value) || 14 })}
                      className="w-13 text-center px-1 py-0.5 border border-gray-200 rounded text-xs font-mono font-bold bg-white text-indigo-650"
                    />
                    <span className="text-[10px] text-gray-500 font-medium">px</span>
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...branding, reportCardTitleFontSize: Math.min(32, ((branding.reportCardTitleFontSize || 14) + 1)) })}
                      className="w-6 h-6 rounded bg-white border border-gray-200 text-gray-700 font-black hover:bg-gray-100 active:scale-95 flex items-center justify-center text-xs shadow-2xs"
                      title="Increase title font size"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="9"
                  max="32"
                  step="1"
                  value={branding.reportCardTitleFontSize || 14}
                  onChange={(e) => onUpdate({ ...branding, reportCardTitleFontSize: parseInt(e.target.value) })}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="p-2.5 bg-white border border-gray-200 rounded-lg text-center">
              <span className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Title Preview</span>
              <div 
                style={{ backgroundColor: branding.themeColor, fontSize: `${branding.reportCardTitleFontSize || 14}px` }} 
                className="text-white font-black uppercase tracking-wider px-3 py-1 rounded select-none inline-block max-w-full truncate"
              >
                {branding.reportCardTitle || "Annual Examination Report Card"}
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Header Live Visualizer */}
        <div className="mt-4 p-5 bg-white border-2 border-dashed border-indigo-200 rounded-2xl space-y-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live School Header Preview (Instant Reflection)
            </span>
            <span className="text-[10px] text-gray-500 font-medium">Updates directly in Report Cards</span>
          </div>

          <div className="p-4 bg-white border rounded-xl shadow-xs text-center relative overflow-hidden" style={{ borderColor: branding.borderColor || branding.themeColor }}>
            <div className="flex flex-col items-center justify-center space-y-1">
              <h1 
                className="font-black tracking-tight text-center leading-snug"
                style={{
                  color: branding.themeColor,
                  fontSize: `${branding.schoolNameFontSize || 26}px`,
                  fontFamily: branding.schoolNameFontFamily || "Georgia, serif"
                }}
              >
                {branding.schoolName || "DEMO PUBLIC SCHOOL"}
              </h1>

              {branding.tagline && (
                <p 
                  className="font-bold text-gray-700 text-center tracking-wide uppercase"
                  style={{
                    fontSize: `${branding.headerDetailsFontSize || 10.5}px`,
                    fontFamily: branding.headerDetailsFontFamily || "sans-serif"
                  }}
                >
                  {branding.tagline}
                </p>
              )}

              {branding.address && (
                <p 
                  className="font-semibold text-gray-500 text-center tracking-medium max-w-lg"
                  style={{
                    fontSize: `${branding.headerDetailsFontSize || 10.5}px`,
                    fontFamily: branding.headerDetailsFontFamily || "sans-serif"
                  }}
                >
                  {branding.address}
                </p>
              )}

              {(branding.helpline || branding.email || branding.website) && (
                <>
                  <div className="w-[70%] border-t h-px opacity-60 my-1" style={{ borderColor: branding.themeColor }}></div>
                  <p 
                    className="font-bold text-gray-700 text-center whitespace-normal"
                    style={{
                      fontSize: `${Math.max(8, (branding.headerDetailsFontSize || 10.5) - 1.5)}px`,
                      fontFamily: branding.headerDetailsFontFamily || "sans-serif"
                    }}
                  >
                    {[
                      branding.helpline && `Helpline: ${branding.helpline}`,
                      branding.email && `Email: ${branding.email}`,
                      branding.website && `Website: ${branding.website}`
                    ].filter(Boolean).join(" | ")}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary & Attendance Headings Config */}
      <div className="border-t border-gray-100 pt-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-indigo-600" />
          Summary &amp; Attendance Headings Config
        </h3>
        <p className="text-xs text-gray-550">
          Customize the main text headings and labels printed in the scholastic summary section and the overall results panel.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-gray-50 p-4 border border-gray-100 rounded-xl">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">Scholastic Summary Heading</label>
            <input
              type="text"
              name="scholasticSummaryLabel"
              value={branding.scholasticSummaryLabel || ""}
              onChange={hndChange}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-slate-800 font-semibold"
              placeholder="Scholastic Summary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">Working Attendance Heading</label>
            <input
              type="text"
              name="attendanceLabel"
              value={branding.attendanceLabel || ""}
              onChange={hndChange}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-slate-800 font-semibold"
              placeholder="Working Attendance"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">Total Marks Obtained Heading</label>
            <input
              type="text"
              name="totalMarksObtainedLabel"
              value={branding.totalMarksObtainedLabel || ""}
              onChange={hndChange}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-slate-800 font-semibold"
              placeholder="Total Marks Obtained"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">Overall Percentage Heading</label>
            <input
              type="text"
              name="gradePercentageLabel"
              value={branding.gradePercentageLabel || ""}
              onChange={hndChange}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-slate-800 font-semibold"
              placeholder="Overall Percentage"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">Overall Grade Heading</label>
            <input
              type="text"
              name="boardGradeLabel"
              value={branding.boardGradeLabel || ""}
              onChange={hndChange}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-slate-800 font-semibold"
              placeholder="Overall Grade"
            />
          </div>
        </div>
      </div>

      {/* Design-Specific Layout Toggles */}
      <div className="border-t border-gray-100 pt-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-indigo-600" />
          Design &amp; Layout Toggles
        </h3>
        <p className="text-xs text-gray-500">
          Enable or disable specific report card components and layout blocks dynamically.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 border border-gray-100 rounded-xl">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="brand_toggle_student_photo"
              checked={branding.studentPhotoDisabled !== true}
              onChange={(e) => onUpdate({ ...branding, studentPhotoDisabled: !e.target.checked })}
              className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
            />
            <div className="space-y-0.5">
              <label htmlFor="brand_toggle_student_photo" className="text-xs font-bold text-gray-800 cursor-pointer select-none">
                Show Student Profile Photo
              </label>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Toggle the student profile photo box. When disabled, the student details block stretches to fill the full width of the header.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="brand_toggle_congratulations"
              checked={branding.congratulationsDisabled !== true}
              onChange={(e) => onUpdate({ ...branding, congratulationsDisabled: !e.target.checked })}
              className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
            />
            <div className="space-y-0.5">
              <label htmlFor="brand_toggle_congratulations" className="text-xs font-bold text-gray-800 cursor-pointer select-none">
                Show Congratulations / Promotion Box
              </label>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Toggle the congratulations or promotion box. When disabled, the Teacher's Remarks section expands to fill full width.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Parents Portal Lock Screen Custom Messages */}
      <div className="border-t border-gray-100 pt-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-indigo-600" />
          Parents Portal Lock Screen Messages
        </h3>
        <p className="text-xs text-gray-550">
          Customize the texts displayed when academic results are on hold.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 border border-gray-100 rounded-xl">
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Lock Title</label>
            <input
              type="text"
              name="lockScreenTitle"
              value={branding.lockScreenTitle || "PTM Academic Results On Hold"}
              onChange={(e) => onUpdate({ ...branding, lockScreenTitle: e.target.value })}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-slate-800 font-bold"
              placeholder="e.g. PTM Academic Results On Hold"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Lock Description</label>
            <textarea
              name="lockScreenDesc"
              value={branding.lockScreenDesc || "The school administration has scheduled results or parents digital dashboard modules as scheduled or currently on hold. Online score sheets and benchmarks will open once results are published."}
              onChange={(e) => onUpdate({ ...branding, lockScreenDesc: e.target.value })}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-slate-800 font-semibold min-h-[65px]"
              placeholder="Lock screen details/reason description..."
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Footer Helpline Note</label>
            <input
              type="text"
              name="lockScreenFooter"
              value={branding.lockScreenFooter || "Please check back later or get in touch with your classroom teachers for offline copy inquiries."}
              onChange={(e) => onUpdate({ ...branding, lockScreenFooter: e.target.value })}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-slate-800 font-medium"
              placeholder="Helpline footer note..."
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 block">Brand Focus Accent Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              name="themeColor"
              value={branding.themeColor || "#4f46e5"}
              onChange={hndChange}
              id="brand_theme_color"
              className="w-12 h-10 border border-gray-200 rounded-lg cursor-pointer bg-transparent"
            />
            <span className="text-xs font-mono font-semibold text-gray-600 uppercase">{branding.themeColor || "#4f46e5"}</span>
          </div>
          <p className="text-[10px] text-gray-400">Controls core borders line decorations, headers and main badges of the card.</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 block">Double Frame Border Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              name="borderColor"
              value={branding.borderColor || "#D12121"}
              onChange={hndChange}
              id="brand_border_color"
              className="w-12 h-10 border border-gray-200 rounded-lg cursor-pointer bg-transparent"
            />
            <span className="text-xs font-mono font-semibold text-gray-600 uppercase">{branding.borderColor || "#D12121"}</span>
          </div>
          <p className="text-[10px] text-gray-400">Controls the outer dual-line boundary borders around the card canvas.</p>
        </div>
      </div>

      {/* Bottom Sticky-style Action / Save Footer Bar */}
      <div className="border-t border-gray-150 pt-5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-xl">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <CloudUpload className="w-4 h-4 text-indigo-600" />
          <span>All header text fields, font scales, and brand colors are persistent &amp; synced across every student report card format.</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleManualSave}
            disabled={isSaving}
            id="btn_save_branding_bottom"
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer ${
              showSavedState
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white'
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving Changes...
              </>
            ) : showSavedState ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                Saved Permanently &amp; Synced!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save School Identity &amp; Header Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
