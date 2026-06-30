import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Home, PlusCircle, Settings, Calendar, Droplet, Sparkles, ChevronRight, ArrowRight, BookOpen, Check, MessageCircle, Activity, Coffee, Moon, X, LogOut, CreditCard, HelpCircle, Phone, Eye, EyeOff } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import CalendarView from './CalendarView';
import ChatView from './ChatView';
import { generateCycleInsights } from './services/geminiService';

import { useAppContext } from './AppContext';

const DropletLogo = ({ className, innerColor = "white" }: { className?: string, innerColor?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2C12 2 5 9 5 14.5C5 18.366 8.13401 21.5 12 21.5C15.866 21.5 19 18.366 19 14.5C19 9 12 2 12 2Z" fill="currentColor" />
    <circle cx="9.5" cy="14.5" r="1.5" fill={innerColor} />
    <circle cx="14.5" cy="15.5" r="1.5" fill={innerColor} />
    <circle cx="12" cy="18.5" r="1.5" fill={innerColor} />
    <circle cx="11.5" cy="11.5" r="1" fill={innerColor} />
    <path d="M9.5 14.5L12 18.5L14.5 15.5" stroke={innerColor} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.5 14.5L11.5 11.5L14.5 15.5" stroke={innerColor} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function getCycleData(periodDates: string[], todayStr: string) {
  if (periodDates.length === 0) {
    return { phase: 'Unknown', cycleDay: 0, nextPeriodIn: 0, avgCycle: 28 };
  }

  const sorted = [...periodDates].sort();
  const starts: string[] = [];
  sorted.forEach(dateStr => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const prevD = new Date(y, m - 1, d - 1);
    const prevDayStr = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-${String(prevD.getDate()).padStart(2, '0')}`;
    if (!periodDates.includes(prevDayStr)) {
      starts.push(dateStr);
    }
  });

  if (starts.length === 0) {
    return { phase: 'Unknown', cycleDay: 0, nextPeriodIn: 0, avgCycle: 28 };
  }

  const latestStart = starts[starts.length - 1];
  const [ly, lm, ld] = latestStart.split('-').map(Number);
  const latestStartD = new Date(ly, lm - 1, ld).getTime();
  
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayD = new Date(ty, tm - 1, td).getTime();

  const diffDays = Math.floor((todayD - latestStartD) / (1000 * 60 * 60 * 24));
  
  const cycleDay = diffDays >= 0 ? diffDays + 1 : 0;
  
  const avgPeriodLength = Math.max(1, Math.round(periodDates.length / starts.length));
  const estimatedOvulationDay = avgPeriodLength + 9;
  
  let phase = 'Follicular';
  if (periodDates.includes(todayStr)) {
    phase = 'Menstruation';
  } else if (cycleDay >= estimatedOvulationDay - 5 && cycleDay <= estimatedOvulationDay) {
    phase = 'Ovulation';
  } else if (cycleDay > estimatedOvulationDay) {
    phase = 'Luteal';
  }

  const nextPeriodIn = 28 - ((cycleDay - 1) % 28);

  return { phase, cycleDay, nextPeriodIn, avgCycle: 28 };
}

function computeInsightScore(log: any | null): number {
  if (!log) return 0;
  let score = 0;

  if (Array.isArray(log.symptoms) && log.symptoms.length > 0) score += 20;
  if (log.pain !== null && log.pain !== undefined) score += 20;
  if (typeof log.mood === 'string' && log.mood.trim().length > 0) score += 20;
  if (typeof log.notes === 'string' && log.notes.trim().length > 0) score += 20;
  if (typeof log.flow === 'string' && log.flow.trim().length > 0) score += 20;

  return Math.max(0, Math.min(100, score));
}

function formatFlowLabel(flow: string | null | undefined) {
  if (!flow) return '';
  return flow.charAt(0).toUpperCase() + flow.slice(1);
}

function useResponsiveLayout() {
  const { layout } = useAppContext();
  const [autoIsMobile, setAutoIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (!('matchMedia' in window)) return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const [autoNoHover, setAutoNoHover] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (!('matchMedia' in window)) return false;
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  });

  useEffect(() => {
    if (!('matchMedia' in window)) return;
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => setAutoIsMobile(e.matches);

    setAutoIsMobile(mql.matches);

    if ('addEventListener' in mql) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }

    const legacyMql = mql as unknown as { addListener: (cb: (e: MediaQueryListEvent) => void) => void; removeListener: (cb: (e: MediaQueryListEvent) => void) => void };
    legacyMql.addListener(onChange);
    return () => legacyMql.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (!('matchMedia' in window)) return;
    const mql = window.matchMedia('(hover: none) and (pointer: coarse)');
    const onChange = (e: MediaQueryListEvent) => setAutoNoHover(e.matches);

    setAutoNoHover(mql.matches);

    if ('addEventListener' in mql) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }

    const legacyMql = mql as unknown as { addListener: (cb: (e: MediaQueryListEvent) => void) => void; removeListener: (cb: (e: MediaQueryListEvent) => void) => void };
    legacyMql.addListener(onChange);
    return () => legacyMql.removeListener(onChange);
  }, []);

  const effectiveLayout = layout === 'auto' ? (autoIsMobile ? 'mobile' : 'desktop') : layout;
  return {
    effectiveLayout,
    isMobile: effectiveLayout === 'mobile',
    isDesktop: effectiveLayout === 'desktop',
    autoNoHover,
  };
}

function HomeView({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const { logs, periodDates, language, t } = useAppContext();
  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
  const todaysLog = logs[todayStr];

  const { phase, cycleDay, nextPeriodIn } = getCycleData(periodDates, todayStr);

  const [aiData, setAiData] = useState<{
    summary: string;
    carePlan: { activity: string; nutrition: string; selfCare: string };
  } | null>(null);

  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    const fetchInsights = async () => {
      setLoadingAi(true);
      const data = await generateCycleInsights(phase, cycleDay, todaysLog, language);
      if (data) {
        setAiData(data);
      }
      setLoadingAi(false);
    };
    fetchInsights();
  }, [phase, cycleDay, todaysLog, language]);

  // Fallback data if AI fails or is loading
  const getDefaultSummary = (p: string) => {
    switch (p) {
      case 'Menstruation': return t('defaultSummaryMenstruation');
      case 'Follicular': return t('defaultSummaryFollicular');
      case 'Ovulation': return t('defaultSummaryOvulation');
      case 'Luteal': return t('defaultSummaryLuteal');
      default: return t('defaultSummaryUnknown');
    }
  };
  const defaultCarePlan = {
    activity: t('defaultCareActivity'),
    nutrition: t('defaultCareNutrition'),
    selfCare: t('defaultCareSelfCare')
  };

  const summary = aiData?.summary || getDefaultSummary(phase);
  const carePlan = aiData?.carePlan || defaultCarePlan;

  // Daily Tip Logic
  const getDailyTip = (p: string) => {
    switch (p) {
      case 'Menstruation': return t('dailyTipMenstruation');
      case 'Follicular': return t('dailyTipFollicular');
      case 'Ovulation': return t('dailyTipOvulation');
      case 'Luteal': return t('dailyTipLuteal');
      default: return t('dailyTipUnknown');
    }
  };

  const dailyTip = getDailyTip(phase);

  const insightScore = computeInsightScore(todaysLog ?? null);

  // Calculate progress for the cycle bar
  // Assuming 28 day cycle for visualization
  const cycleLength = 28;
  const progressPercent = Math.min(100, Math.max(0, ((cycleDay - 1) / cycleLength) * 100));

  return (
    <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-8 lg:text-[15px]">
      <div className="mx-auto w-full max-w-5xl 2xl:max-w-6xl space-y-6">
      {/* Status Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white/95 backdrop-blur-sm border border-white/20 p-4 rounded-3xl shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-16 h-16 bg-rose-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 relative z-10">{t('phase')}</p>
          <p className="text-xl font-semibold text-stone-800 relative z-10">{phase}</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm border border-white/20 p-4 rounded-3xl shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1 relative z-10">{t('cycleDay')}</p>
          <p className="text-xl font-semibold text-stone-800 relative z-10">{cycleDay}</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm border border-white/20 p-4 rounded-3xl shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1 relative z-10">{t('nextPeriod')}</p>
          <p className="text-xl font-semibold text-stone-800 relative z-10">{t('inDaysTemplate').replace('{n}', String(nextPeriodIn))}</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm border border-white/20 p-4 rounded-3xl shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1 relative z-10">{t('insightScore')}</p>
          <p className="text-xl font-semibold text-stone-800 relative z-10">{insightScore} / 100</p>
        </div>
      </section>

      {/* Cycle Prediction */}
      <section className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-[2rem] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-stone-800 flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            {t('cycleTracker')}
          </h2>
          <button onClick={() => setActiveTab('calendar')} className="text-stone-400 hover:text-primary bg-stone-50 p-1.5 rounded-full transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
        
        <div className="relative h-6 bg-stone-100 rounded-full overflow-hidden mb-4 shadow-inner">
          {/* Segments with Tooltips */}
          <div className="absolute top-0 left-0 h-full bg-rose-400 w-[18%] group cursor-help">
            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-0 mb-2 bg-stone-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity pointer-events-none">{t('menstruation')}</div>
          </div>
          <div className="absolute top-0 left-[18%] h-full bg-sky-100 w-[32%] group cursor-help">
            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-0 mb-2 bg-stone-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity pointer-events-none">{t('follicular')}</div>
          </div>
          <div className="absolute top-0 left-[50%] h-full bg-sky-300 w-[7%] group cursor-help">
            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-0 mb-2 bg-stone-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity pointer-events-none">{t('ovulation')}</div>
          </div>
          <div className="absolute top-0 left-[57%] h-full bg-indigo-100 w-[43%] group cursor-help">
            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-0 mb-2 bg-stone-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity pointer-events-none">{t('luteal')}</div>
          </div>
          
          {/* Current Day Indicator */}
          <div 
            className="absolute top-0 h-full w-1 bg-primary shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10 transition-all duration-1000 ease-out"
            style={{ left: `${progressPercent}%` }}
          >
            <div className="absolute -top-1.5 -left-2 w-5 h-9 bg-primary rounded-full border-2 border-white shadow-md flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between text-[10px] font-bold tracking-wide uppercase text-stone-400 px-1">
          <span className="text-rose-400">{t('period')}</span>
          <span className="text-sky-400">{t('follicular')}</span>
          <span className="text-sky-600">{t('ovulation')}</span>
          <span className="text-indigo-400">{t('luteal')}</span>
        </div>
      </section>

      {/* Period Entry & History */}
      <section className="bg-primary-dark text-white rounded-[2rem] p-6 shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2 text-lg">
              <Droplet size={20} className="text-primary-light fill-primary-light/20" />
              {t('periodLog')}
            </h2>
          </div>
          
          {todaysLog ? (
            <div className="mb-6">
              <p className="text-white/80 text-sm mb-3 leading-relaxed">
                {t('youLoggedToday')}
              </p>
              <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {todaysLog.mood && (
                    <div className="bg-white/10 rounded-lg p-3">
                      <span className="text-xs text-white/60 block mb-1 uppercase tracking-wider font-medium">{t('mood')}</span>
                      <p className="text-sm font-medium">{todaysLog.mood}</p>
                    </div>
                  )}
                  <div className="bg-white/10 rounded-lg p-3">
                    <span className="text-xs text-white/60 block mb-1 uppercase tracking-wider font-medium">{t('pain')}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white" style={{ width: `${(todaysLog.pain / 10) * 100}%` }}></div>
                      </div>
                      <span className="text-sm font-medium">{todaysLog.pain}/10</span>
                    </div>
                  </div>
                  {todaysLog.flow && (
                    <div className="bg-white/10 rounded-lg p-3">
                      <span className="text-xs text-white/60 block mb-1 uppercase tracking-wider font-medium">Flow</span>
                      <p className="text-sm font-medium">{formatFlowLabel(todaysLog.flow)}</p>
                    </div>
                  )}
                </div>
                {todaysLog.symptoms.length > 0 && (
                  <div className="bg-white/10 rounded-lg p-3">
                    <span className="text-xs text-white/60 block mb-1 uppercase tracking-wider font-medium">{t('symptoms')}</span>
                    <p className="text-sm font-medium leading-relaxed">{todaysLog.symptoms.join(', ')}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-white/80 text-sm mb-6 leading-relaxed">
              Log your symptoms and flow today to improve AI predictions.
            </p>
          )}

          <div className="flex gap-3">
            <button 
              onClick={() => setActiveTab('log')}
              className="flex-1 bg-white hover:bg-stone-100 text-primary-dark py-3.5 px-4 rounded-2xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-black/5"
            >
              {todaysLog ? t('editLog') : (
                <>
                  <PlusCircle size={18} />
                  {t('logToday')}
                </>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('calendar')}
              className="flex-1 bg-white/15 hover:bg-white/25 text-white py-3.5 px-4 rounded-2xl font-medium transition-colors flex items-center justify-center gap-2 backdrop-blur-sm"
            >
              <Calendar size={18} />
              {t('history')}
            </button>
          </div>
        </div>
      </section>

      {/* Phase Care Plan */}
      <section className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-[2rem] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-stone-800 flex items-center gap-2">
            <BookOpen size={18} className="text-emerald-500" />
            {t('yourCarePlan')}
          </h2>
          {loadingAi && <span className="text-xs text-stone-400 animate-pulse">{t('updating')}</span>}
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100/50 hover:bg-stone-100 transition-colors">
            <div className="bg-white p-2.5 rounded-xl shadow-sm text-xl shrink-0 text-emerald-500">
              <Activity size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-stone-800">{t('activity')}</h3>
              <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                {carePlan.activity}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100/50 hover:bg-stone-100 transition-colors">
            <div className="bg-white p-2.5 rounded-xl shadow-sm text-xl shrink-0 text-orange-500">
              <Coffee size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-stone-800">{t('nutrition')}</h3>
              <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                {carePlan.nutrition}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100/50 hover:bg-stone-100 transition-colors">
            <div className="bg-white p-2.5 rounded-xl shadow-sm text-xl shrink-0 text-indigo-500">
              <Moon size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-stone-800">{t('selfCare')}</h3>
              <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                {carePlan.selfCare}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Tip */}
      <section className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-[2rem] p-5 shadow-sm relative overflow-hidden">
        <div className="flex items-start gap-4 relative z-10">
          <div className="bg-white p-3 rounded-2xl shadow-sm text-indigo-500 shrink-0">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="font-bold text-stone-800 mb-1">{t('dailyTip')}</h3>
            <p className="text-sm text-stone-600 leading-relaxed">{dailyTip}</p>
          </div>
        </div>
      </section>

      {/* AI Summary */}
      <section className="bg-primary-light/90 backdrop-blur-sm border border-primary-light rounded-[2rem] p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Sparkles size={100} />
        </div>
        <h2 className="font-semibold text-secondary-dark mb-3 flex items-center gap-2 relative z-10">
          <Sparkles size={16} className="text-primary" />
          {t('aiSummary')}
        </h2>
        <p className="text-sm text-secondary-dark/80 leading-relaxed relative z-10">
          {loadingAi ? t('analyzingCycle') : summary}
        </p>
      </section>
      </div>
    </main>
  );
}

function LogView({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const { logs, saveLog, periodDates, t } = useAppContext();
  
  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
  
  const existingLog = logs[todayStr];

  const { phase, cycleDay } = getCycleData(periodDates, todayStr);

  const [symptoms, setSymptoms] = useState<string[]>(existingLog?.symptoms || []);
  const [pain, setPain] = useState(existingLog?.pain || 0);
  const [mood, setMood] = useState(existingLog?.mood || '');
  const [notes, setNotes] = useState(existingLog?.notes || '');
  const [flow, setFlow] = useState<'spotting' | 'light' | 'medium' | 'heavy' | ''>(existingLog?.flow || '');

  const availableSymptoms = ['Cramps', 'Bloating', 'Headache', 'Fatigue', 'Acne', 'Nausea', 'Backache', 'Tender Breasts'];
  const moods = [
    { emoji: '😊', label: 'Happy' },
    { emoji: '😌', label: 'Calm' },
    { emoji: '😢', label: 'Sad' },
    { emoji: '😠', label: 'Irritable' },
    { emoji: '😴', label: 'Tired' },
  ];

  const flowOptions: Array<{ value: 'spotting' | 'light' | 'medium' | 'heavy'; symbol: string; label: string }> = [
    { value: 'spotting', symbol: '🩸', label: 'Spotting' },
    { value: 'light', symbol: '💧', label: 'Light' },
    { value: 'medium', symbol: '💧💧', label: 'Medium' },
    { value: 'heavy', symbol: '🩸🩸🩸', label: 'Heavy' },
  ];

  const flowSymbols: Record<'spotting' | 'light' | 'medium' | 'heavy', number> = {
    spotting: 1,
    light: 2,
    medium: 3,
    heavy: 4,
  };

  const toggleSymptom = (s: string) => {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const insightScore = computeInsightScore(existingLog ?? null);

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    saveLog({
      date: todayStr,
      symptoms,
      pain,
      mood,
      notes,
      flow
    });
    setIsSaved(true);
    setSymptoms([]);
    setPain(0);
    setMood('');
    setNotes('');
    setFlow('');
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-8 lg:text-[15px]">
      <div className="mx-auto w-full max-w-5xl 2xl:max-w-6xl space-y-6">
      
      {/* Top Context Grid (Styled exactly like Home Page) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white/95 backdrop-blur-sm border border-white/20 p-4 rounded-3xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-rose-50 rounded-bl-full -z-0"></div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 relative z-10">{t('phase')}</p>
          <p className="text-xl font-semibold text-stone-800 relative z-10">{phase}</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm border border-white/20 p-4 rounded-3xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 rounded-bl-full -z-0"></div>
          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1 relative z-10">{t('cycleDay')}</p>
          <p className="text-xl font-semibold text-stone-800 relative z-10">{cycleDay}</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm border border-white/20 p-4 rounded-3xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-0"></div>
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1 relative z-10">{t('date')}</p>
          <p className="text-xl font-semibold text-stone-800 relative z-10">{today}</p>
        </div>
          <div className="bg-white/95 backdrop-blur-sm border border-white/20 p-4 rounded-3xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-0"></div>
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1 relative z-10">{t('insightScore')}</p>
          <p className="text-xl font-semibold text-stone-800 relative z-10">{insightScore} / 100</p>
        </div>
      </section>

      {/* Smart Daily Log Box */}
      <section className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-[2rem] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-6 border-b border-stone-100 pb-4">
          <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
            <Sparkles size={20} className="text-primary" />
            {t('dailyLog')}
          </h2>
          <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">{t('today')}</span>
        </div>

        <div className="space-y-6">
          {/* Symptoms */}
          <div className="border-b border-stone-100 pb-6">
            <h3 className="font-semibold text-stone-800 mb-4 text-base">{t('symptoms')}</h3>
            <div className="flex flex-wrap gap-2">
              {availableSymptoms.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSymptom(s)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    symptoms.includes(s) 
                      ? 'bg-primary text-white shadow-md shadow-primary/20 scale-105' 
                      : 'bg-stone-50 text-stone-600 border border-stone-100 hover:bg-stone-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Pain Level */}
          <div className="border-b border-stone-100 pb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-stone-800 text-base">{t('painLevel')}</h3>
              <span className="text-primary text-sm font-bold bg-primary/10 px-3 py-1 rounded-full">{pain} / 10</span>
            </div>
            <input 
              type="range" 
              min="0" max="10" 
              value={pain} 
              onChange={(e) => setPain(parseInt(e.target.value))}
              className="w-full accent-primary h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-stone-400 mt-3 font-medium uppercase tracking-wider">
              <span>{t('none')}</span>
              <span>{t('moderate')}</span>
              <span>{t('severe')}</span>
            </div>
          </div>

          {/* Mood */}
          <div className="border-b border-stone-100 pb-6">
            <h3 className="font-semibold text-stone-800 mb-4 text-base">{t('mood')}</h3>
            <div className="flex justify-between gap-2">
              {moods.map(m => (
                <button
                  key={m.label}
                  onClick={() => setMood(m.label)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all flex-1 ${
                    mood === m.label 
                      ? 'bg-primary-light scale-110 shadow-sm border border-primary-light-border' 
                      : 'bg-transparent grayscale-[0.5] opacity-60 hover:grayscale-0 hover:opacity-100'
                  }`}
                >
                  <span className="text-3xl">{m.emoji}</span>
                  <span className={`text-[10px] font-medium ${mood === m.label ? 'text-primary-dark' : 'text-stone-500'}`}>
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-b border-stone-100 pb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-stone-800 text-base">Flow Intensity</h3>
              <span className="text-primary text-sm font-bold bg-primary/10 px-3 py-1 rounded-full">
                {flow ? formatFlowLabel(flow) : 'Select'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {flowOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFlow(option.value)}
                  className={`rounded-2xl border px-4 py-4 transition-all flex flex-col items-center gap-2 ${
                    flow === option.value
                      ? 'border-primary bg-primary/10 text-primary shadow-md shadow-primary/20 scale-[1.02]'
                      : 'border-stone-100 bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <span className="flex items-center gap-1 text-primary">
                    {Array.from({ length: flowSymbols[option.value] }).map((_, idx) => (
                      <Droplet key={`${option.value}-${idx}`} size={16} className={flow === option.value ? 'fill-current opacity-100' : 'fill-current opacity-60'} />
                    ))}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="border-b border-stone-100 pb-6">
            <h3 className="font-semibold text-stone-800 mb-4 text-base">{t('notes')}</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('howAreYouFeeling')}
              className="w-full bg-stone-50 border border-stone-100 rounded-2xl p-4 text-base text-stone-700 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-28"
            ></textarea>
          </div>

          {/* Log Quality */}
          <div className="bg-primary-dark text-white rounded-2xl p-5 shadow-inner relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2 text-sm mb-1">
                  <Sparkles size={16} className="text-primary-light" />
                  {t('insightScore')}
                </h3>
                <p className="text-white/80 text-[10px]">{t('moreDetailsImprove')}</p>
              </div>
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-white/20"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-primary-light transition-all duration-500 ease-out"
                    strokeDasharray={`${insightScore}, 100`}
                    strokeWidth="3"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-xs font-bold">{insightScore}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <button 
        onClick={handleSave}
        className={`w-full text-white font-semibold py-4 rounded-2xl shadow-lg transition-colors flex justify-center items-center gap-2 ${isSaved ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-primary shadow-primary/30 hover:bg-primary-hover'}`}
      >
        <Check size={20} />
        {isSaved ? t('saved') : t('saveDailyLog')}
      </button>
      </div>
    </main>
  );
}

function HelpView() {
  const { t } = useAppContext();
  const faqs = [
    { q: t('faq1Q'), a: t('faq1A') },
    { q: t('faq2Q'), a: t('faq2A') },
    { q: t('faq3Q'), a: t('faq3A') },
  ];

  return (
    <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-8 lg:text-[15px]">
      <div className="mx-auto w-full max-w-5xl 2xl:max-w-6xl space-y-6">
      <h2 className="text-2xl font-bold text-stone-800 mb-6">{t('helpSupport')}</h2>
      
      <section className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-[2rem] p-6 shadow-sm space-y-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <HelpCircle size={32} className="text-indigo-500" />
          </div>
          <h3 className="text-lg font-bold text-stone-800">{t('howCanWeHelp')}</h3>
          <p className="text-stone-500 text-sm mt-2">{t('browseFaqs')}</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-stone-100 rounded-xl p-4 bg-stone-50/50">
              <h4 className="font-semibold text-stone-800 text-sm mb-2">{faq.q}</h4>
              <p className="text-stone-600 text-xs leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-stone-100">
          <h4 className="font-semibold text-stone-800 mb-4">{t('contactUs')}</h4>
          <div className="space-y-3">
            <a href="mailto:cycletrackai123@gmail.com" className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors border border-stone-100">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                <MessageCircle size={20} />
              </div>
              <div>
                <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">{t('emailSupport')}</p>
                <p className="text-sm font-semibold text-stone-800">cycletrackai123@gmail.com</p>
              </div>
            </a>
            <a href="tel:+9779012345567" className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors border border-stone-100">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                <Phone size={20} />
              </div>
              <div>
                <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">{t('phoneSupport')}</p>
                <p className="text-sm font-semibold text-stone-800">+977 9012345567</p>
              </div>
            </a>
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}

function SettingsView() {
  const { theme, setTheme, logs, periodDates, user, language, setLanguage, notifications, setNotifications, showToast, appPin, setAppPin, t } = useAppContext();
  const [name, setName] = useState(user?.name || 'Jane Doe');
  const [email, setEmail] = useState(user?.email || 'jane@example.com');
  const [dob, setDob] = useState(user?.dob || '1995-01-01');
  const [cycleLength, setCycleLength] = useState('28');
  const [periodLength, setPeriodLength] = useState('5');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [activePinInput, setActivePinInput] = useState<'new' | 'confirm'>('new');

  const handleKeypadClick = (num: string) => {
    if (activePinInput === 'new') {
      if (newPin.length < 4) {
        const updated = newPin + num;
        setNewPin(updated);
        if (updated.length === 4) setActivePinInput('confirm');
      }
    } else {
      if (confirmPin.length < 4) setConfirmPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    if (activePinInput === 'new') {
      setNewPin(prev => prev.slice(0, -1));
    } else {
      if (confirmPin.length === 0) {
        setActivePinInput('new');
        setNewPin(prev => prev.slice(0, -1));
      } else {
        setConfirmPin(prev => prev.slice(0, -1));
      }
    }
  };

  const handleSetPin = () => {
    if (newPin.length !== 4 || confirmPin.length !== 4) {
      alert(t('pinMustBe4Digits'));
      return;
    }
    if (newPin !== confirmPin) {
      alert(t('pinsDoNotMatch'));
      return;
    }
    setAppPin(newPin);
    setPinUnlocked(true, user?.id);
    setShowPinSetup(false);
    setNewPin('');
    setConfirmPin('');
    alert(t('pinSetSuccessfully'));
  };

  const handleRemovePin = () => {
    if (window.confirm(t('confirmRemovePin'))) {
      setAppPin(null);
      setPinUnlocked(false, user?.id);
      setShowPinSetup(false);
      setNewPin('');
      setConfirmPin('');
      setActivePinInput('new');
    }
  };

  const handleNotificationsToggle = async (checked: boolean) => {
    if (!checked) {
      setNotifications(false);
      showToast(t('notificationsDisabled'));
      return;
    }

    if (!('Notification' in window)) {
      showToast(t('notificationsNotSupported'));
      setNotifications(false);
      return;
    }

    // Optimistically toggle on so the slider visibly moves.
    setNotifications(true);

    if (Notification.permission === 'granted') {
      showToast(t('notificationsEnabled'));
      new Notification(t('reminderTitle'), { body: t('notificationsEnabled') });
      return;
    }

    // If the user has previously denied, the browser won't show a prompt again.
    if (Notification.permission === 'denied') {
      showToast(t('notificationsBlocked'));
      setNotifications(false);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast(t('notificationsBlocked'));
        setNotifications(false);
        return;
      }

      showToast(t('notificationsEnabled'));
      // Quick test notification so the user knows it worked
      new Notification(t('reminderTitle'), { body: t('notificationsEnabled') });
    } catch {
      showToast(t('notificationsBlocked'));
      setNotifications(false);
    }
  };
  
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      if (user.dob) setDob(user.dob);
    }
  }, [user]);
  
  const handleSaveProfile = () => {
    setIsEditingProfile(false);
    alert(t('profileSavedSuccessfully'));
  };
  
  const handleExport = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Cycle Track AI - User Data Export", 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Name: ${name}`, 14, 32);
    doc.text(`Email: ${email}`, 14, 38);
    doc.text(`Date of Birth: ${dob}`, 14, 44);
    
    const tableData = Object.entries(logs).map(([date, log]: [string, any]) => [
      date,
      log.mood || '-',
      log.pain ? `${log.pain}/10` : '-',
      log.symptoms?.join(', ') || '-',
      log.flow || '-'
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Date', 'Mood', 'Pain', 'Symptoms', 'Flow']],
      body: tableData,
    });

    doc.save('cycle_track_data.pdf');
  };

  const handleDelete = async () => {
    if (window.confirm(t('confirmDelete1'))) {
      if (window.confirm(t('confirmDelete2'))) {
        try {
          await fetch('/api/logs/all', { method: 'DELETE', headers: { 'x-user-id': String(user?.id ?? '') } });
          await fetch('/api/period-dates', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id ?? '') }, 
            body: JSON.stringify({ dates: [] }) 
          });
          window.location.reload();
        } catch (error) {
          console.error("Failed to delete data:", error);
          alert(t('failedToDeleteData'));
        }
      }
    }
  };

  return (
    <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-8 lg:text-[15px]">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <h2 className="text-2xl font-bold text-stone-800 mb-6">{t('settings')}</h2>

      <section className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-[2rem] p-5 shadow-sm" id="profile-section">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-stone-800">{t('profile')}</h3>
          <button 
            onClick={() => {
              if (isEditingProfile) {
                handleSaveProfile();
              } else {
                setIsEditingProfile(true);
              }
            }}
            className="text-sm text-primary font-medium hover:text-primary-hover transition-colors"
          >
            {isEditingProfile ? t('done') : t('edit')}
          </button>
        </div>
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-rose-400 flex items-center justify-center text-white font-bold text-2xl shadow-md shrink-0">
            {name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div>
            {isEditingProfile ? (
              <div className="space-y-3 w-full">
                <div>
                  <label className="text-xs text-stone-500 font-medium ml-1">{t('fullName')}</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-stone-50"
                    placeholder={t('yourName')}
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 font-medium ml-1">{t('emailAddress')}</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-stone-50"
                    placeholder={t('yourEmail')}
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 font-medium ml-1">{t('dob')}</label>
                  <input 
                    type="date" 
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="block w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-stone-50"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <h3 className="font-bold text-stone-800 text-lg">{name}</h3>
                <p className="text-stone-500 text-sm">
                  {email}
                </p>
                <div className="flex gap-4 mt-3 pt-3 border-t border-stone-100">
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">{t('age')}</p>
                    <p className="text-sm font-semibold text-stone-700">{new Date().getFullYear() - new Date(dob).getFullYear()}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      
      <section className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-[2rem] p-5 shadow-sm">
        <h3 className="font-semibold text-stone-800 mb-4">{t('preferences')}</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-stone-800">{t('language')}</p>
              <p className="text-xs text-stone-500">{t('chooseLanguage')}</p>
            </div>
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'ne')}
              className="bg-stone-50 border border-stone-200 text-stone-700 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none"
            >
              <option value="en">{t('english')}</option>
              <option value="ne">{t('nepali')}</option>
            </select>
          </div>

          <div className="h-px bg-stone-100 w-full"></div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-stone-800">{t('notifications')}</p>
              <p className="text-xs text-stone-500">{t('getReminders')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={notifications}
                onChange={(e) => handleNotificationsToggle(e.target.checked)}
              />
              <div className="relative w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </section>

      <section className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-[2rem] p-5 shadow-sm">
        <h3 className="font-semibold text-stone-800 mb-4">{t('security')}</h3>
        
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-stone-800">{appPin ? t('appPinEnabled') : t('appPin')}</p>
              {appPin && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  {t('done')}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500">{appPin ? t('appProtected') : t('requirePin')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <button 
              onClick={() => {
                setShowPinSetup(!showPinSetup);
                setNewPin('');
                setConfirmPin('');
                setActivePinInput('new');
              }}
              className="text-sm text-primary font-semibold transition-colors px-3 py-2 bg-primary/10 hover:bg-primary/20 rounded-xl"
            >
              {showPinSetup ? t('cancel') : (appPin ? t('changePin') : t('setPin'))}
            </button>
            {appPin && !showPinSetup && (
              <button 
                onClick={handleRemovePin}
                className="text-sm text-red-600 font-semibold transition-colors px-3 py-2 bg-red-50 hover:bg-red-100 rounded-xl"
              >
                {t('remove')}
              </button>
            )}
          </div>
        </div>
        
        {showPinSetup && (
          <div className="space-y-4 bg-stone-50 p-4 rounded-xl border border-stone-100">
            <div className="flex justify-end">
              <button 
                onClick={() => setShowPin(!showPin)}
                className="text-stone-500 hover:text-stone-800 transition-colors"
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div>
              <label className="text-xs text-stone-500 font-medium ml-1">{t('enterPin')}</label>
              <input 
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                onFocus={() => setActivePinInput('new')}
                className={`block w-full px-3 py-2 text-sm border rounded-xl outline-none bg-white tracking-widest text-center transition-colors ${activePinInput === 'new' ? 'border-primary ring-2 ring-primary/20' : 'border-stone-200'}`}
                placeholder="••••"
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 font-medium ml-1">{t('confirmPin')}</label>
              <input 
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                onFocus={() => setActivePinInput('confirm')}
                className={`block w-full px-3 py-2 text-sm border rounded-xl outline-none bg-white tracking-widest text-center transition-colors ${activePinInput === 'confirm' ? 'border-primary ring-2 ring-primary/20' : 'border-stone-200'}`}
                placeholder="••••"
              />
            </div>
            
            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 mt-4 max-w-[240px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onClick={() => handleKeypadClick(num.toString())}
                  className="h-12 rounded-xl bg-white border border-stone-200 text-stone-800 font-semibold text-lg hover:bg-stone-50 active:bg-stone-100 transition-colors"
                >
                  {num}
                </button>
              ))}
              <div className="col-start-2">
                <button
                  onClick={() => handleKeypadClick('0')}
                  className="w-full h-12 rounded-xl bg-white border border-stone-200 text-stone-800 font-semibold text-lg hover:bg-stone-50 active:bg-stone-100 transition-colors"
                >
                  0
                </button>
              </div>
              <div className="col-start-3">
                <button
                  onClick={handleBackspace}
                  className="w-full h-12 rounded-xl bg-stone-100 border border-stone-200 text-stone-600 flex items-center justify-center hover:bg-stone-200 active:bg-stone-300 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <button 
              onClick={handleSetPin}
              disabled={newPin.length !== 4 || confirmPin.length !== 4}
              className="w-full py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50 transition-opacity mt-2"
            >
              {t('savePin')}
            </button>
          </div>
        )}
      </section>

      <section className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-[2rem] p-5 shadow-sm">
        <h3 className="font-semibold text-stone-800 mb-4">{t('themeColor')}</h3>
        <div className="flex gap-4">
          <button 
            onClick={() => setTheme('rose')} 
            className={`w-12 h-12 rounded-full bg-[#c24a72] transition-all ${theme === 'rose' ? 'ring-4 ring-[#c24a72]/30 scale-110' : 'hover:scale-105'}`}
            aria-label="Rose Theme"
          ></button>
          <button 
            onClick={() => setTheme('teal')} 
            className={`w-12 h-12 rounded-full bg-[#0d9488] transition-all ${theme === 'teal' ? 'ring-4 ring-[#0d9488]/30 scale-110' : 'hover:scale-105'}`}
            aria-label="Teal Theme"
          ></button>
          <button 
            onClick={() => setTheme('dark')} 
            className={`w-12 h-12 rounded-full bg-[#334155] transition-all ${theme === 'dark' ? 'ring-4 ring-[#334155]/30 scale-110' : 'hover:scale-105'}`}
            aria-label="Dark Theme"
          ></button>
        </div>
      </section>
      
      <section className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-[2rem] p-5 shadow-sm">
        <h3 className="font-semibold text-stone-800 mb-4">{t('dataPrivacy')}</h3>
        <div className="space-y-3">
          <button 
            onClick={handleExport}
            className="w-full text-left px-4 py-3 rounded-xl bg-stone-50 text-stone-700 font-medium hover:bg-stone-100 transition-colors"
          >
            {t('exportData')}
          </button>
          <button 
            onClick={handleDelete}
            className="w-full text-left px-4 py-3 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors"
          >
            {t('deleteAllData')}
          </button>
        </div>
      </section>
      </div>
    </main>
  );
}

