/**
 * WhatsApp Chat Export Parser
 * Supports multiple export formats from iOS and Android
 */

const WhatsAppParser = (() => {
  // [DD/MM/YYYY, HH:MM:SS] Name: Message  (Android / some iOS)
  const PATTERN_BRACKET = /^\[(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\]\s*([^:]+):\s(.*)$/;

  // DD/MM/YYYY, HH:MM - Name: Message  (Android alternate)
  const PATTERN_DASH = /^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\s*[-–—]\s*([^:]+):\s(.*)$/;

  // [DD/MM/YYYY, HH:MM:SS] Name (phone): Message
  const PATTERN_PHONE = /^\[(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\]\s*(.+?):\s(.*)$/;

  function parseDate(dateStr, timeStr) {
    const normalized = dateStr.replace(/[\.\-]/g, '/');
    const parts = normalized.split('/').map(Number);

    let day, month, year;
    if (parts[2] > 31 || parts[2] > 999) {
      // DD/MM/YYYY or MM/DD/YYYY — detect by value
      if (parts[0] > 12) {
        day = parts[0];
        month = parts[1];
        year = parts[2];
      } else if (parts[1] > 12) {
        month = parts[0];
        day = parts[1];
        year = parts[2];
      } else {
        // Ambiguous — assume DD/MM (common outside US)
        day = parts[0];
        month = parts[1];
        year = parts[2];
      }
    } else {
      day = parts[0];
      month = parts[1];
      year = parts[2];
    }

    if (year < 100) year += 2000;

    let hours = 0, minutes = 0, seconds = 0;
    const timeClean = timeStr.trim();
    const ampmMatch = timeClean.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap][Mm])?/);

    if (ampmMatch) {
      hours = parseInt(ampmMatch[1], 10);
      minutes = parseInt(ampmMatch[2], 10);
      seconds = ampmMatch[3] ? parseInt(ampmMatch[3], 10) : 0;
      const ampm = ampmMatch[4];
      if (ampm) {
        const upper = ampm.toUpperCase();
        if (upper === 'PM' && hours !== 12) hours += 12;
        if (upper === 'AM' && hours === 12) hours = 0;
      }
    }

    return new Date(year, month - 1, day, hours, minutes, seconds);
  }

  function normalizeLine(line) {
    return line
      .replace(/\uFEFF/g, '')
      .replace(/\u202F/g, ' ')
      .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
      .trim();
  }

  function tryMatchLine(rawLine) {
    const line = normalizeLine(rawLine);
    if (!line) return null;

    for (const pattern of [PATTERN_BRACKET, PATTERN_DASH, PATTERN_PHONE]) {
      const match = line.match(pattern);
      if (match) {
        const [, dateStr, timeStr, sender, text] = match;
        const date = parseDate(dateStr, timeStr);
        if (!isNaN(date.getTime())) {
          return {
            date,
            sender: sender.trim(),
            text: text.trim()
          };
        }
      }
    }
    return null;
  }

  function parse(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    const messages = [];
    let current = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      const parsed = tryMatchLine(line);

      if (parsed) {
        if (current) messages.push(current);
        current = {
          date: parsed.date,
          sender: parsed.sender,
          text: parsed.text,
          timestamp: parsed.date.getTime()
        };
      } else if (current) {
        // Continuation of previous message (multiline)
        current.text += '\n' + line;
      }
    }

    if (current) messages.push(current);

    // Filter system messages that aren't real chat
    const filtered = messages.filter(m => {
      const t = m.text.toLowerCase();
      if (t.includes('messages and calls are end-to-end encrypted')) return false;
      if (t.includes('created group')) return false;
      if (t.includes('changed the subject')) return false;
      if (t.includes('changed this group')) return false;
      if (t.includes('added you')) return false;
      if (t.includes('left') && t.sender === '') return false;
      return m.text.length > 0;
    });

    filtered.sort((a, b) => a.timestamp - b.timestamp);

    const participants = [...new Set(filtered.map(m => m.sender))];
    const dateRange = filtered.length > 0
      ? { start: filtered[0].date, end: filtered[filtered.length - 1].date }
      : null;

    return {
      messages: filtered,
      participants,
      dateRange,
      totalMessages: filtered.length
    };
  }

  return { parse };
})();
