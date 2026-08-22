// ---------- WALLPAPER VIDEO ----------------------------------------
// the <video> ships without src; in lite mode it never loads a byte.
// pausing while the tab is hidden keeps it off the decoder.
(function () {
    const video = document.querySelector('.wallpaper-video');

    if (video && !window.LUCYA_LITE && video.dataset.src) {
        video.src = video.dataset.src;
        video.autoplay = true;
        if (video.play) video.play().catch(function () {});
    }

    document.addEventListener('visibilitychange', function () {
        if (!video || !video.src) return;
        if (document.hidden) video.pause();
        else video.play().catch(function () {});
    });
})();

// ---------- LANGUAGE TOGGLE ----------------------------------------
// Both language versions sit in the DOM and are gated by CSS. That means
// section ids would collide, so only ONE block ever carries them: the EN
// markup ships with the ids (so anchors work without JS), and switching
// hands them over to the other block. Everything a visitor picks is
// reflected in the URL (?lang=) so a specific version stays linkable.
(function () {
    const DEFAULT_LANG = 'en';
    const STORAGE_KEY = 'lucya-lang';

    const buttonEn = document.getElementById('lang-en');
    const buttonDe = document.getElementById('lang-de');
    const pageTitle = document.getElementById('page-title');
    const pageSub = document.getElementById('page-sub');
    const stampDoc = document.getElementById('stamp-doc');
    const footMark = document.getElementById('foot-mark-text');

    // one place for every string the toggle has to swap
    const STAND = '2026-08-22';
    const TEXT = {
        en: {
            title: 'Legal notice & privacy policy',
            docTitle: 'LEGAL // LUCYA.SH',
            stamp: 'imprint & privacy policy',
            sub: 'private project · non-commercial · self-hosted · EU/DE · last updated ' + STAND,
            foot: '// end of document · last updated ' + STAND
        },
        de: {
            title: 'Impressum & Datenschutz',
            docTitle: 'IMPRESSUM & DATENSCHUTZ // LUCYA.SH',
            stamp: 'impressum & datenschutz',
            sub: 'privates projekt · nicht-kommerziell · self-hosted · EU/DE · stand ' + STAND,
            foot: '// ende des dokuments · stand ' + STAND
        }
    };

    function setText(el, value) {
        if (el) el.textContent = value;
    }

    // Move the section ids to whichever language block is visible, so a
    // #hash always resolves to something the visitor can actually see.
    function moveIds(lang) {
        const blocks = document.querySelectorAll('.lang');
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const active = block.classList.contains('lang-' + lang);
            const sections = block.querySelectorAll('[data-sec]');
            for (let j = 0; j < sections.length; j++) {
                if (active) sections[j].id = sections[j].dataset.sec;
                else sections[j].removeAttribute('id');
            }
        }
    }

    function setLang(lang, updateUrl) {
        const safeLang = (lang === 'de' || lang === 'en') ? lang : DEFAULT_LANG;
        const copy = TEXT[safeLang];

        document.body.dataset.lang = safeLang;
        document.documentElement.lang = safeLang;

        const isEn = safeLang === 'en';
        if (buttonEn) buttonEn.setAttribute('aria-pressed', String(isEn));
        if (buttonDe) buttonDe.setAttribute('aria-pressed', String(!isEn));

        setText(pageTitle, copy.title);
        setText(pageSub, copy.sub);
        setText(stampDoc, copy.stamp);
        setText(footMark, copy.foot);
        document.title = copy.docTitle;

        moveIds(safeLang);

        try { localStorage.setItem(STORAGE_KEY, safeLang); } catch (e) {}

        // keep ?lang= in sync without adding a history entry, so the
        // address bar always holds a link to what is actually on screen
        if (updateUrl && window.history && history.replaceState) {
            // URL keeps the existing #hash, so the section stays linked too
            const url = new URL(window.location.href);
            url.searchParams.set('lang', safeLang);
            history.replaceState(null, '', url.toString());
        }
    }

    if (buttonEn) buttonEn.addEventListener('click', function () { setLang('en', true); });
    if (buttonDe) buttonDe.addEventListener('click', function () { setLang('de', true); });

    // Precedence: explicit ?lang= in the URL, then the visitor's own earlier
    // choice, then the browser preference.
    function initialLang() {
        let param = null;
        try { param = new URL(window.location.href).searchParams.get('lang'); } catch (e) {}
        if (param === 'de' || param === 'en') return param;

        let stored = null;
        try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}
        if (stored === 'de' || stored === 'en') return stored;

        return (navigator.language || DEFAULT_LANG).toLowerCase().indexOf('de') === 0 ? 'de' : DEFAULT_LANG;
    }

    setLang(initialLang(), false);

    // The ids only exist after the switch above, so a #hash the browser
    // could not resolve during load has to be re-applied by hand.
    if (window.location.hash.length > 1) {
        const target = document.getElementById(window.location.hash.slice(1));
        if (target) target.scrollIntoView();
    }
})();
