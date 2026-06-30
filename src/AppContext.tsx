import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { translations, TranslationKey } from './translations';

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export type DailyLog = {
  date: string; // YYYY-MM-DD
  symptoms: string[];
  pain: number;
  mood: string;
  notes: string;
  flow: 'spotting' | 'light' | 'medium' | 'heavy' | '';
};

export type ThemeType = 'rose' | 'teal' | 'dark';
export type LayoutType = 'auto' | 'mobile' | 'desktop';
export type LanguageType = 'en' | 'ne';

export type User = {
  id: number;
  name: string;
  email: string;
  dob?: string;
};

type AppContextType = {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  periodDates: string[];
  setPeriodDates: React.Dispatch<React.SetStateAction<string[]>>;
  logs: Record<string, DailyLog>;
  saveLog: (log: DailyLog) => void;
  theme: ThemeType;
  setTheme: React.Dispatch<React.SetStateAction<ThemeType>>;
  layout: LayoutType;
  setLayout: React.Dispatch<React.SetStateAction<LayoutType>>;
  language: LanguageType;
  setLanguage: React.Dispatch<React.SetStateAction<LanguageType>>;
  notifications: boolean;
  setNotifications: React.Dispatch<React.SetStateAction<boolean>>;
  toastMessage: string | null;
  showToast: (message: string) => void;
  appPin: string | null;
  setAppPin: React.Dispatch<React.SetStateAction<string | null>>;
  t: (key: TranslationKey) => string;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

function getUserPinStorageKey(user: User | null) {
  return user?.id ? `appPin:user:${user.id}` : null;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    return safeJsonParse<User>(localStorage.getItem('user'));
  });
  const [periodDates, setPeriodDates] = useState<string[]>([]);
  const [logs, setLogs] = useState<Record<string, DailyLog>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [periodDatesLoaded, setPeriodDatesLoaded] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const [theme, setTheme] = useState<ThemeType>(() => {
    return (localStorage.getItem('theme') as ThemeType) || 'rose';
  });
  const [layout, setLayout] = useState<LayoutType>(() => {
    return (localStorage.getItem('layout') as LayoutType) || 'auto';
  });
  const [language, setLanguage] = useState<LanguageType>(() => {
    return (localStorage.getItem('language') as LanguageType) || 'en';
  });
  const [notifications, setNotifications] = useState<boolean>(() => {
    return localStorage.getItem('notifications') === 'true';
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const reminderTimeoutRef = React.useRef<number | null>(null);
  const [appPin, setAppPin] = useState<string | null>(() => {
    const storedUser = safeJsonParse<User>(localStorage.getItem('user'));
    const key = getUserPinStorageKey(storedUser ?? null);
    return key ? localStorage.getItem(key) : null;
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('layout', layout);
  }, [layout]);

  useEffect(() => {
    setLayout('auto');
  }, []);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3000);
  };

  const stopReminderScheduler = () => {
    if (reminderTimeoutRef.current !== null) {
      window.clearTimeout(reminderTimeoutRef.current);
      reminderTimeoutRef.current = null;
    }
  };

  const scheduleDailyReminder = () => {
    stopReminderScheduler();

    const scheduleNext = () => {
      // Schedule for 8:00 PM local time
      const now = new Date();
      const next = new Date(now);
      next.setHours(20, 0, 0, 0);
      if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);

      const delay = next.getTime() - now.getTime();
      reminderTimeoutRef.current = window.setTimeout(() => {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;
        if (!localStorage || localStorage.getItem('notifications') !== 'true') return;

        new Notification(t('reminderTitle'), { body: t('reminderBody') });
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  };

  const notificationsPrevRef = React.useRef<boolean>(notifications);
  useEffect(() => {
    localStorage.setItem('notifications', notifications.toString());

    const prev = notificationsPrevRef.current;
    notificationsPrevRef.current = notifications;

    // Only react to user toggles (not initial render)
    if (prev === notifications) return;

    if (!notifications) {
      stopReminderScheduler();
      return;
    }

    if (!('Notification' in window)) {
      stopReminderScheduler();
      return;
    }

    if (Notification.permission !== 'granted') {
      stopReminderScheduler();
      return;
    }

    scheduleDailyReminder();
  }, [notifications, language]);

  useEffect(() => {
    const key = getUserPinStorageKey(user);
    if (!key) {
      setAppPin(null);
      return;
    }
    setAppPin(localStorage.getItem(key));
  }, [user?.id]);

  useEffect(() => {
    const key = getUserPinStorageKey(user);
    if (!key) return;
    if (appPin) {
      localStorage.setItem(key, appPin);
    } else {
      localStorage.removeItem(key);
    }
  }, [appPin, user?.id]);

  useEffect(() => {
    return () => {
      stopReminderScheduler();
    };
  }, []);

  useEffect(() => {
    // Reset per-user data when account changes
    setLogs({});
    setPeriodDates([]);
    setIsLoaded(false);
    setPeriodDatesLoaded(false);
    localStorage.removeItem('cycle_insights_cache');

    if (!user?.id) {
      setIsLoaded(true);
      return;
    }

    const fetchData = async () => {
      try {
        const fetchJsonWithRetry = async (url: string, attempts = 3) => {
          let lastError: unknown = null;
          for (let i = 0; i < attempts; i++) {
            try {
              const res = await fetch(url, {
                headers: { 'x-user-id': String(user.id) }
              });
              if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
              return await res.json();
            } catch (e) {
              lastError = e;
              await sleep(250 * (i + 1));
            }
          }
          throw lastError;
        };

        const logsData = await fetchJsonWithRetry('/api/logs', 3).catch(() => null);
        if (Array.isArray(logsData)) {
          const logsMap: Record<string, DailyLog> = {};
          logsData.forEach((log: any) => {
            if (log?.date) logsMap[log.date] = log;
          });
          setLogs(logsMap);
        }

        const datesData = await fetchJsonWithRetry('/api/period-dates', 3).catch(() => null);
        if (Array.isArray(datesData)) {
          setPeriodDates(datesData);
          setPeriodDatesLoaded(true);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    
    fetchData();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    let intervalId: number | null = null;

    const sendActivityPing = async () => {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') return;
      try {
        await fetch('/api/activity/ping', {
          method: 'POST',
          headers: { 'x-user-id': String(user.id) }
        });
      } catch (error) {
        console.error('Failed to record activity:', error);
      }
    };

    const startHeartbeat = () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      void sendActivityPing();
      intervalId = window.setInterval(() => {
        void sendActivityPing();
      }, 30000);
    };

    const stopHeartbeat = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') startHeartbeat();
      else stopHeartbeat();
    };

    if (document.visibilityState === 'visible') startHeartbeat();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      stopHeartbeat();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

  // Sync period dates to server when they change
  useEffect(() => {
    if (!isLoaded) return;
    if (!periodDatesLoaded) return;
    
    fetch('/api/period-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id ?? '') },
      body: JSON.stringify({ dates: periodDates })
    }).catch(console.error);
  }, [periodDates, isLoaded, periodDatesLoaded]);

  const saveLog = async (log: DailyLog) => {
    setLogs(prev => ({ ...prev, [log.date]: log }));
    
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id ?? '') },
        body: JSON.stringify(log)
      });
    } catch (error) {
      console.error('Failed to save log:', error);
    }
  };

  return (
    <AppContext.Provider value={{ 
      user, setUser, 
      periodDates, setPeriodDates, 
      logs, saveLog, 
      theme, setTheme, 
      layout, setLayout,
      language, setLanguage,
      notifications, setNotifications,
      toastMessage, showToast,
      appPin, setAppPin,
      t
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
