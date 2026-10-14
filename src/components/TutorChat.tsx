/**
 * TutorChat — contextual learning chat panel.
 * Cozy speech-bubble styling matching the vocal coach's notepad theme.
 *
 * LOCAL-FIRST ARCHITECTURE:
 * - Calls the ai-tutor edge function, which tries external AI providers
 *   (OpenAI, self-hosted) and falls back to Vocalis's built-in local
 *   knowledge engine when no external provider is available.
 * - The `source` field in the response indicates where the answer came
 *   from: "openai", "self-hosted", or "local". Local responses are labeled
 *   with a "Vocalis Guide" badge so users know it's from Vocalis's own
 *   knowledge, not a language model.
 * - All responses are rendered as React text (no HTML injection).
 * - Handles rate-limit (429), auth (401), and error states.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { Send, Sparkles, Loader2, AlertCircle, Clock, BookOpen } from 'lucide-react';
import { sanitizeText } from '@/lib/validation';
import { supabase } from '@/lib/supabaseClient';

interface ChatMessage {
  role: 'user' | 'tutor';
  text: string;
  source?: 'openai' | 'self-hosted' | 'local';
}

interface TutorChatProps {
  context: string;
}

export function TutorChat({ context }: TutorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = useCallback(async () => {
    const sanitized = sanitizeText(input, 500);
    if (sanitized.length === 0 || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', text: sanitized }]);
    setInput('');
    setIsLoading(true);
    setError(null);
    setRateLimited(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('Please sign in to chat with your vocal coach.');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: sanitized, context }),
      });

      if (response.status === 429) {
        const data = await response.json().catch(() => ({}));
        setRateLimited(true);
        throw new Error(data.error ?? 'You\u2019ve reached the hourly question limit. Please try again later.');
      }

      if (response.status === 401) {
        throw new Error('Please sign in to chat with your vocal coach.');
      }

      if (!response.ok) throw new Error(`Request failed (${response.status})`);

      const data = await response.json();
      if (!data || typeof data !== 'object') throw new Error('Invalid response from tutor');
      if (data.error) throw new Error(String(data.error));

      const answer = typeof data.answer === 'string' ? data.answer.slice(0, 1000) : 'Sorry, I could not generate a response.';
      const source = typeof data.source === 'string' ? data.source as ChatMessage['source'] : undefined;
      setMessages((prev) => [...prev, { role: 'tutor', text: answer, source }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach the tutor');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, context]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-charcoal-muted">
        <Sparkles className="h-4 w-4 text-mustard-DEFAULT" />
        <span>Ask a follow-up question about music theory</span>
      </div>

      {/* Messages with speech bubbles */}
      <div ref={scrollRef} className="flex max-h-64 min-h-[120px] flex-col gap-2 overflow-y-auto rounded-xl bg-cream-50 border border-cream-400 p-3 scrollbar-hide">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-1 items-center justify-center text-center text-xs text-charcoal-muted">
            Ask me anything about intervals, modulations, or how to improve your ear...
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === 'user'
                ? 'bg-sage-DEFAULT text-cream-50 rounded-tr-sm'
                : 'bg-cream-200 text-charcoal rounded-tl-sm border border-cream-400'
            }`}>
              {msg.text}
              {msg.source === 'local' && (
                <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-cream-400/50">
                  <BookOpen className="h-3 w-3 text-charcoal-muted" />
                  <span className="text-[10px] text-charcoal-muted">Vocalis Guide</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-cream-200 border border-cream-400 px-4 py-2.5 text-sm text-charcoal-muted rounded-tl-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-terracotta-light border border-terracotta-DEFAULT px-3 py-2 text-xs text-terracotta-deep">
            {rateLimited ? <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading || rateLimited}
          maxLength={500}
          placeholder="Why is that the correct answer?"
          className="flex-1 rounded-xl bg-cream-50 border border-cream-400 px-4 py-2.5 text-sm text-charcoal placeholder-charcoal-muted/50 outline-none transition-all focus:border-sage-DEFAULT disabled:opacity-50"
        />
        <button onClick={sendMessage} disabled={isLoading || input.trim().length === 0 || rateLimited} className="btn-primary !px-4 !py-2.5">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
