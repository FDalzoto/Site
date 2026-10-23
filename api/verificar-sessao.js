
import { administradorAutenticado } from "../lib/auth.js";

export default function handler(req, res) {
    res.setHeader("Cache-Control", "no-store, private");

    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");

        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {
        const autenticado = administradorAutenticado(req);

        if (!autenticado) {
            return res.status(401).json({
                autenticado: false,
                erro: "Acesso não autorizado."
            });
        }

        return res.status(200).json({
            autenticado: true
        });
    } catch (erro) {
        console.error(
            "Erro ao verificar sessão:",
            erro
        );

        return res.status(500).json({
            autenticado: false,
            erro: "Não foi possível verificar a sessão."
        });
    }
}

