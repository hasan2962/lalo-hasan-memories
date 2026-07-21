/**
 * AI memory finder — Groq only, with local fallback + cache
 */
const AIMemory = (() => {
  const CACHE_KEY = 'anniversary_ai_v3';

  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const GROQ_MODEL = 'llama-3.1-8b-instant';

  function getProvider() {
    const key = window.ENV?.GROQ_API_KEY;
    return key?.startsWith('gsk_') ? 'groq' : null;
  }

  function cacheSignature(chatData) {
    return `${chatData.totalMessages}-${chatData.dateRange?.start?.getTime()}-${chatData.dateRange?.end?.getTime()}`;
  }

  function getCached(chatData) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.sig === cacheSignature(chatData)) return data.results;
    } catch {
      /* ignore */
    }
    return null;
  }

  function setCache(chatData, results) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ sig: cacheSignature(chatData), results, at: Date.now() })
      );
    } catch {
      /* ignore */
    }
  }

  function buildChatSample(messages) {
    const safe = ContentFilter.sanitizeMessages(messages, 200);
    const sampled = sampleEvenly(safe, Math.min(40, safe.length));
    return sampled
      .map((m) => {
        const d = m.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `[${d}] ${m.sender}: ${m.text}`;
      })
      .join('\n');
  }

  function sampleEvenly(arr, count) {
    if (arr.length <= count) return arr;
    const step = arr.length / count;
    return Array.from({ length: count }, (_, i) => arr[Math.floor(i * step)]);
  }

  function buildPrompt(chatData) {
    const { participants, dateRange } = chatData;
    const sample = buildChatSample(chatData.messages);
    const names = participants.join(' & ');
    const range = dateRange
      ? `${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`
      : 'unknown';

    return `${ContentFilter.AI_SAFETY_RULES}

You are a warm romantic memory curator for a couple married July 22, 2022.
Analyze this WhatsApp chat between ${names} (${range}).
Return 8-10 meaningful moments as JSON array only (no markdown):
[{"emoji":"💕","title":"short title","date":"Month Day Year","category":"love|milestone|reconciliation|conflict|sweet|anniversary|funny","description":"2 warm sentences","quote":"short PG quote max 15 words"}]

Mix: sweet moments, funny bits, fights & make-ups, milestones, anniversaries.

CHAT:
${sample}`;
  }

  function parseResponse(text) {
    let cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('Could not parse AI response.');

    return JSON.parse(cleaned.slice(start, end + 1)).map((item) => ({
      emoji: item.emoji || '💕',
      title: ContentFilter.sanitize(item.title || 'A Beautiful Moment'),
      date: item.date || '',
      category: item.category || 'sweet',
      description: ContentFilter.sanitize(item.description || ''),
      quote: ContentFilter.isAdult(item.quote || '') ? '' : ContentFilter.safePreview(item.quote || '', 80),
    }));
  }

  async function callGroq(prompt) {
    const key = window.ENV?.GROQ_API_KEY;
    if (!key?.startsWith('gsk_')) {
      throw new Error('Add GROQ_API_KEY to env (starts with gsk_). Get free key at console.groq.com');
    }

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: window.ENV?.GROQ_MODEL || GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 429) {
        throw new Error('Groq rate limit — wait 1 minute, then tap Enhance with AI again.');
      }
      if (response.status === 401) {
        throw new Error('Invalid Groq API key — check GROQ_API_KEY in env file.');
      }
      throw new Error(err.error?.message || `Groq error (${response.status})`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('No response from Groq.');
    return parseResponse(text);
  }

  function fromLocalMoments(moments) {
    const emoji = {
      love: '💕', milestone: '🎉', reconciliation: '🤝',
      conflict: '🌧️', sweet: '🌸', anniversary: '💍',
    };

    return moments.slice(0, 10).map((m) => ({
      emoji: emoji[m.type] || '💕',
      title: m.title,
      date: MomentAnalyzer.formatDate(m.date),
      description: m.description,
      quote: m.preview.replace(/^"|"$/g, ''),
      local: true,
    }));
  }

  async function analyzeMoments(chatData, localMoments) {
    const cached = getCached(chatData);
    if (cached?.length) return { results: cached, source: 'cache' };

    if (!getProvider()) {
      return { results: fromLocalMoments(localMoments), source: 'local' };
    }

    const results = await callGroq(buildPrompt(chatData));
    if (results.length) setCache(chatData, results);
    return { results, source: 'groq' };
  }

  return { analyzeMoments, fromLocalMoments, getProvider, getCached };
})();
