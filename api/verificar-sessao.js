import sql from "../lib/db.js";
import { obterAdministradorId } from "../lib/auth.js";

export default async function handler(req, res) {
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private"
    );

    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");

        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {
        const administradorId = obterAdministradorId(req);

        if (!administradorId) {
            return res.status(401).json({
                autenticado: false,
                erro: "Acesso não autorizado."
            });
        }

        const administradores = await sql`
            SELECT id, nome, email, nivel
            FROM administradores
            WHERE id = ${administradorId}
              AND ativo = TRUE
            LIMIT 1
        `;

        if (administradores.length === 0) {
            return res.status(401).json({
                autenticado: false,
                erro: "Conta administrativa inativa ou inexistente."
            });
        }

        const administrador = administradores[0];

        return res.status(200).json({
            autenticado: true,
            administrador: {
                id: administrador.id,
                nome: administrador.nome,
                email: administrador.email,
                nivel: administrador.nivel
            }
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
