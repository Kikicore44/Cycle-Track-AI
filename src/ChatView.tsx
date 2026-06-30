import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, User } from 'lucide-react';
import { useAppContext } from './AppContext';

export default function ChatView() {
  const { t } = useAppContext();
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: t('chatWelcome') }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userText = input.trim();
    setInput('');
    const nextMessages = [...messages, { role: 'user' as const, text: userText }];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!response.ok) {
        let serverError = '';
        let serverDetails = '';
        try {
          const data = await response.json();
          serverError = typeof data?.error === 'string' ? data.error : '';
          serverDetails = typeof data?.details === 'string' ? data.details : '';
        } catch {
          // ignore
        }
        if (response.status === 503) {
          setMessages(prev => [...prev, { role: 'model', text: t('missingApiKey') }]);
          return;
        }
        const extra = serverDetails || serverError;
        throw new Error(extra ? `Chat request failed: ${response.status} (${extra})` : `Chat request failed: ${response.status}`);
      }

      const data = await response.json();
      const text = typeof data?.text === 'string' ? data.text : '';
      if (!text) throw new Error('Empty chat response');

      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (error) {
      console.error('Chat error:', error);
      const msg = error instanceof Error && error.message ? `\n\n(${error.message})` : '';
      setMessages(prev => [...prev, { role: 'model', text: `${t('chatError')}${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-bg-app overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 bg-white/80 backdrop-blur-sm border-b border-white/40 shadow-sm flex items-center gap-3">
        <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
          <Sparkles size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-800">{t('cycleAssistant')}</h2>
          <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">{t('aiPowered')}</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-primary text-white' : 'bg-primary-light text-secondary'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`max-w-[75%] p-4 rounded-3xl text-sm shadow-sm whitespace-pre-wrap ${
              msg.role === 'user' 
                ? 'bg-primary text-white rounded-tr-sm' 
                : 'bg-white text-stone-700 border border-stone-100 rounded-tl-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 flex-row">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary-light text-secondary">
              <Bot size={16} />
            </div>
            <div className="max-w-[75%] p-4 rounded-3xl text-sm shadow-sm bg-white text-stone-700 border border-stone-100 rounded-tl-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-secondary rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-stone-100 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t('askAboutCycle')}
            className="w-full bg-stone-50 border border-stone-200 rounded-full py-3 pl-5 pr-12 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 bg-primary text-white rounded-full hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:hover:bg-primary"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </main>
  );
}
