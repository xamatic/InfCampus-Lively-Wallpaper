// Configurable prefire loader
// Override defaults by setting `window.PREFIRE_LOADER_CONFIG = { ... }` before this script runs.
const DEFAULTS = {
    endpoint: 'http://localhost:3001/grades',
    checkIntervalMs: 1000,
    backoff: false,
    backoffFactor: 1.6,
    maxIntervalMs: 60_000,
    maxRetries: null, // null = unlimited
    overlayMessage: 'Content is still loading. Make sure the server is started!',
    showRetryCounter: true,
    overlayStyles: {
        background: 'rgba(0,0,0,0.6)',
        color: '#fff',
        fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
        fontSize: '18px'
    }
};

const cfg = Object.assign({}, DEFAULTS, window.PREFIRE_LOADER_CONFIG || {});

const OVERLAY_ID = 'wp-loading-overlay';
const COUNTER_ID = 'wp-loading-counter';

let retryCount = 0;
let currentInterval = cfg.checkIntervalMs;
let pollTimeout = null;

function createLoadingOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '999999';
    overlay.style.padding = '20px';
    overlay.style.boxSizing = 'border-box';
    Object.assign(overlay.style, { background: cfg.overlayStyles.background, color: cfg.overlayStyles.color, fontFamily: cfg.overlayStyles.fontFamily, fontSize: cfg.overlayStyles.fontSize });

    const msg = document.createElement('div');
    msg.id = OVERLAY_ID + '-msg';
    msg.style.marginBottom = '8px';
    msg.style.textAlign = 'center';
    msg.textContent = cfg.overlayMessage;

    overlay.appendChild(msg);

    if (cfg.showRetryCounter) {
        const counter = document.createElement('div');
        counter.id = COUNTER_ID;
        counter.style.opacity = '0.9';
        counter.style.fontSize = '14px';
        counter.textContent = `Retried connections to the server: ${retryCount}`;
        overlay.appendChild(counter);
    }

    const append = () => (document.body || document.documentElement).appendChild(overlay);
    if (document.body) append(); else document.addEventListener('DOMContentLoaded', append);
}

function setOverlayMessage(msg) {
    const el = document.getElementById(OVERLAY_ID + '-msg');
    if (el) el.textContent = msg;
}

function setRetryCounter(n) {
    const el = document.getElementById(COUNTER_ID);
    if (el) el.textContent = `Retried connections to the server: ${n}`;
    if (typeof cfg.onRetry === 'function') {
        try { cfg.onRetry(n); } catch (e) { console.error(e); }
    }
}

function hideLoadingOverlay() {
    const el = document.getElementById(OVERLAY_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

createLoadingOverlay();

async function pollOnce() {
    try {
        await fetch(cfg.endpoint, { method: 'GET', mode: 'no-cors', cache: 'no-cache' });

        // Server reachable: inject wallpaper script (avoid fetch from file://)
        const script = document.createElement('script');
        script.type = 'text/javascript';
        try {
            script.src = new URL('../wallpaper/wallpaper.js', location.href).href;
        } catch (e) {
            script.src = '../wallpaper/wallpaper.js';
        }

script.onload = () => {
        try { hideLoadingOverlay(); } catch (e) {}
        };

        (document.head || document.documentElement).appendChild(script);

        if (pollTimeout) { clearTimeout(pollTimeout); pollTimeout = null; }
    } catch (err) {
        // failed, update counter and schedule next attempt
        retryCount += 1;
        setRetryCounter(retryCount);
        setOverlayMessage(cfg.overlayMessage);
        console.log(`Prefire-loader: server not online, retry #${retryCount}`);

        if (cfg.maxRetries !== null && retryCount >= cfg.maxRetries) {
            console.warn('Prefire-loader: reached maxRetries, stopping attempts');
            return;
        }

        // compute next interval
        if (cfg.backoff) {
            currentInterval = Math.min(Math.round(currentInterval * cfg.backoffFactor), cfg.maxIntervalMs);
        } else {
            currentInterval = cfg.checkIntervalMs;
        }

        pollTimeout = setTimeout(pollOnce, currentInterval);
    }
}

// Start polling
pollTimeout = setTimeout(pollOnce, 0);

// Expose control and state for interactive tweaking
window.PREFIRE_LOADER = {
    config: cfg,
    getRetryCount: () => retryCount,
    stop: () => { if (pollTimeout) { clearTimeout(pollTimeout); pollTimeout = null; } },
    start: () => { if (!pollTimeout) pollTimeout = setTimeout(pollOnce, 0); },
    hideOverlay: hideLoadingOverlay
};