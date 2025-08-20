class Legend {
    constructor() {
        this.legends = {};
        this.attachEventListeners();
    }

    attachEventListeners() {
        const buttons = document.querySelectorAll('.help-button');
        buttons.forEach(button => {
            button.addEventListener('click', this.handleClick.bind(this));
        });
    }

    handleClick(event) {
        const legendId = event.target.dataset.legend;
        if (legendId) {
            this.toggle(legendId);
        }
        event.stopPropagation();
    }

    toggle(legendId) {
        const legendElement = document.getElementById(legendId);
        if (legendElement) {
            legendElement.style.display = (legendElement.style.display === 'none' || legendElement.style.display === '') ? 'block' : 'none';
        } else {
            console.error(`Legenda con ID "${legendId}" non trovata.`);
        }
    }
}