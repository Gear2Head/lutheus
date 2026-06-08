const { parseDurationText } = require('./sapphireNormalize');

function snapDurationForValidation(mins) {
    if (mins === null || mins === undefined || !Number.isFinite(mins) || mins <= 0) return mins;
    // Remaining-time display often ends in 59dk (e.g. 5sa 59dk → snap to 6sa tier)
    if (mins % 60 === 59) return mins + 1;
    return mins;
}

function resolveDurationMinutesForCuk(data) {
    if (!data) return null;
    if (data.isPermanent === true) return 0;

    const durationText = data.duration || data.duration_raw || '';
    const fromRaw = durationText ? parseDurationText(durationText) : null;
    if (fromRaw === Infinity) return 0;
    if (typeof fromRaw === 'number' && fromRaw > 0) {
        return snapDurationForValidation(Math.round(fromRaw));
    }

    if (Number.isFinite(Number(data.durationMs)) && Number(data.durationMs) > 0) {
        const mins = Math.round(Number(data.durationMs) / 60000);
        if (mins >= 52_000_000) return 0; // ≥99 years → treat as permanent
        return snapDurationForValidation(mins);
    }

    return null;
}

module.exports = {
    snapDurationForValidation,
    resolveDurationMinutesForCuk,
};
