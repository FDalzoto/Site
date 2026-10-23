
import sql from "../lib/db.js";
import { obterAdministradorId } from "../lib/auth.js";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store, private");

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
                erro: "Acesso não autorizado."
            });
        }

        const administradores = await sql`
            SELECT id
            FROM administradores
            WHERE id = ${administradorId}
              AND ativo = TRUE
            LIMIT 1
        `;

        if (administradores.length === 0) {
            return res.status(401).json({
                erro: "Conta administrativa inativa ou inexistente."
            });
        }

        const categorias = await sql`
            SELECT id, nome
            FROM categorias
            ORDER BY nome ASC
        `;

        return res.status(200).json(categorias);
    } catch (erro) {
        console.error("Erro ao carregar categorias:", erro);

        return res.status(500).json({
            erro: "Não foi possível carregar as categorias."
        });
    }
}
