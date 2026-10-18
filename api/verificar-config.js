
export default function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json({
        ADMIN_USER_configurado: Boolean(process.env.ADMIN_USER),
        ADMIN_PASSWORD_configurado: Boolean(process.env.ADMIN_PASSWORD),
    });
}