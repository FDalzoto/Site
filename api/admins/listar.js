import sql from "../../lib/db.js";
import { obterAdministradorId } from "../../lib/auth.js";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");

    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ erro: "Método não permitido." });
    }

    try {
        const idAtual = obterAdministradorId(req);

        if (!idAtual) {
            return res.status(401).json({ erro: "Sessão inválida." });
        }

        const atual = await sql`
            SELECT id, nivel, ativo
            FROM administradores
            WHERE id = ${idAtual}
            LIMIT 1
        `;

        if (!atual.length || !atual[0].ativo) {
            return res.status(401).json({ erro: "Conta inativa ou inexistente." });
        }

        if (atual[0].nivel !== "superadmin") {
            return res.status(403).json({ erro: "Somente o superadministrador pode gerenciar contas." });
        }

        const administradores = await sql`
            SELECT id, nome, email, nivel, ativo, criado_em
            FROM administradores
            ORDER BY id ASC
        `;

        return res.status(200).json(administradores);
    } catch (erro) {
        console.error("Erro ao listar administradores:", erro);
        return res.status(500).json({ erro: "Não foi possível carregar os administradores." });
    }
}