function LandingPage({ onLogin }: { onLogin: (isSignup: boolean) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { setUser, t } = useAppContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && (!name || !dob))) {
      alert(t('fillInAllFields'));
      return;
    }

    try {
      const endpoint = isLogin ? '/api/login' : '/api/signup';
      const body = isLogin ? { email, password } : { name, email, password, dob };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (res.ok) {
        setUser(data.user);
        onLogin(!isLogin);
      } else {
        if (isLogin && res.status === 401) {
          alert(t('accountNotAvailable'));
        } else {
          alert(data.error || t('authError'));
        }
      }
    } catch (error) {
      console.error("Auth error:", error);
      alert(t('authError'));
    }
  };

  return (
    <div className="min-h-screen flex font-sans bg-white theme-locked">
      {/* Desktop Hero Section - Hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-primary relative overflow-hidden items-center justify-center p-12 text-white">
         <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-rose-400 to-indigo-600 opacity-90"></div>
         <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/20 rounded-full blur-3xl"></div>
         <div className="absolute bottom-0 right-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent"></div>
         
         <div className="relative z-10 max-w-xl">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mb-8 shadow-xl border border-white/20">
              <DropletLogo className="w-12 h-12 text-white" innerColor="var(--color-primary)" />
            </div>
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              {t('understandYourBody')},<br/>
              <span className="text-rose-200">{t('masterYourCycle')}</span>
            </h1>
            <p className="text-lg text-white/80 leading-relaxed max-w-md">
              {t('personalAiCompanion')}
            </p>
         </div>
      </div>

      {/* Form Section */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-md">
           {/* Mobile Header */}
           <div className="lg:hidden text-center mb-8">
              <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <DropletLogo className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-stone-800">{t('appName')}</h1>
           </div>

           <div className="mb-8">
             <h2 className="text-2xl font-bold text-stone-800 mb-2">{isLogin ? t('welcomeBackPlain') : t('createAccountPlain')}</h2>
             <p className="text-stone-500 text-sm">
               {isLogin ? t('enterDetails') : t('startJourney')}
             </p>
           </div>

           <div className="flex p-1 bg-stone-100 rounded-xl mb-8">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${isLogin ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              {t('logIn')}
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${!isLogin ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              {t('signUp')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1.5 ml-1">{t('fullName').toUpperCase()}</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-stone-800 placeholder:text-stone-400"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1.5 ml-1">{t('dob').toUpperCase()}</label>
                  <input 
                    type="date" 
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-stone-800 placeholder:text-stone-400"
                  />
                </div>
              </>
            )}
            
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1.5 ml-1">{t('emailAddress').toUpperCase()}</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-stone-800 placeholder:text-stone-400"
                placeholder="jane@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1.5 ml-1">{t('password').toUpperCase()}</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-stone-800 placeholder:text-stone-400 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/25 hover:bg-primary-hover active:scale-[0.98] transition-all mt-4"
            >
              {isLogin ? t('logIn') : t('createAccount')}
            </button>
          </form>

          <p className="text-center mt-8 text-xs text-stone-400">
            {t('termsPrivacy')}
          </p>
        </div>
      </div>
    </div>
  );
}

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const { t } = useAppContext();
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000); // 3 seconds
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center font-sans text-white theme-locked">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-black/20">
          <DropletLogo className="w-12 h-12 text-primary" />
        </div>
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-4xl font-bold tracking-tight"
        >
          {t('appName')}
        </motion.h1>
      </motion.div>
    </div>
  );
}

