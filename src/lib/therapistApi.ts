// Client side of the AI therapist: talks to /api/therapist (a serverless function),
// so no API key is ever shipped to the browser.

export interface ChatTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface EEGSnapshot {
  dominant: string;
  quality: number;
}

export const CRISIS = /(suicid|kill myself|end my life|self[- ]?harm|hurt myself|want to die|no reason to live)/i;

export const CRISIS_REPLY =
  "I'm really glad you told me. You deserve support right now. Please call Tele-MANAS on 14416 (free, 24/7) or emergency services on 112, or reach out to someone you trust and let them know how you're feeling.";

/** Returns the model's reply, or null if the AI service is unavailable. */
export async function askTherapist(history: ChatTurn[], eeg?: EEGSnapshot): Promise<string | null> {
  try {
    const res = await fetch('/api/therapist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
        eeg,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.reply === 'string' && data.reply.trim() ? data.reply.trim() : null;
  } catch {
    return null;
  }
}
