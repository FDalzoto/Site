
import { neon } from "@neondatabase/serverless";
import { administradorAutenticado } from "../lib/auth.js";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "DELETE") {
        res.setHeader("Allow", "DELETE");
        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {
        if (!administradorAutenticado(req)) {
            return res.status(401).json({
                erro: "Você precisa estar autenticado."
            });
        }

        const dados =
            typeof req.body === "string"
                ? JSON.parse(req.body)
                : req.body;

        const id = Number(dados?.id);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                erro: "ID do produto inválido."
            });
        }

        const conexao = neon(
            process.env.PETSHOP_DATABASE_URL
        );

        const resultado = await conexao`
            UPDATE produtos
            SET ativo = FALSE
            WHERE id = ${id}
              AND ativo = TRUE
            RETURNING id, nome
        `;

        if (resultado.length === 0) {
            return res.status(404).json({
                erro: "Produto não encontrado ou já inativo."
            });
        }

        return res.status(200).json({
            mensagem: "Produto excluído do catálogo com sucesso.",
            produto: resultado[0]
        });
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return res.status(400).json({
                erro: "Os dados enviados são inválidos."
            });
        }

        console.error("Erro ao excluir produto:", erro);

        return res.status(500).json({
            erro: "Não foi possível excluir o produto."
        });
    }
}
