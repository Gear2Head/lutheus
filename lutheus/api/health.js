module.exports = function handler(_req, res) {
    res.status(200).json({
        ok: true,
        service: 'lutheus-cezarapor',
        timestamp: new Date().toISOString()
    });
};
