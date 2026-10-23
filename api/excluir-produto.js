import sql from "../lib/db.js";
import { obterAdministradorId } from "../lib/auth.js";

export default async function handler(req, res) {
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private"
    );

    if (req.method !== "DELETE") {
        res.setHeader("Allow", "DELETE");

        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {
        // Verifica a sessão administrativa.
        const administradorId = obterAdministradorId(req);

        if (!administradorId) {
            return res.status(401).json({
                erro: "Você precisa estar autenticado."
            });
        }

        // Confirma que a conta administrativa continua ativa.
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

        // Lê os dados enviados pelo painel.
        let dados;

        try {
            dados = typeof req.body === "string"
                ? JSON.parse(req.body)
                : req.body;
        } catch {
            return res.status(400).json({
                erro: "Os dados enviados são inválidos."
            });
        }

        if (
            !dados ||
            typeof dados !== "object" ||
            Array.isArray(dados)
        ) {
            return res.status(400).json({
                erro: "Informe o ID do produto."
            });
        }

        const id = Number(dados.id);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                erro: "ID do produto inválido."
            });
        }

        // Desativa o produto sem removê-lo do banco de dados.
        const resultado = await sql`
            UPDATE produtos
            SET ativo = FALSE
            WHERE id = ${id}
              AND ativo = TRUE
            RETURNING id, nome, ativo
        `;

        if (resultado.length === 0) {
            return res.status(404).json({
                erro: "Produto não encontrado ou já desativado."
            });
        }

        return res.status(200).json({
            mensagem: "Produto desativado do catálogo com sucesso.",
            produto: resultado[0]
        });
    } catch (erro) {
        console.error(
            "Erro ao desativar produto:",
            erro
        );

        return res.status(500).json({
            erro: "Não foi possível desativar o produto."
        });
    }
}
