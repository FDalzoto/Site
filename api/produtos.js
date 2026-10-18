
import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {
        const conexao = neon(process.env.PETSHOP_DATABASE_URL);

        const produtos = await conexao`
            SELECT
                id,
                nome,
                descricao,
                preco,
                estoque,
                imagem,
                categoria_id
            FROM produtos
            WHERE ativo = TRUE
            ORDER BY id DESC
        `;

        return res.status(200).json(produtos);
    } catch (erro) {
        console.error("Erro ao consultar produtos:", erro);

        return res.status(500).json({
            erro: "Não foi possível carregar os produtos."
        });
    }
}
