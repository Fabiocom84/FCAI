// js/search-modal.js
function closeSearchModal() {
    const modal = document.getElementById('searchModal');
    const overlay = document.getElementById('modalOverlay'); // Potrebbe essere lo stesso overlay
    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
}

// Qui aggiungerai la logica per la ricerca.

console.log('Script del modal ricerca caricato.');