/**
 * Keeps displayed chat excerpts and AI context family-friendly.
 */
const ContentFilter = (() => {
  const ADULT_PATTERNS = [
    /\b(sex|sexy|nude|naked|porn|xxx|nsfw|horny|orgasm|dick|cock|pussy|boob|tits|fuck\s*me|blowjob|handjob|anal|bdsm|kink|fetish|onlyfans)\b/i,
    /\b(섹스|야한|19금|성인)\b/,
  ];

  const REPLACEMENT = '[private message — hidden for privacy]';

  function isAdult(text) {
    if (!text || text.length < 3) return false;
    return ADULT_PATTERNS.some((pattern) => pattern.test(text));
  }

  function sanitize(text) {
    if (!text) return '';
    if (isAdult(text)) return REPLACEMENT;
    return text;
  }

  /** Strip adult messages entirely — never show placeholder in UI */
  function isSafe(text) {
    return text && !isAdult(text);
  }

  function sanitizeMessages(messages, maxCount = Infinity) {
    return messages
      .filter((m) => !isAdult(m.text))
      .slice(0, maxCount)
      .map((m) => ({
        ...m,
        text: sanitize(m.text),
      }));
  }

  /** Short excerpt safe to show in UI cards */
  function safePreview(text, maxLen = 120) {
    const clean = sanitize(text);
    if (clean === REPLACEMENT) return clean;
    if (clean.length <= maxLen) return clean;
    return `${clean.slice(0, maxLen).trim()}…`;
  }

  const AI_SAFETY_RULES = `
STRICT CONTENT RULES (non-negotiable — violating any rule is a failure):
- This is a cute, family-friendly anniversary website for a married couple.
- Output must be 100% PG. No exceptions.
- NEVER quote, paraphrase, hint at, or reference sexually explicit, adult, intimate, or NSFW chat content.
- NEVER mention that adult/private messages exist in the chat.
- Skip any message that is sexual, vulgar, or overly intimate — pretend it was never in the data.
- Only highlight wholesome moments: love, humor, daily sweetness, milestones, apologies, make-ups, and growth.
- Quotes must be innocent (e.g. "miss you", "I'm sorry", "good morning") — max 15 words, G-rated only.
- For fights: describe emotions gently — never repeat profanity, slurs, or harsh insults.
- Titles and descriptions must sound warm and cute, like a love journal — never sensational.
`.trim();

  return {
    isAdult,
    isSafe,
    sanitize,
    sanitizeMessages,
    safePreview,
    AI_SAFETY_RULES,
    REPLACEMENT,
  };
})();
