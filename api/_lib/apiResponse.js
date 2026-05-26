function json(res, status, payload) {
    res.status(status).json(payload);
}

function ok(res, data = {}) {
    json(res, 200, { ok: true, ...data });
}

function badRequest(res, message = 'BAD_REQUEST') {
    json(res, 400, { ok: false, error: 'BAD_REQUEST', message });
}

function forbidden(res, message = 'FORBIDDEN') {
    json(res, 403, { ok: false, error: 'FORBIDDEN', message });
}

function serverError(res, error) {
    json(res, 500, {
        ok: false,
        error: error?.message || 'INTERNAL_SERVER_ERROR'
    });
}

module.exports = { ok, badRequest, forbidden, serverError };
