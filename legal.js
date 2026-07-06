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
