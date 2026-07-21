/**
 * Personalized love letter from chat data — new paragraph each reload
 */
const LoveLetter = (() => {
  const CLOSINGS = [
    'Forever yours, on every ordinary day and every extraordinary one.',
    'Yours today, tomorrow, and in every message yet to come.',
    'With all my heart — the way I said it then, and mean it still.',
    'Always your Hasan. Always home.',
  ];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function findSweetLine(messages) {
    const patterns = [
      /miss you|missing you/i,
      /love you|luv u|ily/i,
      /good morning|good night|sweet dreams/i,
      /forever|always yours|my everything/i,
      /sorry|forgive|make up/i,
      /chanda|chandaa|begum|jaan/i,
    ];
    for (const p of patterns) {
      const hit = messages.find((m) => ContentFilter.isSafe(m.text) && p.test(m.text) && m.text.length < 80);
      if (hit) return ContentFilter.safePreview(hit.text, 70);
    }
    return null;
  }

  function build(chatData, stats) {
    const daysWed = MomentAnalyzer.daysSinceWedding();
    const years = Math.floor(daysWed / 365);
    const first = chatData.messages.find((m) => ContentFilter.isSafe(m.text));
    const firstLine = first ? ContentFilter.safePreview(first.text, 60) : 'im home love';
    const sweet = findSweetLine(chatData.messages);
    const names = chatData.participants || ['Hasan', 'Lalarukh'];

    const intros = [
      `My dearest Lalarukh,\n\nI opened our chat — all ${stats.totalMessages.toLocaleString()} messages across ${stats.chatDays.toLocaleString()} days — and realised something simple: we never stopped choosing each other.`,
      `Lalarukh jaan,\n\n${daysWed.toLocaleString()} days since we said forever on July 22, 2022. I scrolled through our story and every chapter still feels like home.`,
      `To the one I call begum,\n\nThey say love is grand gestures. Ours is ${stats.totalMessages.toLocaleString()} small ones — good mornings, silly texts, make-ups, and quiet "miss you"s that kept us close.`,
      `My love,\n\nI read our first words again — "${firstLine}" — and smiled. That was the beginning of everything we built, message by message.`,
    ];

    const middles = [
      `We said "I love you" ${stats.loveCount.toLocaleString()} times in this chat alone — and I know each one meant something real. We laughed, we fought, we found our way back. That's not just history; that's us.`,
      `${years > 0 ? `${years} year${years > 1 ? 's' : ''} married, ` : ''}and still talking like teenagers some nights. We've grown, but the warmth never left.`,
      sweet
        ? `I keep coming back to when you wrote: "${sweet}" — because moments like that are why I never take us for granted.`
        : `Every busy day, every hard day, we still showed up for each other in this chat. That matters more than I say out loud.`,
      `This little love book holds our fights and our make-ups, our boring Tuesdays and our best days. I wouldn't trade a single line.`,
    ];

    const intro = pick(intros);
    const middle = pick(middles);
    const closing = pick(CLOSINGS);

    function formatName(raw) {
      if (!raw) return 'Lalarukh';
      const first = raw.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(Boolean)[0] || 'Lalarukh';
      return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }

    const toName = formatName(names.find((n) => /lalarukh/i.test(n)) || names[1]);

    return {
      paragraphs: [intro, middle, closing],
      signature: 'Hasan',
      to: toName,
    };
  }

  return { build };
})();
