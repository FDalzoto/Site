
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

        // Confirma que o administrador continua ativo.
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

        // Valida os dados recebidos.
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

        // Exclui definitivamente o produto, esteja ele ativo ou não.
        // O banco impedirá a exclusão se houver referências protegidas
        // por chaves estrangeiras, preservando o histórico relacionado.
        let resultado;

        try {
            resultado = await sql`
                DELETE FROM produtos
                WHERE id = ${id}
                RETURNING id, nome
            `;
        } catch (erroBanco) {
            if (erroBanco.code === "23503") {
                return res.status(409).json({
                    erro:
                        "Este produto está vinculado a outros registros, " +
                        "como pedidos ou movimentações de estoque. " +
                        "Ele não pode ser excluído definitivamente."
                });
            }

            throw erroBanco;
        }

        if (resultado.length === 0) {
            return res.status(404).json({
                erro: "Produto não encontrado."
            });
        }

        return res.status(200).json({
            mensagem: "Produto excluído com sucesso.",
            produto: resultado[0]
        });
    } catch (erro) {
        console.error("Erro ao excluir produto:", erro);

        return res.status(500).json({
            erro: "Não foi possível excluir o produto."
        });
    }
}
