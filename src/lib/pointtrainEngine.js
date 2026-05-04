const DEFAULT_WEIGHTS = {
    punishmentWeight: 1,
    messageWeight: 0.15,
    channelDiversityBonus: 3,
    activeDayBonus: 1.5,
    penaltyFlags: 0
};

export function coercePointWeights(weights = {}) {
    return {
        ...DEFAULT_WEIGHTS,
        ...weights
    };
}

export function computePointtrainScore(metric, weights = {}) {
    const resolved = coercePointWeights(weights);
    const punishmentPoints = (metric.sapphirePunishments || 0) * resolved.punishmentWeight;
    const messagePoints = (metric.discordMessageCount || 0) * resolved.messageWeight;
    const channelBonus = (metric.channelCount || 0) * resolved.channelDiversityBonus;
    const activeDayBonus = (metric.activeDays || 0) * resolved.activeDayBonus;
    const penalties = metric.penaltyFlags || resolved.penaltyFlags || 0;

    const weightedScore = Number((punishmentPoints + messagePoints + channelBonus + activeDayBonus - penalties).toFixed(2));

    return {
        weightedScore,
        breakdown: {
            punishmentPoints,
            messagePoints,
            channelBonus,
            activeDayBonus,
            penalties
        }
    };
}

export function rankPointtrainMetrics(metrics = [], weights = {}) {
    return metrics
        .map((metric) => {
            const score = computePointtrainScore(metric, weights);
            return {
                ...metric,
                weightedScore: score.weightedScore,
                breakdown: score.breakdown
            };
        })
        .sort((left, right) => right.weightedScore - left.weightedScore);
}

export function buildPointtrainMarkdown(run) {
    const lines = [
        '```md',
        '# LUTHEUS POINTTRAIN',
        `> Calistirma: ${run.createdAt || '-'}`,
        `> Basarisiz Sorgu: ${run.partialFailures || 0}`,
        '',
        '[ SIRALAMA ]'
    ];

    run.metrics.forEach((metric, index) => {
        lines.push(
            `${String(index + 1).padStart(2, '0')}. ${metric.displayName.padEnd(20)} | ` +
            `Puan ${metric.weightedScore.toFixed(2).padStart(7, ' ')} | ` +
            `Ceza ${String(metric.sapphirePunishments).padStart(3, ' ')} | ` +
            `Mesaj ${String(metric.discordMessageCount).padStart(4, ' ')}`
        );
    });

    lines.push('```');
    return lines.join('\n');
}

export function buildPointtrainCsv(run) {
    const header = 'rank,displayName,role,punishments,messages,channelCount,activeDays,weightedScore';
    const rows = run.metrics.map((metric, index) => (
        [
            index + 1,
            `"${String(metric.displayName || '').replace(/"/g, '""')}"`,
            metric.role || '',
            metric.sapphirePunishments || 0,
            metric.discordMessageCount || 0,
            metric.channelCount || 0,
            metric.activeDays || 0,
            metric.weightedScore || 0
        ].join(',')
    ));
    return [header, ...rows].join('\n');
}