function Questionnaire({ onComplete }: { onComplete: () => void }) {
  const { t } = useAppContext();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('');
  const [regularity, setRegularity] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);

  const handleNext = () => {
    if (step === 1 && goal) setStep(2);
    else if (step === 2 && regularity) setStep(3);
    else if (step === 3) setStep(4);
    else if (step === 4) onComplete();
  };

  const toggleSymptom = (sym: string) => {
    setSymptoms(prev => prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]);
  };

  const images = [
    "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1512314889357-e157c22f938d?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=1000"
  ];

  return (
    <div className="min-h-screen flex font-sans bg-white theme-locked">
      {/* Desktop Image Section - Hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden items-center justify-center bg-stone-100">
         <AnimatePresence mode="wait">
           <motion.img 
             key={step}
             initial={{ opacity: 0, scale: 1.05 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0 }}
             transition={{ duration: 0.8 }}
             src={images[step - 1]} 
             className="absolute inset-0 w-full h-full object-cover" 
             alt="Wellness" 
             referrerPolicy="no-referrer" 
           />
         </AnimatePresence>
         <div className="absolute inset-0 bg-primary/30 mix-blend-multiply"></div>
         <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
         
         <div className="relative z-10 max-w-xl p-12 text-center mt-auto mb-12">
            <h2 className="text-4xl font-bold text-white mb-4 drop-shadow-md">
              {step === 1 && t('yourJourneyStartsHere')}
              {step === 2 && t('everyCycleIsUnique')}
              {step === 3 && t('listenToYourBody')}
              {step === 4 && t('empowerYourHealth')}
            </h2>
            <p className="text-lg text-white/90 drop-shadow">
              {step === 1 && t('tellUsWhatYouWant')}
              {step === 2 && t('understandingYourRhythm')}
              {step === 3 && t('trackingSymptomsHelps')}
              {step === 4 && t('youAreAllSetToMaster')}
            </p>
         </div>
      </div>

      {/* Form Section */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 lg:p-12 bg-stone-50 lg:bg-white">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-[2rem] shadow-xl p-8 border border-stone-100 lg:shadow-none lg:border-none lg:p-0"
        >
          <div className="mb-8">
            <div className="flex gap-2 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step >= i ? 'bg-primary' : 'bg-stone-100'}`}></div>
              ))}
            </div>
            
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-3xl font-bold text-stone-800 mb-2 tracking-tight">{t('whatBringsYouHere')}</h2>
                  <p className="text-stone-500 mb-8 text-sm">{t('helpPersonalize')}</p>
                  
                  <div className="space-y-3">
                    {[
                      { id: 'track', label: t('trackMyCycle'), desc: t('knowWhenNextPeriod') },
                      { id: 'symptoms', label: t('understandSymptoms'), desc: t('findPatterns') },
                      { id: 'conceive', label: t('tryToConceive'), desc: t('identifyFertileWindow') },
                      { id: 'explore', label: t('justExploring'), desc: t('learnMoreAboutBody') }
                    ].map(option => (
                      <button
                        key={option.id}
                        onClick={() => setGoal(option.id)}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${goal === option.id ? 'border-primary bg-primary/5' : 'border-stone-100 hover:border-stone-200'}`}
                      >
                        <div className={`font-semibold ${goal === option.id ? 'text-primary' : 'text-stone-700'}`}>{option.label}</div>
                        <div className={`text-xs mt-1 ${goal === option.id ? 'text-primary/70' : 'text-stone-500'}`}>{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-3xl font-bold text-stone-800 mb-2 tracking-tight">{t('howRegular')}</h2>
                  <p className="text-stone-500 mb-8 text-sm">{t('helpsAiCalibrate')}</p>
                  
                  <div className="space-y-3">
                    {[
                      t('veryRegular'), 
                      t('somewhatRegular'), 
                      t('irregular'), 
                      t('dontKnowYet')
                    ].map(option => (
                      <button
                        key={option}
                        onClick={() => setRegularity(option)}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${regularity === option ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-stone-100 hover:border-stone-200 text-stone-600'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-3xl font-bold text-stone-800 mb-2 tracking-tight">{t('whatDoYouExperience')}</h2>
                  <p className="text-stone-500 mb-8 text-sm">{t('selectSymptoms')}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[t('cramps'), t('moodSwings'), t('bloating'), t('fatigue'), t('headaches'), t('acne'), t('cravings'), t('backache')].map(sym => (
                      <button
                        key={sym}
                        onClick={() => toggleSymptom(sym)}
                        className={`p-3 rounded-xl border-2 text-sm text-center transition-all ${symptoms.includes(sym) ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-stone-100 hover:border-stone-200 text-stone-600'}`}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div 
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="text-center py-8">
                    <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                      <Sparkles className="w-12 h-12 text-primary absolute animate-pulse" />
                    </div>
                    <h2 className="text-3xl font-bold text-stone-800 mb-4 tracking-tight">{t('youAreAllSet')}</h2>
                    <p className="text-stone-500 mb-8 leading-relaxed">
                      {t('tailoredExperience')}
                    </p>
                    
                    <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 text-left">
                      <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                        <Check className="w-5 h-5 text-emerald-500" /> {t('whatToExpect')}
                      </h3>
                      <ul className="space-y-2 text-sm text-stone-600">
                        <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" /> {t('smartPredictions')}</li>
                        <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" /> {t('personalizedInsights')}</li>
                        <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" /> {t('secureTracking')}</li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-6 py-4 bg-stone-100 text-stone-600 font-bold rounded-2xl hover:bg-stone-200 active:scale-[0.98] transition-all"
              >
                {t('back')}
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={(step === 1 && !goal) || (step === 2 && !regularity)}
              className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/25 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 4 ? t('createAccount') : t('continue')}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function PinEntryScreen({ correctPin, onComplete }: { correctPin: string, onComplete: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const { t } = useAppContext();
  const { isDesktop } = useResponsiveLayout();

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    updatePin(value);
  };

  const updatePin = (value: string) => {
    if (value.length <= 4) {
      setPin(value);
      setError(false);
      
      if (value.length === 4) {
        if (value === correctPin) {
          onComplete();
        } else {
          setError(true);
          setTimeout(() => setPin(''), 500);
        }
      }
    }
  };

  const handleKeypadClick = (num: string) => {
    if (pin.length < 4) {
      updatePin(pin + num);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 font-sans theme-locked">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-stone-100 p-10 sm:p-12 ${isDesktop ? 'max-w-4xl text-left' : 'max-w-md text-center'}`}
      >
        <div className={`w-full ${isDesktop ? 'grid lg:grid-cols-2 gap-12 items-center' : 'flex flex-col items-center justify-center'}`}>
          <div className={`${isDesktop ? 'flex flex-col items-start' : 'flex flex-col items-center'}`}>
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-8">
              <DropletLogo className="w-10 h-10 text-primary" />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <h2 className={`font-bold text-stone-800 mb-2 ${isDesktop ? 'text-3xl' : 'text-2xl'}`}>{t('enterAppPin')}</h2>
              <p className={`text-stone-500 ${isDesktop ? 'mb-0 text-base max-w-sm' : 'mb-8'}`}>{t('pleaseEnterPin')}</p>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className={`w-full ${isDesktop ? 'max-w-md justify-self-end' : 'max-w-[240px]'}`}
          >
            <div className="relative mb-6">
              <input
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={handlePinChange}
                autoFocus
                className={`w-full text-center text-4xl tracking-[0.5em] py-4 border-b-2 outline-none bg-transparent transition-colors ${error ? 'border-red-500 text-red-500' : 'border-stone-300 focus:border-primary text-stone-800'}`}
              />
              <button 
                onClick={() => setShowPin(!showPin)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
              >
                {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{t('incorrectPin')}</p>}

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onClick={() => handleKeypadClick(num.toString())}
                  className="h-14 rounded-2xl bg-stone-50 border border-stone-100 text-stone-800 font-semibold text-xl hover:bg-stone-100 active:bg-stone-200 transition-colors"
                >
                  {num}
                </button>
              ))}
              <div className="col-start-2">
                <button
                  onClick={() => handleKeypadClick('0')}
                  className="w-full h-14 rounded-2xl bg-stone-50 border border-stone-100 text-stone-800 font-semibold text-xl hover:bg-stone-100 active:bg-stone-200 transition-colors"
                >
                  0
                </button>
              </div>
              <div className="col-start-3">
                <button
                  onClick={handleBackspace}
                  className="w-full h-14 rounded-2xl bg-stone-100 border border-stone-200 text-stone-600 flex items-center justify-center hover:bg-stone-200 active:bg-stone-300 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function WelcomeBackScreen({ user, onComplete }: { user: any, onComplete: () => void }) {
  const { t } = useAppContext();
  const { isDesktop } = useResponsiveLayout();
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 font-sans theme-locked">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-stone-100 p-10 sm:p-12 ${isDesktop ? 'max-w-4xl' : 'max-w-md'} ${isDesktop ? 'text-left' : 'text-center'}`}
      >
        <div className={`w-full ${isDesktop ? 'grid lg:grid-cols-2 gap-12 items-center' : 'flex flex-col items-center justify-center'}`}>
          <div className={`${isDesktop ? 'flex flex-col items-start' : 'flex flex-col items-center'}`}>
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-8">
              <DropletLogo className="w-10 h-10 text-primary" />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <h2 className={`font-bold text-stone-800 mb-2 ${isDesktop ? 'text-4xl' : 'text-3xl'}`}>{t('welcomeBack')}</h2>
              <h3 className={`font-bold text-primary ${isDesktop ? 'text-5xl mb-6' : 'text-4xl mb-6'}`}>
                {user?.name?.split(' ')[0] || 'there'}!
              </h3>
            </motion.div>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className={`text-stone-500 ${isDesktop ? 'mb-0 text-lg max-w-lg' : 'mb-12 text-lg'}`}
            >
              {t('readyToCheckIn')}
            </motion.p>
          </div>

          <div className={`${isDesktop ? 'flex justify-end' : ''}`}>
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.4 }}
              onClick={onComplete}
              className={`bg-primary text-white rounded-[2rem] flex items-center justify-center shadow-lg shadow-primary/25 hover:bg-primary-hover active:scale-[0.98] transition-all ${isDesktop ? 'w-full max-w-sm py-6 text-lg font-bold gap-3' : 'w-16 h-16'}`}
            >
              {isDesktop ? (
                <>
                  <span>{t('goToDashboard')}</span>
                  <ArrowRight className="w-6 h-6" />
                </>
              ) : (
                <ArrowRight className="w-8 h-8" />
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function getPinUnlockedKey(userId?: number | null) {
  return userId ? `pin_unlocked:${userId}` : null;
}
function isPinUnlocked(userId?: number | null) {
  const key = getPinUnlockedKey(userId);
  if (!key) return false;
  try {
    return sessionStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}
function setPinUnlocked(value: boolean, userId?: number | null) {
  const key = getPinUnlockedKey(userId);
  if (!key) return;
  try {
    if (value) sessionStorage.setItem(key, 'true');
    else sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const { user, setUser, appPin, toastMessage, t } = useAppContext();
  const [flowState, setFlowState] = useState<'splash' | 'questionnaire' | 'auth' | 'pin_entry' | 'welcome_back' | 'ready'>('splash');
  const { isMobile } = useResponsiveLayout();

  useEffect(() => {
    const clearPinSession = () => {
      if (user?.id) setPinUnlocked(false, user.id);
    };

    window.addEventListener('beforeunload', clearPinSession);
    window.addEventListener('pagehide', clearPinSession);

    return () => {
      window.removeEventListener('beforeunload', clearPinSession);
      window.removeEventListener('pagehide', clearPinSession);
    };
  }, [user?.id]);

  if (flowState === 'splash') {
    return (
      <SplashScreen 
        onComplete={() => {
          if (user) {
            if (appPin) {
              setFlowState(isPinUnlocked(user.id) ? 'welcome_back' : 'pin_entry');
            } else {
              setFlowState('welcome_back');
            }
          } else {
            setFlowState('questionnaire');
          }
        }} 
      />
    );
  }

  if (flowState === 'pin_entry' && appPin) {
    return <PinEntryScreen correctPin={appPin} onComplete={() => {
      setPinUnlocked(true, user?.id);
      setFlowState('welcome_back');
    }} />;
  }

  if (!user) {
    if (flowState === 'questionnaire') {
      return <Questionnaire onComplete={() => setFlowState('auth')} />;
    }
    return <LandingPage onLogin={(isSignup) => {
      if (isSignup) {
        setFlowState('ready');
      } else {
        setFlowState('welcome_back');
      }
    }} />;
  }

  if (flowState === 'welcome_back') {
    return <WelcomeBackScreen user={user} onComplete={() => setFlowState('ready')} />;
  }

  // Container: Always flex-col.
  // Mobile: max-w-md. Desktop/Auto: full width.
  const containerClass = `w-full bg-bg-app h-full relative flex flex-col overflow-hidden transition-all duration-300 ${
    isMobile ? 'max-w-md shadow-2xl' : 'max-w-none shadow-none'
  }`;

  // Content Wrapper:
  // Mobile: flex-col (Nav at bottom via order-last).
  // Desktop/Auto: flex-row (Nav at left via order-first).
  const contentWrapperClass = `flex-1 flex overflow-hidden relative ${
    isMobile ? 'flex-col' : 'flex-row'
  }`;

  // Nav:
  // Mobile: w-full h-auto order-last border-t.
  // Desktop/Auto: h-full w-20 hover:w-64 order-first border-r transition-[width] duration-300 ease-in-out group z-30.
  const navClass = `bg-primary-light border-primary-light-border z-20 flex ${
    isMobile 
      ? 'w-full border-t px-6 py-4 justify-between items-center mt-auto pb-safe shadow-[0_-10px_20px_rgba(0,0,0,0.05)] order-last' 
      : 'flex-col justify-start items-center py-8 border-r shadow-[10px_0_20px_rgba(0,0,0,0.05)] order-first w-20 hover:w-64 transition-[width] duration-300 ease-in-out group bg-white'
  }`;

  const renderNavBtn = (tab: string, icon: React.ReactNode, label: string, isLogBtn: boolean = false) => {
    const isActive = activeTab === tab;
    
    if (isMobile) {
      return (
        <button onClick={() => setActiveTab(tab)} className={`flex flex-col items-center gap-1.5 transition-colors group relative ${isActive && !isLogBtn ? 'text-primary' : 'text-secondary hover:text-primary'}`}>
          <div className={`transition-transform flex items-center justify-center ${
            isLogBtn 
              ? `p-3 rounded-2xl -mt-8 shadow-lg ${isActive ? 'bg-primary text-white shadow-primary/30 scale-110' : 'bg-white text-primary shadow-black/5'}`
              : ``
          }`}>
            {icon}
          </div>
          <span className={`text-[10px] font-semibold tracking-wide ${isLogBtn ? 'mt-0.5 text-secondary' : ''}`}>{label}</span>
        </button>
      );
    }

    // Desktop & Auto (Desktop View)
    return (
      <button 
        onClick={() => setActiveTab(tab)} 
        className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all w-full relative overflow-hidden whitespace-nowrap ${isActive ? 'bg-primary-light-border/50' : 'hover:bg-primary-light-border/30'}`}
      >
        <div className={`flex items-center justify-center shrink-0 ${
          isLogBtn 
            ? `p-2 rounded-xl bg-primary text-white shadow-md shadow-primary/30`
            : `${isActive ? 'text-primary' : 'text-secondary'}`
        }`}>
          {icon}
        </div>
        <span className={`text-sm font-bold transition-opacity duration-300 opacity-0 group-hover:opacity-100 ${isActive ? 'text-primary' : 'text-secondary'}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="h-[100dvh] bg-stone-100 flex justify-center font-sans text-stone-900 overflow-hidden theme-scope">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[100] max-w-[90vw]">
          <div className="bg-stone-900 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-xl border border-white/10">
            {toastMessage}
          </div>
        </div>
      )}
      <div className={containerClass}>
        
        {/* Top Bar (Header) - Always at top */}
        <header className="flex items-center justify-between px-6 py-5 bg-primary sticky top-0 z-20 shadow-sm shrink-0 w-full">
          <button 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity focus:outline-none"
          >
            <DropletLogo className="w-8 h-8 text-primary-light" innerColor="var(--color-primary)" />
            <h1 className="font-semibold text-xl tracking-tight text-white">{t('appName')}</h1>
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              className={`p-2.5 rounded-full border transition-all ${showAccountMenu ? 'bg-white text-primary border-white rotate-90' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
            >
              {showAccountMenu ? <X size={20} /> : <User size={20} />}
            </button>

            {/* Account Dropdown */}
            {showAccountMenu && (
              <>
                <div 
                  className="fixed inset-0 z-30 cursor-default" 
                  onClick={() => setShowAccountMenu(false)}
                ></div>
                <div className="absolute top-full right-0 mt-3 w-72 bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden z-40 origin-top-right">
                  <div className="p-5 bg-stone-50/50 border-b border-stone-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-rose-400 flex items-center justify-center text-white font-bold text-lg shadow-md uppercase">
                        {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2) : 'JD'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-stone-800">{user?.name || 'Jane Doe'}</h3>
                        <p className="text-xs text-stone-500">{user?.email || 'jane@example.com'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={() => {
                        setActiveTab('settings');
                        setShowAccountMenu(false);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-stone-50 text-stone-600 text-sm font-medium flex items-center gap-3 transition-colors group"
                    >
                      <User size={18} className="text-stone-400 group-hover:text-primary transition-colors" /> 
                      Edit Profile
                    </button>
                    <button 
                      onClick={() => {
                        setActiveTab('help');
                        setShowAccountMenu(false);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-stone-50 text-stone-600 text-sm font-medium flex items-center gap-3 transition-colors group"
                    >
                      <HelpCircle size={18} className="text-stone-400 group-hover:text-primary transition-colors" /> 
                      Help & Support
                    </button>
                    <div className="h-px bg-stone-100 my-1 mx-2"></div>
                    <button 
                      onClick={() => {
                        // Clear user state and reset authentication
                        setUser(null);
                        setPinUnlocked(false, user?.id);
                        setShowAccountMenu(false);
                        setActiveTab('home');
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-500 text-sm font-medium flex items-center gap-3 transition-colors group"
                    >
                      <LogOut size={18} className="text-red-300 group-hover:text-red-500 transition-colors" /> 
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <div className={contentWrapperClass}>
          {/* Navigation (Sidebar or Bottom Bar) */}
          <nav className={navClass}>
            <div className={`flex w-full ${isMobile ? 'flex-row justify-between' : 'flex-col gap-2 px-2'}`}>
              {renderNavBtn('home', <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />, t('home'))}
              {renderNavBtn('calendar', <Calendar size={24} strokeWidth={activeTab === 'calendar' ? 2.5 : 2} />, t('calendar'))}
              {renderNavBtn('log', <PlusCircle size={24} strokeWidth={2} />, t('logSymptoms'), true)}
              {renderNavBtn('chat', <MessageCircle size={24} strokeWidth={activeTab === 'chat' ? 2.5 : 2} />, t('chat'))}
              {renderNavBtn('settings', <Settings size={24} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />, t('settings'))}
            </div>
          </nav>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Dynamic Content */}
            {activeTab === 'home' && <HomeView setActiveTab={setActiveTab} />}
            {activeTab === 'calendar' && <CalendarView />}
            {activeTab === 'log' && <LogView setActiveTab={setActiveTab} />}
            {activeTab === 'chat' && <ChatView />}
            {activeTab === 'settings' && <SettingsView />}
            {activeTab === 'help' && <HelpView />}
          </div>
        </div>
      </div>
    </div>
  );
}
