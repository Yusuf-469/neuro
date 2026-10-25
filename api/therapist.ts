// Vercel Edge Function: the AI therapist chat.
// The OpenRouter key lives only here (OPENROUTER_API_KEY in the Vercel project settings),
// never in the browser bundle. The system prompt and safety rules are set server-side.

export const config = { runtime: 'edge' };

const SYSTEM = `You are Neuro, a supportive wellbeing companion inside an EEG demo app.
- You are not a therapist or a doctor. Do not diagnose, label conditions, or give medical or medication advice.
- Keep replies short (2 to 4 sentences), warm and practical, and end with one gentle question.
- Readings from a consumer EEG headset are rough signals, not a measure of mental health. Mention them lightly, if at all.
- Suggest simple, evidence-based coping steps (breathing, grounding, rest, talking to someone) when they fit.
- If the user mentions self-harm, suicide or being in danger, respond with care and urge them to contact emergency services (112 in India) or Tele-MANAS on 14416 (free, 24/7), or a trusted person, right now.`;

const CRISIS = /(suicid|kill myself|end my life|self[- ]?harm|hurt myself|want to die|no reason to live)/i;
const MAX_TURNS = 10;
const MAX_CHARS = 1200;

type Turn = { role: 'user' | 'assistant'; content: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return json({ error: 'AI service is not configured' }, 503);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  const history: Turn[] = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (!history.length || history[history.length - 1].role !== 'user') return json({ error: 'No message to answer' }, 400);

  const eeg = body?.eeg;
  const eegLine =
    eeg && typeof eeg.dominant === 'string'
      ? `Current EEG reading (consumer headset, rough signal): ${eeg.dominant.slice(0, 12)} dominant, signal quality ${Math.round(Number(eeg.quality) || 0)}%.`
      : 'No EEG headset is connected right now.';
  const crisis = CRISIS.test(history[history.length - 1].content);
  const system = `${SYSTEM}\n\n${eegLine}${crisis ? '\n\nThe latest message may describe a crisis. Put safety first and share the helpline numbers.' : ''}`;

  let r: Response;
  try {
    r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://neuro-rose.vercel.app',
        'X-Title': 'Neuro',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        messages: [{ role: 'system', content: system }, ...history],
        max_tokens: 350,
        temperature: 0.7,
      }),
    });
  } catch {
    return json({ error: 'AI service unreachable' }, 502);
  }
  if (!r.ok) return json({ error: 'AI service error' }, 502);

  const data: any = await r.json().catch(() => null);
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) return json({ error: 'Empty reply' }, 502);
  return json({ reply, crisis });
}
