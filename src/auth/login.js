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
    const returnTo = sanitizeReturnTo(params.get('returnTo'));
    const targetUrl = returnTo || AuthService.getPostLoginUrl(session);

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        window.location.href = chrome.runtime.getURL('src/sidepanel/sidepanel.html');
    } else {
        window.location.href = targetUrl || '/';
    }
}

function sanitizeReturnTo(value) {
    if (!value) return '';
    try {
        const parsed = new URL(value, window.location.origin);
        return parsed.origin === window.location.origin ? parsed.pathname + parsed.search + parsed.hash : '';
    } catch (_error) {
        return '';
    }
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
        const errorMsgStr = error.message || 'Giriş başarısız';
        console.error('[Lutheus Auth] Login error details:', errorMsgStr);

        let errorMsg = 'Giriş başarısız';
        if (errorMsgStr === 'USER_UPSERT_FORBIDDEN') {
            errorMsg = 'Giriş yapıldı, ancak profil veritabanına kaydedilemedi (USER_UPSERT_FORBIDDEN). Allowlist kaydı veya Firestore kurallarınızı kontrol edin.';
        } else if (errorMsgStr === 'GOOGLE_EMAIL_NOT_ALLOWLISTED') {
            errorMsg = 'Bu Google e-postası sistemde izin verilenler listesinde (Allowlist) bulunamadı.';
        } else if (errorMsgStr.includes('GOOGLE_CLIENT_ID_MISSING')) {
            errorMsg = 'Google Client ID Vercel Production ortamında eksik. GOOGLE_CLIENT_ID env değişkenini ekleyip redeploy yapın.';
        } else if (errorMsgStr.includes('GOOGLE_CLIENT_SECRET_MISSING')) {
            errorMsg = 'Google Client Secret Vercel Production ortamında eksik. GOOGLE_CLIENT_SECRET env değişkenini ekleyip redeploy yapın.';
        } else if (errorMsgStr.includes('GOOGLE_REDIRECT_URI_MISMATCH')) {
            errorMsg = 'Google redirect URI uyuşmuyor. Google Cloud Console içine https://lutheus.vercel.app/api/auth/google/callback eklenmeli.';
        } else if (errorMsgStr.includes('FIREBASE_SERVICE_ACCOUNT_MISSING')) {
            errorMsg = 'Firebase Admin service account Vercel env içinde eksik.';
        } else if (errorMsgStr.includes('DISCORD_PROFILE_DECODE_FAILED')) {
            errorMsg = 'Discord profil bilgileri çözümlenemedi (DISCORD_PROFILE_DECODE_FAILED).';
        } else if (errorMsgStr.includes('DISCORD_CLIENT_SECRET_MISSING')) {
            errorMsg = 'Discord istemci yapılandırması eksik (DISCORD_CLIENT_SECRET_MISSING).';
        } else if (errorMsgStr.includes('DISCORD_REDIRECT_URI_MISMATCH')) {
            errorMsg = 'Discord redirect URI uyuşmazlığı (DISCORD_REDIRECT_URI_MISMATCH).';
        } else if (errorMsgStr.includes('INVALID_OAUTH_STATE')) {
            errorMsg = 'Güvenlik doğrulaması başarısız (INVALID_OAUTH_STATE). Lütfen tekrar deneyin.';
        } else if (errorMsgStr.includes('OAUTH_STATE_EXPIRED')) {
            errorMsg = 'Oturum süresi doldu (OAUTH_STATE_EXPIRED). Lütfen tekrar deneyin.';
        } else if (errorMsgStr.includes('DISCORD_')) {
            errorMsg = 'Discord girişi tamamlanamadı. Lütfen daha sonra tekrar deneyin veya sistem yöneticinize danışın.';
        } else if (errorMsgStr.includes('FIREBASE_ADMIN_INIT_FAILED')) {
            errorMsg = 'Veritabanı bağlantı hatası (FIREBASE_ADMIN_INIT_FAILED).';
        } else if (errorMsgStr.includes('FIREBASE_USER_WRITE_FAILED')) {
            errorMsg = 'Kullanıcı profil kaydı başarısız (FIREBASE_USER_WRITE_FAILED).';
        } else if (errorMsgStr.includes('FIREBASE_CUSTOM_TOKEN_FAILED')) {
            errorMsg = 'Oturum anahtarı üretilemedi (FIREBASE_CUSTOM_TOKEN_FAILED).';
        } else if (errorMsgStr.includes('FIREBASE_')) {
            errorMsg = 'Sistem entegrasyon hatası (Firebase ve/veya Cloud Functions hatası).';
        } else {
            errorMsg = errorMsgStr;
        }

        setStatus(errorMsg, 'error');
    } finally {
        setBusy(false);
    }
}

async function init() {
    const params = new URLSearchParams(window.location.search || window.location.hash.replace('#', '?'));
    const reason = params.get('reason');
    if (reason === 'forbidden') setStatus('Bu sayfa için yetkiniz yok.', 'error');
    if (reason === 'blocked') setStatus('Hesabınız engellenmiş durumda.', 'error');

    const supabaseToken = params.get('supabaseToken');
    const profileEncoded = params.get('profile');
    const googleAccessToken = params.get('access_token'); // Google redirects with hash access_token

    if (supabaseToken && profileEncoded) {
        setStatus('Giriş tamamlanıyor...');
        setBusy(true);
        try {
            const profile = JSON.parse(decodeURIComponent(atob(profileEncoded)));
            const session = await AuthService.signInWithCustomToken(supabaseToken, profile);
            setStatus(`Giriş başarılı: ${escapeHtml(session.profile?.displayName || session.uid)}`, 'success');
            postLogin(session);
            return;
        } catch (error) {
            setStatus('Giriş tamamlanırken hata oluştu: ' + error.message, 'error');
            setBusy(false);
        }
    } else if (googleAccessToken) {
        setStatus('Google ile giriş tamamlanıyor...');
        setBusy(true);
        try {
            const session = await AuthService.signInWithGoogleAccessToken(googleAccessToken);
            setStatus(`Giriş başarılı: ${escapeHtml(session.profile?.displayName || session.uid)}`, 'success');
            postLogin(session);
            return;
        } catch (error) {
            setStatus('Giriş tamamlanırken hata oluştu: ' + error.message, 'error');
            setBusy(false);
        }
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
