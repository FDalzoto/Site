import sql from "../../lib/db.js";
import { obterAdministradorId } from "../../lib/auth.js";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");

    if (req.method !== "DELETE") {
        res.setHeader("Allow", "DELETE");
        return res.status(405).json({ erro: "Método não permitido." });
    }

    try {
        const idAtual = obterAdministradorId(req);

        if (!idAtual) {
            return res.status(401).json({ erro: "Sessão inválida." });
        }

        const atual = await sql`
            SELECT nivel, ativo
            FROM administradores
            WHERE id = ${idAtual}
            LIMIT 1
        `;

        if (!atual.length || !atual[0].ativo) {
            return res.status(401).json({ erro: "Conta inativa ou inexistente." });
        }

        if (atual[0].nivel !== "superadmin") {
            return res.status(403).json({ erro: "Sem permissão para desativar administradores." });
        }

        let dados;

        try {
            dados = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        } catch {
            return res.status(400).json({ erro: "Dados inválidos." });
        }

        const id = Number(dados?.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({ erro: "ID de administrador inválido." });
        }

        if (id === idAtual) {
            return res.status(400).json({ erro: "Você não pode desativar sua própria conta." });
        }

        const alvo = await sql`
            SELECT id, nome, nivel, ativo
            FROM administradores
            WHERE id = ${id}
            LIMIT 1
        `;

        if (!alvo.length || !alvo[0].ativo) {
            return res.status(404).json({ erro: "Administrador não encontrado ou já desativado." });
        }

        if (alvo[0].nivel === "superadmin") {
            const resultado = await sql`
                UPDATE administradores
                SET ativo = FALSE
                WHERE id = ${id}
                  AND ativo = TRUE
                  AND (
                      SELECT COUNT(*)
                      FROM administradores
                      WHERE nivel = 'superadmin'
                        AND ativo = TRUE
                  ) > 1
                RETURNING id, nome, email, nivel, ativo
            `;

            if (!resultado.length) {
                return res.status(409).json({
                    erro: "Não é possível desativar o último superadministrador ativo."
                });
            }

            return res.status(200).json({
                mensagem: "Superadministrador desativado com sucesso.",
                administrador: resultado[0]
            });
        }

        const resultado = await sql`
            UPDATE administradores
            SET ativo = FALSE
            WHERE id = ${id}
              AND ativo = TRUE
            RETURNING id, nome, email, nivel, ativo
        `;

        if (!resultado.length) {
            return res.status(404).json({ erro: "Administrador não encontrado ou já desativado." });
        }

        return res.status(200).json({
            mensagem: "Administrador desativado com sucesso.",
            administrador: resultado[0]
        });
    } catch (erro) {
        console.error("Erro ao desativar administrador:", erro);
        return res.status(500).json({ erro: "Não foi possível desativar o administrador." });
    }
}