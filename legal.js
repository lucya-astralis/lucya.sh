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
(function () {
    const DEFAULT_LANG = 'en';
    const buttonEn = document.getElementById('lang-en');
    const buttonDe = document.getElementById('lang-de');
    const pageTitle = document.getElementById('page-title');

    function setLang(lang) {
        const safeLang = (lang === 'de' || lang === 'en') ? lang : DEFAULT_LANG;
        document.body.dataset.lang = safeLang;
        document.documentElement.lang = safeLang;

        const isEn = safeLang === 'en';
        buttonEn.setAttribute('aria-pressed', String(isEn));
        buttonDe.setAttribute('aria-pressed', String(!isEn));

        if (pageTitle) {
            pageTitle.textContent = isEn ? 'Privacy Policy' : 'Datenschutzerklärung';
        }
        document.title = isEn ? 'PRIVACY // LUCYA.SH' : 'DATENSCHUTZ // LUCYA.SH';
    }

    buttonEn.addEventListener('click', function () { setLang('en'); });
    buttonDe.addEventListener('click', function () { setLang('de'); });

    // Initial: respect browser preference, no persistence.
    const browserLang = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
    setLang(browserLang);
})();
