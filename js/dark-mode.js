// dark-mode.js — Toggle dark mode con persistenza localStorage
(function() {
    // Applica il tema salvato SUBITO (prima del render per evitare flash)
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Quando il DOM è pronto, inietta il bottone toggle
    document.addEventListener('DOMContentLoaded', function() {
        const btn = document.createElement('button');
        btn.className = 'dark-mode-toggle';
        btn.title = 'Cambia tema';
        btn.setAttribute('aria-label', 'Cambia tema chiaro/scuro');
        updateIcon(btn);
        document.body.appendChild(btn);

        btn.addEventListener('click', function() {
            const current = document.documentElement.getAttribute('data-theme');
            if (current === 'dark') {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
            updateIcon(btn);
        });
    });

    function updateIcon(btn) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        btn.textContent = isDark ? '☀️' : '🌙';
    }
})();
