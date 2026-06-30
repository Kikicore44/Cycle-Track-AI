import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Droplet, Target, RefreshCw } from 'lucide-react';
import { useAppContext } from './AppContext';

export default function CalendarView() {
  // State for current month being viewed
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)); // March 2026

  // State for logged period days (YYYY-MM-DD)
  const { periodDates, setPeriodDates, t } = useAppContext();
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [localPeriodDates, setLocalPeriodDates] = useState<string[]>([]);
  const [isSaved, setIsSaved] = useState(false);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const formatDate = (y: number, m: number, d: number) => {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const toTime = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  };

  const normalizePeriodDates = (dates: string[]) => {
    const sorted = [...new Set(dates)].sort();
    if (sorted.length <= 1) return sorted;

    const clusters: string[][] = [];
    let current: string[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prevT = toTime(sorted[i - 1]);
      const curT = toTime(sorted[i]);
      const diffDays = Math.round((curT - prevT) / (1000 * 60 * 60 * 24));

      // If dates are close, treat as same period block/cycle and enforce contiguous fill.
      if (diffDays <= 12) {
        current.push(sorted[i]);
      } else {
        clusters.push(current);
        current = [sorted[i]];
      }
    }
    clusters.push(current);

    const filled: string[] = [];
    for (const cluster of clusters) {
      const start = toTime(cluster[0]);
      const end = toTime(cluster[cluster.length - 1]);
      for (let t = start; t <= end; t += 1000 * 60 * 60 * 24) {
        const d = new Date(t);
        filled.push(formatDate(d.getFullYear(), d.getMonth(), d.getDate()));
      }
    }

    return [...new Set(filled)].sort();
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const handleEditClick = () => {
    setLocalPeriodDates([...periodDates]);
    setIsEditMode(true);
  };

  const handleSaveClick = () => {
    setPeriodDates(normalizePeriodDates(localPeriodDates));
    setIsEditMode(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleCancelClick = () => {
    setIsEditMode(false);
  };

  // Toggle a day on/off as a period day
  const toggleDate = (dateStr: string) => {
    if (!isEditMode) return;
    
    setLocalPeriodDates(prev => {
      if (prev.includes(dateStr)) {
        return normalizePeriodDates(prev.filter(d => d !== dateStr));
      }
      
      if (prev.length === 0) return [dateStr];

      const clickedTime = new Date(dateStr).getTime();
      let closestDate = prev[0];
      let minDiff = Math.abs(clickedTime - new Date(prev[0]).getTime());

      for (const d of prev) {
        const diff = Math.abs(clickedTime - new Date(d).getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestDate = d;
        }
      }

      const daysDiff = minDiff / (1000 * 60 * 60 * 24);

      // If clicked within 12 days of an existing logged period, fill the gap
      if (daysDiff <= 12) {
        const newDates = new Set<string>(prev);
        const start = Math.min(clickedTime, new Date(closestDate).getTime());
        const end = Math.max(clickedTime, new Date(closestDate).getTime());

        for (let t = start; t <= end; t += 1000 * 60 * 60 * 24) {
          const d = new Date(t);
          newDates.add(formatDate(d.getFullYear(), d.getMonth(), d.getDate()));
        }
        return normalizePeriodDates(Array.from(newDates) as string[]);
      } else {
        return normalizePeriodDates([...prev, dateStr]);
      }
    });
  };

  const activeDates = isEditMode ? localPeriodDates : periodDates;

  // Calculate the start day of each cycle (first day of a contiguous period block)
  const cycleStarts = useMemo(() => {
    const starts: string[] = [];
    const sorted = [...activeDates].sort();
    sorted.forEach(dateStr => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const prevD = new Date(y, m - 1, d - 1);
      const prevDayStr = formatDate(prevD.getFullYear(), prevD.getMonth(), prevD.getDate());
      if (!activeDates.includes(prevDayStr)) {
        starts.push(dateStr);
      }
    });
    return starts;
  }, [activeDates]);

  // Dynamically calculate average period length
  const avgPeriodLength = useMemo(() => {
    if (cycleStarts.length === 0) return 5;
    return Math.max(1, Math.round(activeDates.length / cycleStarts.length));
  }, [activeDates, cycleStarts]);

  // Dynamically calculate average cycle length
  const avgCycleLength = useMemo(() => {
    if (cycleStarts.length < 2) return 28;
    
    // Sort starts chronologically
    const sortedStarts = [...cycleStarts].sort();
    let totalDays = 0;
    let count = 0;

    for (let i = 0; i < sortedStarts.length - 1; i++) {
      const start1 = new Date(sortedStarts[i]);
      const start2 = new Date(sortedStarts[i+1]);
      const diffTime = Math.abs(start2.getTime() - start1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      // Filter out unreasonable cycle lengths (e.g. missed months)
      if (diffDays >= 21 && diffDays <= 45) {
        totalDays += diffDays;
        count++;
      }
    }

    return count > 0 ? Math.round(totalDays / count) : 28;
  }, [cycleStarts]);

  // Ovulation is typically 14 days before the NEXT period
  // So in a cycle of length L, ovulation is at day L - 14
  const estimatedOvulationDay = Math.max(10, avgCycleLength - 14); 

  // Determine what type of day it is for styling
  const getDayType = (dateStr: string) => {
    if (activeDates.includes(dateStr)) return 'period';
    if (cycleStarts.length === 0) return 'none';
    
    const [y, m, d] = dateStr.split('-').map(Number);
    const time = new Date(y, m - 1, d).getTime();

    // Check against ALL cycle starts to show past fertile/ovulation windows
    for (let i = 0; i < cycleStarts.length; i++) {
      const startStr = cycleStarts[i];
      const [sy, sm, sd] = startStr.split('-').map(Number);
      const startD = new Date(sy, sm - 1, sd).getTime();
      
      // If the date is before this cycle start, we don't care about this cycle
      if (time < startD) continue;
      
      // Calculate days since this cycle started (Day 1 is 0 diff)
      const diffDays = Math.round((time - startD) / (1000 * 60 * 60 * 24));
      
      // Determine cycle length for THIS specific cycle if possible
      let currentCycleLength = avgCycleLength;
      const nextCycleStartStr = cycleStarts[i + 1];
      
      if (nextCycleStartStr) {
        const [nsy, nsm, nsd] = nextCycleStartStr.split('-').map(Number);
        const nextStartD = new Date(nsy, nsm - 1, nsd).getTime();
        
        // If the date is after the NEXT cycle start, it belongs to the next cycle, so skip
        if (time >= nextStartD) continue;
        
        // Use actual cycle length for past cycles
        const actualCycleLength = Math.round((nextStartD - startD) / (1000 * 60 * 60 * 24));
        if (actualCycleLength >= 21 && actualCycleLength <= 45) {
          currentCycleLength = actualCycleLength;
        }
      }

      // Ovulation for this cycle
      const ovulationDay = currentCycleLength - 14; // e.g. 28 - 14 = 14 (Day 15)
      
      // diffDays is 0-indexed (Day 1 = 0). So Day 15 is diffDays 14.
      // Ovulation at diffDays = ovulationDay
      if (diffDays === ovulationDay) return 'ovulation';
      
      // Fertile window: 5 days before ovulation + ovulation day
      // e.g. if ovulation is Day 15 (diff 14), fertile is Day 10-15 (diff 9-14)
      if (diffDays >= ovulationDay - 5 && diffDays < ovulationDay) return 'fertile';
    }

    // Predicted next period (only calculate from the LATEST cycle)
    const latestCycleStart = cycleStarts[cycleStarts.length - 1];
    const [lsy, lsm, lsd] = latestCycleStart.split('-').map(Number);
    const latestStartD = new Date(lsy, lsm - 1, lsd).getTime();
    const diffFromLatest = Math.round((time - latestStartD) / (1000 * 60 * 60 * 24));
    
    if (diffFromLatest >= 0) {
      const cycleNumber = Math.floor(diffFromLatest / avgCycleLength);
      const dayOfCycle = diffFromLatest % avgCycleLength;
      
      // Predicted next period
      if (cycleNumber > 0 && dayOfCycle >= 0 && dayOfCycle < avgPeriodLength) return 'predicted';
      
      // Future fertile/ovulation windows (beyond the current cycle)
      if (cycleNumber > 0) {
        const ovulationDay = avgCycleLength - 14;
        if (dayOfCycle === ovulationDay) return 'ovulation';
        if (dayOfCycle >= ovulationDay - 5 && dayOfCycle < ovulationDay) return 'fertile';
      }
    }
    
    return 'none';
  };

  const getDayStyle = (type: string) => {
    switch(type) {
      case 'period': return 'bg-primary text-white font-bold shadow-md shadow-primary/30 scale-105 z-10';
      case 'ovulation': return 'bg-secondary text-white font-bold shadow-md shadow-secondary/30 scale-105 z-10';
      case 'fertile': return 'bg-primary-light text-secondary-dark font-semibold';
      case 'predicted': return 'border-2 border-primary/30 text-primary font-semibold';
      default: return 'text-stone-600 hover:bg-stone-100';
    }
  };

  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const cellSizeClass = "w-10 h-10 md:w-12 md:h-12 lg:w-[72px] lg:h-[72px]";

  const cycleHistory = useMemo(() => {
    if (cycleStarts.length === 0) return [];
    const sortedStarts = [...cycleStarts].sort();
    const activeSet = new Set(activeDates);

    const addDays = (startStr: string, deltaDays: number) => {
      const t = toTime(startStr) + deltaDays * 24 * 60 * 60 * 1000;
      const d = new Date(t);
      return formatDate(d.getFullYear(), d.getMonth(), d.getDate());
    };

    const countContiguousFrom = (startStr: string) => {
      let count = 0;
      while (activeSet.has(addDays(startStr, count))) count++;
      return Math.max(1, count);
    };

    const formatRange = (startStr: string, endStr: string) => {
      const s = new Date(toTime(startStr));
      const e = new Date(toTime(endStr));
      const sTxt = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const eTxt = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${sTxt} - ${eTxt}`;
    };

    const items = sortedStarts.map((startStr, i) => {
      const nextStart = sortedStarts[i + 1];

      const periodLength = countContiguousFrom(startStr);
      let cycleLength = avgCycleLength;
      if (nextStart) {
        const diffDays = Math.round((toTime(nextStart) - toTime(startStr)) / (1000 * 60 * 60 * 24));
        if (diffDays >= 21 && diffDays <= 45) cycleLength = diffDays;
      }

      const ovulationDay = Math.max(10, cycleLength - 14); // 0-indexed diffDays
      const fertileStart = Math.max(0, ovulationDay - 5);
      const fertileLen = Math.max(0, ovulationDay - fertileStart);

      const endStr = addDays(startStr, cycleLength - 1);
      return {
        id: startStr,
        dateLabel: formatRange(startStr, endStr),
        periodLength,
        ovulationDay: ovulationDay + 1, // display as Day #
        cycleLength,
        fertileStart: fertileStart + 1, // Day #
        fertileLen,
      };
    });

    return items.reverse().slice(0, 6);
  }, [activeDates, avgCycleLength, cycleStarts]);

  return (
    <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-8 lg:text-[15px]">
      <div className="mx-auto w-full max-w-5xl 2xl:max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-stone-800">{t('calendar')}</h2>
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-white/40">
          <button onClick={prevMonth} className="text-stone-400 hover:text-primary p-1 transition-colors"><ChevronLeft size={18} /></button>
          <span className="text-sm font-semibold text-stone-800 w-24 text-center">{monthName} {currentYear}</span>
          <button onClick={nextMonth} className="text-stone-400 hover:text-primary p-1 transition-colors"><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* Calendar Grid */}
      <section className={`bg-white/95 backdrop-blur-sm border rounded-[2rem] p-4 md:p-5 shadow-sm transition-colors ${isEditMode ? 'border-primary' : 'border-white/20'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-stone-800 text-sm">
            {isEditMode ? t('tapDaysToEdit') : t('cycleOverview')}
          </h3>
          {!isEditMode ? (
            <button 
              onClick={handleEditClick}
              className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
            >
              {t('editDates')}
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={handleCancelClick}
                className="text-xs font-semibold text-stone-500 bg-stone-100 px-3 py-1.5 rounded-full hover:bg-stone-200 transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSaveClick}
                className="text-xs font-semibold text-white bg-primary px-3 py-1.5 rounded-full hover:bg-primary-hover transition-colors"
              >
                {t('save')}
              </button>
            </div>
          )}
        </div>
        
        {isSaved && (
          <div className="mb-4 text-center text-xs font-semibold text-emerald-500 bg-emerald-50 py-1.5 rounded-full">
            {t('periodDatesSaved')}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_220px] items-start">
          <div className="mx-auto w-fit">
            <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2 justify-items-center">
              {daysOfWeek.map((d, i) => (
                <div key={i} className={`text-center text-xs font-bold text-stone-400 uppercase ${cellSizeClass} flex items-center justify-center`}>
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 md:gap-2 justify-items-center">
              {blanks.map(b => <div key={`blank-${b}`} className={cellSizeClass} />)}
              {days.map(day => {
                const dateStr = formatDate(currentYear, currentMonth, day);
                const type = getDayType(dateStr);
                return (
                  <button 
                    key={day} 
                    onClick={() => toggleDate(dateStr)}
                    disabled={!isEditMode && type === 'none'}
                    className={`${cellSizeClass} rounded-full flex items-center justify-center text-sm md:text-sm lg:text-base font-semibold transition-all ${getDayStyle(type)} ${!isEditMode && type === 'none' ? 'cursor-default' : ''}`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Indicators (Desktop) */}
          <aside className="hidden lg:block">
            <div className="bg-stone-50/60 border border-stone-100 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-3">{t('cycleOverview')}</p>
              <div className="space-y-2.5 text-sm font-semibold text-stone-700">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                  <span>{t('period')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary-light"></div>
                  <span>{t('fertile')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-secondary"></div>
                  <span>{t('ovulation')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-primary/30"></div>
                  <span>{t('predicted')}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Legend (Mobile/Tablet) */}
        <div className="mt-5 flex flex-wrap gap-3 justify-center text-[10px] font-semibold text-stone-500 uppercase tracking-wider lg:hidden">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-primary"></div> {t('period')}</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-primary-light"></div> {t('fertile')}</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-secondary"></div> {t('ovulation')}</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full border-2 border-primary/30"></div> {t('predicted')}</div>
        </div>
      </section>

      {/* Trends (Single Box) */}
      <section className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-[2rem] p-6 shadow-sm">
        <h3 className="font-bold text-stone-800 mb-5 text-base">{t('yourTrends')}</h3>
        {activeDates.length === 0 ? (
          <div className="text-sm text-stone-600 bg-stone-50/80 border border-stone-100 rounded-2xl p-4">
            {t('trendsEmpty')}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-xl text-primary"><Droplet size={20} /></div>
                <span className="font-semibold text-stone-700 text-sm">{t('averagePeriod')}</span>
              </div>
              <span className="font-bold text-stone-800 text-sm">{avgPeriodLength} {t('days')}</span>
            </div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-secondary/10 p-2.5 rounded-xl text-secondary"><Target size={20} /></div>
                <span className="font-semibold text-stone-700 text-sm">{t('averageEstimatedOvulation')}</span>
              </div>
              <span className="font-bold text-stone-800 text-sm">{estimatedOvulationDay}{getOrdinalSuffix(estimatedOvulationDay)} {t('day')}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-500"><RefreshCw size={20} /></div>
                <span className="font-semibold text-stone-700 text-sm">{t('averageCycle')}</span>
              </div>
              <span className="font-bold text-stone-800 text-sm">{avgCycleLength} {t('days')}</span>
            </div>
          </div>
        )}
      </section>

      {/* History */}
      {cycleHistory.length > 0 && (
        <section>
          <h3 className="font-bold text-stone-800 mb-3 px-1">{t('yourCycles')}</h3>
          <div className="space-y-3">
            {cycleHistory.map((cycle) => (
              <div key={cycle.id} className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-[2rem] p-5 shadow-sm">
                <h4 className="text-sm font-bold text-stone-800 mb-3">{cycle.dateLabel}</h4>
                
                {/* Visual Timeline */}
                <div className="relative h-2 bg-stone-100 rounded-full overflow-hidden mb-4">
                  <div className="absolute top-0 left-0 h-full bg-primary" style={{ width: `${(cycle.periodLength / cycle.cycleLength) * 100}%` }}></div>
                  {cycle.fertileLen > 0 && (
                    <div
                      className="absolute top-0 h-full bg-primary-light"
                      style={{
                        left: `${((cycle.fertileStart - 1) / cycle.cycleLength) * 100}%`,
                        width: `${(cycle.fertileLen / cycle.cycleLength) * 100}%`,
                      }}
                    ></div>
                  )}
                  <div className="absolute top-0 h-full w-1.5 bg-secondary rounded-full" style={{ left: `${((cycle.ovulationDay - 1) / cycle.cycleLength) * 100}%` }}></div>
                </div>
                
                <div className="flex justify-between text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1"><Droplet size={10} className="text-primary"/> {t('period')}: {cycle.periodLength}d</span>
                  <span className="flex items-center gap-1"><Target size={10} className="text-secondary"/> {t('ovulation')}: D{cycle.ovulationDay}</span>
                  <span className="flex items-center gap-1"><RefreshCw size={10} className="text-blue-500"/> {t('cycle')}: {cycle.cycleLength}d</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
    </main>
  );
}
