// js/chat-modal.js
function closeChatModal() {
    const modal = document.getElementById('chatModal');
    const overlay = document.getElementById('modalOverlay'); // Potrebbe essere lo stesso overlay
    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
}

// Qui aggiungerai la logica per la chat.

console.log('Script del modal chat caricato.');