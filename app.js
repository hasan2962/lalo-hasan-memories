/**
 * Our Love Story — card-first UI
 */
(() => {
  const env = () => window.ENV || {};
  const GRID_LIMIT = 12;

  const TYPE_META = {
    love: { emoji: '💕', label: 'Love', gradient: 'grad-love' },
    milestone: { emoji: '🎉', label: 'Milestone', gradient: 'grad-milestone' },
    reconciliation: { emoji: '🤝', label: 'Make-up', gradient: 'grad-reconcile' },
    conflict: { emoji: '🌧️', label: 'Tough time', gradient: 'grad-conflict' },
    sweet: { emoji: '🌸', label: 'Sweet', gradient: 'grad-sweet' },
    anniversary: { emoji: '💍', label: 'Anniversary', gradient: 'grad-anniversary' },
  };

  const LOADING_MESSAGES = [
    'Opening our memories...',
    'Counting every I love you...',
    'Finding the sweet spots...',
    'Almost ready, jaan...',
  ];

  const state = {
    chatData: null,
    moments: [],
    displayMoments: [],
    activeFilter: 'all',
    showAll: false,
    peekMessages: [],
    siteReady: false,
    letterReady: false,
    controlsShown: false,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function init() {
    $('#footerYear').textContent = new Date().getFullYear();
    animateCounter('#daysTogether', MomentAnalyzer.daysSinceWedding());
    $('#statYears').textContent = Math.floor(MomentAnalyzer.daysSinceWedding() / 365);

    setupFilters();
    setupSearch();
    setupPeekModal();
    setupScrollReveal();
    setupShowMore();
    createFloatingHearts();
    createSparkles();
    createGlyphField();
    createLoaderGlyphs();
    spawnGlyphs($('.letter-intro-glyphs'), 12, 'glyph');

    showInitialLoader();
    startLoadingMessages();
    setLoaderProgress(8);
    $('#letterContinue').addEventListener('click', dismissLetter);

    try {
      await EnvLoader.load();
      setLoaderProgress(18);
      await loadChat();
      setLoaderProgress(100);
      await wait(450);
      await transitionLoaderToLetter();
    } catch (err) {
      setLoaderProgress(100);
      await wait(350);
      await transitionLoaderToLetter();
      $('#letterBody').innerHTML = `<p class="letter-err">${escapeHtml(err.message || 'Could not load our story.')}</p>`;
      state.letterReady = true;
      revealLetterControls();
    }
  }

  function showInitialLoader() {
    const overlay = $('#loaderOverlay');
    overlay.classList.remove('hidden', 'loader-out');
    setLoaderProgress(0);
  }

  async function transitionLoaderToLetter() {
    document.body.classList.add('letter-open');
    $('#letterIntro').classList.remove('hidden');
    startLetterIntro();
    scheduleLetterControls();
    hideLoader();
    stopLoadingMessages();
  }

  function startLetterIntro() {
    const paper = $('#letterPaper');
    const scene = $('#letterScene');
    const envelope = $('#envelope');
    const actions = $('#letterActions');

    paper.classList.remove('slide-out', 'expand');
    scene.classList.remove('rise');
    envelope.classList.remove('open', 'revealed');
    actions.classList.remove('ready');
    state.controlsShown = false;

    setTimeout(() => envelope.classList.add('open'), 500);
    setTimeout(() => paper.classList.add('slide-out'), 1300);
    setTimeout(() => paper.classList.add('expand'), 2300);
    setTimeout(() => scene.classList.add('rise'), 2900);
    setTimeout(() => envelope.classList.add('revealed'), 4800);
  }

  function populateLetter(letter) {
    $('#letterTo').textContent = `To my ${letter.to},`;
    const body = $('#letterBody');
    body.innerHTML = letter.paragraphs
      .map((p, i) => {
        const lines = p.split('\n\n').map((line) => `<span class="letter-line">${escapeHtml(line)}</span>`).join('');
        return `<p class="letter-para" style="animation-delay:${0.3 + i * 0.45}s">${lines}</p>`;
      })
      .join('');

    state.letterReady = true;
  }

  function scheduleLetterControls() {
    if (!state.letterReady || state.controlsShown) return;
    setTimeout(() => revealLetterControls(), 5200);
  }

  function revealLetterControls() {
    if (state.controlsShown) return;
    state.controlsShown = true;
    $('#letterActions').classList.add('ready');
  }

  async function dismissLetter() {
    const intro = $('#letterIntro');
    intro.classList.add('letter-out');
    document.body.classList.remove('letter-open');

    setTimeout(async () => {
      intro.classList.add('hidden');
      document.body.classList.remove('intro-active');

      if (state.siteReady) {
        showResults();
        if (env().AUTO_RUN_AI !== 'false') await runAIAnalysis(false);
      } else {
        $('#loaderOverlay').classList.remove('hidden');
        setLoaderProgress(30);
        startLoadingMessages();
      }
    }, 650);
  }

  function setLoaderProgress(pct) {
    const bar = $('#loaderBar');
    if (bar) bar.style.width = `${Math.min(pct, 100)}%`;
  }

  function hideLoader() {
    const overlay = $('#loaderOverlay');
    if (!overlay) return;
    setLoaderProgress(100);
    overlay.classList.add('loader-out');
    setTimeout(() => overlay.classList.add('hidden'), 800);
  }

  async function loadChat() {
    const chatFile = env().CHAT_FILE || '_chat.txt';
    setLoaderProgress(28);

    const response = await fetch(chatFile);
    if (!response.ok) throw new Error(`Could not load ${chatFile}.`);

    setLoaderProgress(42);
    state.chatData = WhatsAppParser.parse(await response.text());

    if (state.chatData.totalMessages === 0) {
      throw new Error('No messages found.');
    }

    setLoaderProgress(58);
    const result = MomentAnalyzer.analyze(state.chatData);
    setLoaderProgress(72);

    state.moments = result.moments;
    state.displayMoments = state.moments;

    renderStats(result.stats);
    renderFeatured(state.moments);
    renderMemoryGrid();

    setLoaderProgress(82);
    const letter = LoveLetter.build(state.chatData, result.stats);
    populateLetter(letter);

    setLoaderProgress(92);
    state.siteReady = true;
    document.body.classList.add('loaded');
    showAiRetryButton();
  }

  function renderStats(stats) {
    animateCounter('#statMessages', stats.totalMessages);
    animateCounter('#statDays', stats.chatDays);
    animateCounter('#statLove', stats.loveCount);
  }

  function renderFeatured(moments) {
    const pick =
      moments.find((m) => m.type === 'anniversary') ||
      moments.find((m) => m.title === 'Where It All Began') ||
      moments[0];

    if (!pick) return;

    const meta = TYPE_META[pick.type] || TYPE_META.sweet;
    const card = $('#featuredCard');
    card.className = `featured-card reveal ${meta.gradient}`;
    card.innerHTML = `
      <span class="featured-emoji">${meta.emoji}</span>
      <p class="featured-label">Featured moment</p>
      <h3>${escapeHtml(pick.title)}</h3>
      <p class="featured-date">${MomentAnalyzer.formatDate(pick.date)}</p>
      <p class="featured-desc">${escapeHtml(pick.description)}</p>
      <span class="featured-cta">Tap to peek inside →</span>
    `;
    card.onclick = () => openPeek(pick);
    observeRevealElements();
  }

  function renderMemoryGrid() {
    const grid = $('#memoryGrid');
    const filtered = getFilteredMoments();
    const slice = state.showAll ? filtered : filtered.slice(0, GRID_LIMIT);

    grid.innerHTML = slice
      .map((m, i) => {
        const meta = TYPE_META[m.type] || TYPE_META.sweet;
        return `
        <article class="memory-card reveal ${meta.gradient}" data-type="${m.type}" style="animation-delay:${Math.min(i * 0.05, 0.4)}s">
          <div class="memory-card-top">
            <span class="memory-emoji">${meta.emoji}</span>
            <span class="memory-pill">${meta.label}</span>
          </div>
          <h3>${escapeHtml(m.title)}</h3>
          <p class="memory-date">${MomentAnalyzer.formatDate(m.date)}</p>
          <p class="memory-desc">${escapeHtml(m.description)}</p>
          <span class="memory-tap">Peek →</span>
        </article>`;
      })
      .join('');

    $$('#memoryGrid .memory-card').forEach((el, i) => {
      el.addEventListener('click', () => openPeek(slice[i]));
    });

    const btn = $('#showMoreBtn');
    if (filtered.length > GRID_LIMIT) {
      btn.classList.remove('hidden');
      btn.textContent = state.showAll
        ? 'Show less'
        : `Show ${filtered.length - GRID_LIMIT} more moments`;
    } else {
      btn.classList.add('hidden');
    }

    observeRevealElements();
  }

  function getFilteredMoments() {
    if (state.activeFilter === 'all') return state.displayMoments;
    return state.displayMoments.filter((m) => m.type === state.activeFilter);
  }

  function openPeek(moment) {
    if (!moment) return;

    const meta = TYPE_META[moment.type] || TYPE_META.sweet;
    $('#peekBadge').textContent = `${meta.emoji} ${meta.label}`;
    $('#peekTitle').textContent = moment.title;
    $('#peekDate').textContent = MomentAnalyzer.formatDate(moment.date);
    $('#peekDesc').textContent = moment.description;

    state.peekMessages = (moment.messages || []).filter((m) => ContentFilter.isSafe(m.text));
    renderPeekBubbles(state.peekMessages.slice(0, 12));
    $('#searchInput').value = '';

    $('#peekModal').classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closePeek() {
    $('#peekModal').classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function renderPeekBubbles(messages) {
    const container = $('#peekBubbles');
    if (!messages.length) {
      container.innerHTML = '<p class="peek-empty">No messages to show for this moment.</p>';
      return;
    }

    const senders = [...new Set(messages.map((m) => m.sender))];
    const you = senders[0];

    container.innerHTML = messages
      .map((m) => {
        const mine = m.sender === you;
        return `
        <div class="bubble-wrap ${mine ? 'mine' : 'theirs'}">
          <span class="bubble-name">${escapeHtml(m.sender.split(' ')[0])}</span>
          <div class="bubble">${escapeHtml(m.text)}</div>
          <span class="bubble-time">${formatMsgDate(m.date)}</span>
        </div>`;
      })
      .join('');
  }

  function setupPeekModal() {
    $('#peekClose').addEventListener('click', closePeek);
    $('#peekBackdrop').addEventListener('click', closePeek);
  }

  function setupShowMore() {
    $('#showMoreBtn').addEventListener('click', () => {
      state.showAll = !state.showAll;
      renderMemoryGrid();
    });
  }

  function setupFilters() {
    $$('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeFilter = btn.dataset.filter;
        state.showAll = false;
        renderMemoryGrid();
      });
    });
  }

  function setupSearch() {
    let debounce;
    $('#searchInput').addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const q = e.target.value.trim().toLowerCase();
        if (!q) {
          renderPeekBubbles(state.peekMessages.slice(0, 12));
          return;
        }
        const hits = state.peekMessages.filter((m) => m.text.toLowerCase().includes(q)).slice(0, 20);
        renderPeekBubbles(hits);
      }, 200);
    });
  }

  async function runAIAnalysis(force = true) {
    const cached = !force && AIMemory.getCached(state.chatData);
    if (cached?.length) {
      applyAIResults(cached);
      return;
    }

    if (!AIMemory.getProvider()) return;

    $('#aiLoading').classList.remove('hidden');
    $('#aiRetryBtn').classList.add('hidden');

    try {
      const { results, source } = await AIMemory.analyzeMoments(state.chatData, state.moments);
      if (source === 'groq' || source === 'cache') applyAIResults(results);
    } catch {
      showToast('AI enhancement skipped — your moments still look lovely ✨');
      showAiRetryButton();
    } finally {
      $('#aiLoading').classList.add('hidden');
    }
  }

  function applyAIResults(aiItems) {
    state.displayMoments = aiItems.map((r, i) => {
      const orig = state.moments[i] || state.moments.find((m) => m.type === r.category) || state.moments[0];
      return {
        type: r.category || orig?.type || 'sweet',
        title: r.title,
        date: orig?.date || new Date(),
        description: r.description,
        preview: r.quote,
        messages: orig?.messages || [],
        enhanced: true,
      };
    });
    $('#momentsSubtitle').textContent = '✨ Enhanced with AI — tap any card';
    renderFeatured(state.displayMoments);
    renderMemoryGrid();
    showAiRetryButton();
  }

  function showAiRetryButton() {
    const btn = $('#aiRetryBtn');
    if (!btn) return;
    btn.classList.remove('hidden');
    btn.textContent = AIMemory.getProvider() ? '✨ Enhance with AI' : '✨ Enhance (add Groq key)';
    btn.onclick = () => runAIAnalysis(true);
  }

  function showResults() {
    hideLoader();
    stopLoadingMessages();
    showSection('results');
    observeRevealElements();
  }

  function showSection(mode) {
    ['#statsSection', '#featuredSection', '#momentsSection'].forEach((sel) => {
      $(sel).classList.add('hidden');
    });
    const map = {
      results: ['#statsSection', '#featuredSection', '#momentsSection'],
    };
    (map[mode] || []).forEach((sel) => {
      $(sel).classList.remove('hidden');
      $(sel).classList.add('section-enter');
    });
  }

  function setupScrollReveal() {
    if (!('IntersectionObserver' in window)) return;
    state.revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            state.revealObserver.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );
  }

  function observeRevealElements() {
    if (!state.revealObserver) return;
    $$('.reveal:not(.visible)').forEach((el) => state.revealObserver.observe(el));
  }

  function animateCounter(selector, target) {
    const el = $(selector);
    if (!el) return;
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = Math.floor(target * (1 - Math.pow(1 - p, 3))).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function startLoadingMessages() {
    let i = 0;
    state.loadingInterval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      const el = $('#loadingText');
      if (el) el.textContent = LOADING_MESSAGES[i];
    }, 2200);
  }

  function stopLoadingMessages() {
    if (state.loadingInterval) clearInterval(state.loadingInterval);
  }

  function showToast(msg) {
    let toast = $('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function createFloatingHearts() {
    const container = $('.floating-hearts');
    for (let i = 0; i < 8; i++) {
      const span = document.createElement('span');
      span.textContent = ['♥', '♡', '💕'][i % 3];
      span.style.left = `${5 + i * 12}%`;
      span.style.top = `${10 + (i % 4) * 22}%`;
      span.style.animationDelay = `${-i * 2.5}s`;
      span.style.animationDuration = `${14 + i * 2}s`;
      container.appendChild(span);
    }
  }

  function createSparkles() {
    const container = $('.sparkles');
    for (let i = 0; i < 18; i++) {
      const dot = document.createElement('span');
      dot.style.left = `${Math.random() * 100}%`;
      dot.style.top = `${Math.random() * 100}%`;
      dot.style.animationDelay = `${Math.random() * 5}s`;
      dot.style.animationDuration = `${2 + Math.random() * 4}s`;
      container.appendChild(dot);
    }
  }

  const GLYPHS = ['♥', '♡', '💕', '💗', '🌸', '✨', '💍', '🦋', '⭐', '💫', '🌹', '☾'];

  function spawnGlyphs(container, count, className) {
    const anims = ['glyph-drift-r', 'glyph-drift-l', 'glyph-float-up', 'glyph-float-diag'];

    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = className;
      el.textContent = GLYPHS[i % GLYPHS.length];
      el.style.left = `${Math.random() * 100}%`;
      el.style.top = `${Math.random() * 100}%`;
      el.style.fontSize = `${0.65 + Math.random() * 1.1}rem`;
      el.style.animationName = anims[i % anims.length];
      el.style.animationDuration = `${8 + Math.random() * 14}s`;
      el.style.animationDelay = `${-Math.random() * 20}s`;
      el.style.opacity = `${0.06 + Math.random() * 0.12}`;
      container.appendChild(el);
    }
  }

  function createGlyphField() {
    spawnGlyphs($('#glyphField'), 28, 'glyph');
  }

  function createLoaderGlyphs() {
    spawnGlyphs($('#loaderGlyphs'), 16, 'loader-glyph');
  }

  function formatMsgDate(date) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
