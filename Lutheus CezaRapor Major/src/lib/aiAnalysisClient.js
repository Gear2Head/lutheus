import { APP_CONFIG } from '../config/appConfig.js';
import { AuthService } from '../auth/authService.js';
import { FirebaseRepository } from './firebaseRepository.js';

export async function analyzeCaseWithGroq(caseData, cukResult) {
    const session = await AuthService.getSession();
    if (!session?.idToken) {
        return { success: false, error: 'AUTH_REQUIRED' };
    }

    const response = await fetch(new URL('/api/ai/analyze', APP_CONFIG.vercelAuthBaseUrl).toString(), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${session.idToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            case: caseData,
            cuk: cukResult,
            role: session.role
        })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
        return { success: false, error: payload.error || `AI_HTTP_${response.status}` };
    }

    await FirebaseRepository.saveAnalysis(caseData.caseKey || caseData.id || caseData.caseId, {
        deterministic: cukResult,
        ai: payload.analysis,
        provider: 'groq',
        role: session.role
    }).catch(() => null);

    return { success: true, analysis: payload.analysis };
}
