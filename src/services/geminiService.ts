const CACHE_KEY = 'cycle_insights_cache';

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function generateCycleInsights(
  phase: string,
  cycleDay: number,
  todaysLog: any | null,
  language: 'en' | 'ne' = 'en',
) {
  // Check cache first
  const cacheData = safeJsonParse<{params: any; data: any; timestamp: number}>(
    localStorage.getItem(CACHE_KEY),
  );
  if (cacheData) {
    const { params, data, timestamp } = cacheData;
    const isSameParams = 
      params.phase === phase && 
      params.cycleDay === cycleDay && 
      JSON.stringify(params.todaysLog) === JSON.stringify(todaysLog) &&
      params.language === language;
    
    // Return cached data if params match and it's less than 24 hours old
    if (isSameParams && (Date.now() - timestamp < 24 * 60 * 60 * 1000)) {
      console.log("Returning cached AI insights");
      return data;
    }
  }

  try {
    const response = await fetch('/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase, cycleDay, todaysLog, language }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data) return null;

    // Cache the successful response
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      params: { phase, cycleDay, todaysLog, language },
      data,
      timestamp: Date.now()
    }));

    return data;
  } catch (error: any) {
    console.error("Error generating insights:", error);
    return null;
  }
}
