/**
 * Local moment detection — no API required
 */
const MomentAnalyzer = (() => {
  const WEDDING_DATE = new Date(2022, 6, 22); // July 22, 2022

  const PATTERNS = {
    love: [
      /\b(i love you|love you so much|love u|luv u|ily|te amo|je t'aime)\b/i,
      /\b(my love|forever yours|soulmate|my everything|my heart)\b/i,
      /❤|💕|💗|💖|💘|🥰|😍|💑|💍/,
    ],
    sweet: [
      /\b(miss you|missing you|good morning|good night|sweet dreams|beautiful|handsome|cutie|baby|babe|hun|honey)\b/i,
      /\b(thank you|grateful|lucky to have|best day|made my day)\b/i,
      /🌸|🌹|☺|😊|🤗|💐/,
    ],
    reconciliation: [
      /\b(i'?m sorry|so sorry|forgive me|my fault|i was wrong|let'?s make up|don'?t be mad|can we talk)\b/i,
      /\b(i miss us|i need you|please talk to me|i hate fighting|let'?s fix this)\b/i,
    ],
    conflict: [
      /\b(angry|upset|annoyed|frustrated|disappointed|hurt me|you always|you never|leave me alone|don'?t talk to me)\b/i,
      /\b(fight|arguing|argument|mad at you|pissed|fed up)\b/i,
    ],
    milestone: [
      /\b(wedding|married|engaged|proposal|anniversary|moving in|pregnant|baby|vacation|trip|first date)\b/i,
      /\b(happy birthday|congrats|celebration|party|promotion|new job|new home)\b/i,
    ],
  };

  function formatDate(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function countMatches(messages, patterns) {
    return messages.filter((m) => !ContentFilter.isAdult(m.text) && patterns.some((p) => p.test(m.text))).length;
  }

  function findPeakDays(messages) {
    const byDay = {};
    messages.forEach((m) => {
      if (ContentFilter.isAdult(m.text)) return;
      const key = m.date.toDateString();
      byDay[key] = (byDay[key] || 0) + 1;
    });
    const sorted = Object.entries(byDay).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 5).map(([day, count]) => ({ day: new Date(day), count }));
  }

  function findFirstMessage(messages) {
    const safe = messages.find((m) => !ContentFilter.isAdult(m.text));
    if (!safe) return null;
    return {
      type: 'milestone',
      title: 'Where It All Began',
      date: safe.date,
      description: 'The very first message in your chat — the start of your story.',
      preview: ContentFilter.safePreview(safe.text),
      messages: [safe],
    };
  }

  function findAnniversaryMessages(messages) {
    const moments = [];
    const years = [2022, 2023, 2024, 2025, 2026];

    years.forEach((year) => {
      const dayMsgs = messages.filter((m) => {
        if (ContentFilter.isAdult(m.text)) return false;
        const d = m.date;
        return d.getMonth() === 6 && d.getDate() === 22 && d.getFullYear() === year;
      });

      if (dayMsgs.length >= 2) {
        const label = year === 2022 ? 'Our Wedding Day' : `${year - 2022}${getOrdinal(year - 2022)} Anniversary`;
        moments.push({
          type: 'anniversary',
          title: label,
          date: new Date(year, 6, 22),
          description: `${dayMsgs.length} messages on this special day — your love shining through.`,
          preview: ContentFilter.safePreview(dayMsgs.find((m) => PATTERNS.love.some((p) => p.test(m.text)))?.text || dayMsgs[0].text),
          messages: dayMsgs.slice(0, 20),
        });
      }
    });

    return moments;
  }

  function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  function findPatternMoments(messages, type, patterns, titleFn) {
    const moments = [];
    const window = 5;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (ContentFilter.isAdult(msg.text)) continue;
      if (!patterns.some((p) => p.test(msg.text))) continue;

      const nearby = messages.slice(Math.max(0, i - 2), i + window + 1)
        .filter((m) => !ContentFilter.isAdult(m.text));

      if (nearby.length < 2) continue;

      const dateKey = msg.date.toDateString();
      if (moments.some((m) => m.date.toDateString() === dateKey && m.type === type)) continue;

      moments.push({
        type,
        title: titleFn(msg, nearby),
        date: msg.date,
        description: getDescription(type, nearby.length),
        preview: ContentFilter.safePreview(msg.text),
        messages: nearby,
      });
    }

    return moments.slice(0, 8);
  }

  function getDescription(type, count) {
    const map = {
      love: 'A moment filled with love and warmth.',
      sweet: 'Something sweet that probably made you smile.',
      reconciliation: 'You found your way back to each other — that takes real love.',
      conflict: 'A tough moment — but every storm makes the calm sweeter.',
      milestone: 'A milestone worth remembering forever.',
    };
    return map[type] || `${count} messages around this moment.`;
  }

  function findReconciliationArcs(messages) {
    const moments = [];
    for (let i = 0; i < messages.length - 10; i++) {
      const chunk = messages.slice(i, i + 15).filter((m) => !ContentFilter.isAdult(m.text));
      if (chunk.length < 5) continue;

      const hasConflict = chunk.some((m) => PATTERNS.conflict.some((p) => p.test(m.text)));
      const hasReconcile = chunk.some((m) => PATTERNS.reconciliation.some((p) => p.test(m.text)));
      const hasLove = chunk.some((m) => PATTERNS.love.some((p) => p.test(m.text)));

      if (hasConflict && hasReconcile && hasLove) {
        const dateKey = chunk[0].date.toDateString();
        if (moments.some((m) => m.date.toDateString() === dateKey)) continue;

        moments.push({
          type: 'reconciliation',
          title: 'Fight → Forgive → Love',
          date: chunk[0].date,
          description: 'You went through a rough patch and came out stronger. That\'s real love.',
          preview: ContentFilter.safePreview(
            chunk.find((m) => PATTERNS.reconciliation.some((p) => p.test(m.text)))?.text || chunk[0].text
          ),
          messages: chunk,
        });
      }
    }
    return moments.slice(0, 6);
  }

  function findBusiestDays(messages, peaks) {
    return peaks.slice(0, 3).map((peak) => {
      const dayMsgs = messages.filter(
        (m) => m.date.toDateString() === peak.day.toDateString() && !ContentFilter.isAdult(m.text)
      );
      return {
        type: 'milestone',
        title: 'A Day Full of Us',
        date: peak.day,
        description: `${peak.count} messages — you couldn't stop talking! Must have been special.`,
        preview: ContentFilter.safePreview(dayMsgs[Math.floor(dayMsgs.length / 2)]?.text || ''),
        messages: dayMsgs.slice(0, 15),
      };
    });
  }

  function analyze(chatData) {
    const { messages, participants } = chatData;
    const safeMessages = messages.filter((m) => !ContentFilter.isAdult(m.text));

    const loveCount = countMatches(messages, PATTERNS.love);
    const peaks = findPeakDays(messages);
    const chatDays = new Set(safeMessages.map((m) => m.date.toDateString())).size;

    const moments = [
      findFirstMessage(messages),
      ...findAnniversaryMessages(messages),
      ...findBusiestDays(messages, peaks),
      ...findReconciliationArcs(messages),
      ...findPatternMoments(messages, 'love', PATTERNS.love, () => 'Love in the Air'),
      ...findPatternMoments(messages, 'sweet', PATTERNS.sweet, () => 'Something Sweet'),
      ...findPatternMoments(messages, 'conflict', PATTERNS.conflict, () => 'A Stormy Moment'),
      ...findPatternMoments(messages, 'milestone', PATTERNS.milestone, (msg) => {
        if (/wedding|married/i.test(msg.text)) return 'Wedding Bells';
        if (/birthday/i.test(msg.text)) return 'Birthday Love';
        return 'A Special Milestone';
      }),
    ].filter(Boolean);

    // Dedupe by date+type, sort newest first for mobile scrolling
    const seen = new Set();
    const unique = moments.filter((m) => {
      const key = `${m.type}-${m.date.toDateString()}-${m.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => b.date - a.date);

    return {
      stats: {
        totalMessages: messages.length,
        chatDays,
        loveCount,
        participants: participants.length,
      },
      moments: unique,
    };
  }

  function daysSinceWedding() {
    const now = new Date();
    const diff = now - WEDDING_DATE;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  return { analyze, daysSinceWedding, formatDate, WEDDING_DATE };
})();
