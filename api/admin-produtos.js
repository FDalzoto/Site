
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

        const produtos = await sql`
            SELECT
                p.id,
                p.nome,
                p.descricao,
                p.preco,
                p.estoque,
                p.imagem,
                p.categoria_id,
                p.ativo,
                c.nome AS categoria
            FROM produtos p
            LEFT JOIN categorias c
                ON c.id = p.categoria_id
            ORDER BY p.id DESC
        `;

        return res.status(200).json(produtos);
    } catch (erro) {
        console.error(
            "Erro ao consultar produtos administrativos:",
            erro
        );

        return res.status(500).json({
            erro: "Não foi possível carregar os produtos."
        });
    }
}
