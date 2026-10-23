/* NextSIM 홍보 사이트 스크립트: 한/영 전환, 모바일 메뉴, 홍보 영상, 홈 히어로 · 작업 흐름 */

// ---------------------------------------------------------------- 한/영 전환
// 사용자 가이드(docs/)와 같은 저장 키를 써서, 사이트와 가이드를 오가도 언어가 유지된다.
(function () {
    const root = document.documentElement;
    const buttons = Array.from(document.querySelectorAll('.lang-switch button[data-lang]'));
    const apply = (lang, persist) => {
        root.setAttribute('data-lang', lang);
        root.setAttribute('lang', lang);
        buttons.forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false'));
        if (persist) {
            try { window.localStorage.setItem('nextsim-doc-lang', lang); } catch (e) { /* 무시 */ }
        }
    };
    // 브라우저 언어로 정해진 경우에도 저장해 둔다. 그래야 사용자 가이드가 같은 언어로 열린다.
    apply(root.getAttribute('data-lang') === 'en' ? 'en' : 'ko', true);
    buttons.forEach(b => b.addEventListener('click', () => {
        apply(b.dataset.lang, true);
        // ?lang= 로 들어왔다면 주소도 맞춰 둔다 (공유 링크가 지금 언어를 가리키도록)
        const url = new URL(window.location.href);
        if (url.searchParams.has('lang')) {
            url.searchParams.set('lang', b.dataset.lang);
            window.history.replaceState(null, '', url);
        }
    }));
})();

// ---------------------------------------------------------------- 모바일 메뉴
(function () {
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.getElementById('siteNav');
    if (!toggle || !nav) return;
    const setOpen = (open) => {
        nav.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
})();

// ---------------------------------------------------------------- 홍보 영상 자리
// <div class="video" data-youtube="영상 ID"> 또는 data-src="assets/video/x.mp4" 이면 그 자리에 플레이어를 넣는다.
// 둘 다 비어 있으면 "준비 중" 안내를 그대로 둔다.
(function () {
    document.querySelectorAll('.video').forEach((box) => {
        const id = (box.dataset.youtube || '').trim();
        const src = (box.dataset.src || '').trim();
        if (id) {
            const frame = document.createElement('iframe');
            frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
            frame.title = 'NextSIM';
            frame.loading = 'lazy';
            frame.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';
            frame.allowFullscreen = true;
            box.replaceChildren(frame);
        } else if (src) {
            const video = document.createElement('video');
            video.src = src;
            video.controls = true;
            video.preload = 'metadata';
            video.playsInline = true;
            video.setAttribute('aria-label', 'NextSIM');
            if (box.dataset.poster) video.poster = box.dataset.poster;
            box.replaceChildren(video);
        }
    });
})();

// ---------------------------------------------------------------- 홈 히어로
// 영상 루프는 동작 줄이기 설정이면 첫 장면에서 멈춘다. 홈 헤더는 조금 내리면 바탕이 생긴다.
(function () {
    const loop = document.querySelector('.hero__loop');
    if (loop && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        loop.removeAttribute('autoplay');
        loop.pause();
    }
    const bar = document.querySelector('.topbar--overlay');
    if (bar) {
        const onScroll = () => bar.classList.toggle('is-scrolled', window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }
})();

// ---------------------------------------------------------------- 소개 영상 대화 상자
// [data-open-video="dialog id"] 가 대화 상자를 연다. 닫으면 영상을 멈춘다 (YouTube 는 iframe 주소를 다시 넣어 멈춘다).
(function () {
    document.querySelectorAll('[data-open-video]').forEach((btn) => {
        const dlg = document.getElementById(btn.dataset.openVideo);
        if (!dlg || typeof dlg.showModal !== 'function') return;
        const stop = () => {
            const v = dlg.querySelector('video');
            if (v) v.pause();
            const f = dlg.querySelector('iframe');
            if (f) f.src = f.src;
        };
        btn.addEventListener('click', () => {
            dlg.showModal();
            const v = dlg.querySelector('video');
            if (v) v.play().catch(() => { /* 자동 재생이 막히면 사용자가 누른다 */ });
        });
        dlg.querySelector('[data-close-video]')?.addEventListener('click', () => dlg.close());
        dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });  // 바깥(배경) 클릭
        dlg.addEventListener('close', stop);
    });
})();

// ---------------------------------------------------------------- 홈 작업 흐름
// 화면 가운데에 온 단계를 켜고, 오른쪽 고정 화면의 진행선 · 그림 · 수치 띠 · 설명을 그 단계로 바꾼다.
// 숫자는 0부터 올라가고 막대는 채워지며, 재생 단계에서는 재생 시각이 08:00~09:00 구간을 돈다.
(function () {
    const steps = Array.from(document.querySelectorAll('.story__step'));
    if (!steps.length || !('IntersectionObserver' in window)) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shots = Array.from(document.querySelectorAll('.story__frame img'));
    const nodes = Array.from(document.querySelectorAll('.story__node'));
    const panels = Array.from(document.querySelectorAll('.story__panel'));
    const fill = document.querySelector('.story__fill');
    const caption = document.querySelector('.story__caption');
    let current = -1;
    let raf = 0;

    const countUp = (el) => {
        const end = Number(el.dataset.count);
        const t0 = performance.now();
        const tick = (now) => {
            const k = reduce ? 1 : Math.min(1, (now - t0) / 900);
            el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))).toLocaleString('en-US');
            if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };

    // 화면 속 재생 시각 08:30:00 에서 출발해 한 시간 구간을 12초에 한 바퀴 돈다
    const playClock = (panel) => {
        const clock = panel.querySelector('.story__clock');
        if (!clock || reduce) return;
        const head = panel.querySelector('.story__head');
        const done = panel.querySelector('.story__done');
        const t0 = performance.now();
        const tick = (now) => {
            const sec = (1800 + (now - t0) / 12000 * 3600) % 3600;
            head.style.left = done.style.width = (sec / 36) + '%';
            const t = 8 * 3600 + Math.floor(sec);
            clock.textContent = [t / 3600, t / 60 % 60, t % 60].map((v) => String(Math.floor(v)).padStart(2, '0')).join(':');
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
    };

    const activate = (i) => {
        if (i === current) return;
        current = i;
        cancelAnimationFrame(raf);
        steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
        shots.forEach((s, k) => s.classList.toggle('is-on', k === i));
        nodes.forEach((n, k) => {
            n.classList.toggle('is-done', k < i);
            n.classList.toggle('is-now', k === i);
        });
        if (fill) fill.style.width = `calc(${i / (nodes.length - 1)} * (100% - 100% / 6))`;
        panels.forEach((p, k) => {
            p.classList.toggle('is-on', k === i);
            // 막대는 꺼진 패널에서 0으로 되돌려 두었다가 켜질 때 다시 채운다
            p.querySelectorAll('.story__bar i').forEach((b) => { b.style.width = k === i ? b.dataset.w + '%' : '0'; });
        });
        const panel = panels[i];
        if (panel) {
            panel.querySelectorAll('[data-count]').forEach(countUp);
            playClock(panel);
        }
        // 설명은 단계 그림의 figcaption 을 그대로 옮긴다 (한/영 span 포함)
        const cap = steps[i].querySelector('figcaption');
        if (caption && cap) caption.innerHTML = cap.innerHTML;
    };
    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) activate(Number(e.target.dataset.step)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach((s) => io.observe(s));
    activate(0);
})();
