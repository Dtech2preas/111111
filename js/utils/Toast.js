class Toast {
    static init() {
        if (document.getElementById('dtech-toast-container')) return;

        const style = document.createElement('style');
        style.textContent = `
            #dtech-toast-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 9999;
            }
            .dtech-toast {
                min-width: 250px;
                background-color: #333;
                color: #fff;
                padding: 15px 20px;
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-family: sans-serif;
                font-size: 14px;
                opacity: 0;
                transform: translateY(20px);
                transition: opacity 0.3s ease, transform 0.3s ease;
            }
            .dtech-toast.show {
                opacity: 1;
                transform: translateY(0);
            }
            .dtech-toast.success { background-color: #38a169; }
            .dtech-toast.error { background-color: #e53e3e; }
            .dtech-toast.info { background-color: #3182ce; }
            .dtech-toast.warning { background-color: #dd6b20; }
            .dtech-toast-close {
                cursor: pointer;
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                line-height: 1;
                padding: 0;
                margin-left: 15px;
                opacity: 0.8;
            }
            .dtech-toast-close:hover { opacity: 1; }
        `;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.id = 'dtech-toast-container';
        document.body.appendChild(container);
    }

    static show(message, type = 'info', duration = 3000) {
        this.init();
        const container = document.getElementById('dtech-toast-container');

        const toast = document.createElement('div');
        toast.className = `dtech-toast ${type}`;

        const text = document.createElement('span');
        text.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.className = 'dtech-toast-close';
        closeBtn.onclick = () => this.hide(toast);

        toast.appendChild(text);
        toast.appendChild(closeBtn);

        container.appendChild(toast);

        // Trigger reflow to enable transition
        toast.offsetHeight;
        toast.classList.add('show');

        if (duration > 0) {
            setTimeout(() => {
                this.hide(toast);
            }, duration);
        }
    }

    static hide(toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300); // Wait for transition
    }
}

// Make it globally available
window.Toast = Toast;
