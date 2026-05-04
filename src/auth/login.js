import { AuthService } from './authService.js';
import { canAccessAdmin } from './rolePolicy.js';
import { escapeHtml } from '../lib/utils.js';

const DOM = {
    status: document.getElementById('loginStatus'),
    discord: document.getElementById('btnDiscordLogin'),
    google: document.getElementById('btnGoogleLogin')
};

function setStatus(message, type = '') {
    DOM.status.className = `login-status ${type}`.trim();
    DOM.status.textContent = message || '';
}

function setBusy(busy) {
    DOM.discord.disabled = busy;
    DOM.google.disabled = busy;
}

function postLogin(session) {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo');
    const targetUrl = returnTo || AuthService.getPostLoginUrl(session);

    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        window.location.href = chrome.runtime.getURL('src/sidepanel/sidepanel.html');
        return;
    }

    window.location.href = targetUrl;
}

async function loginWith(kind) {
    setBusy(true);
    setStatus(`${kind === 'discord' ? 'Discord' : 'Google'} doğrulanıyor...`);
    try {
        const session = kind === 'discord'
            ? await AuthService.loginWithDiscord()
            : await AuthService.loginWithGoogle();
        setStatus(`Giriş başarılı: ${escapeHtml(session.profile?.displayName || session.uid)}`, 'success');
        postLogin(session);
    } catch (error) {
        setStatus(error.message || 'Giriş başarısız', 'error');
    } finally {
        setBusy(false);
    }
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    if (reason === 'forbidden') setStatus('Bu sayfa için yetkiniz yok.', 'error');
    if (reason === 'blocked') setStatus('Hesabınız engellenmiş durumda.', 'error');
    if (params.has('firebaseToken') || params.has('sessionToken')) {
        setBusy(true);
        setStatus('Discord oturumu tamamlanıyor...');
        const session = await AuthService.completeDiscordRedirect();
        if (session) {
            setStatus(`Giriş başarılı: ${escapeHtml(session.profile?.displayName || session.uid)}`, 'success');
            postLogin(session);
            return;
        }
        setBusy(false);
    }

    const session = await AuthService.getSession();
    if (session && !reason) {
        postLogin(session);
        return;
    }

    DOM.discord.addEventListener('click', () => loginWith('discord'));
    DOM.google.addEventListener('click', () => loginWith('google'));
}

init().catch((error) => setStatus(error.message || 'Giriş ekranı yüklenemedi', 'error'));
