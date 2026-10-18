
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
                p.id,
                p.nome,
                p.descricao,
                p.preco,
                p.estoque,
                p.imagem,
                p.categoria_id,
                c.nome AS categoria
            FROM produtos p
            LEFT JOIN categorias c
                ON c.id = p.categoria_id
            WHERE p.ativo = TRUE
            ORDER BY p.id DESC
        `;

        return res.status(200).json(produtos);
    } catch (erro) {
        console.error("Erro ao consultar produtos:", erro);

        return res.status(500).json({
            erro: "Não foi possível carregar os produtos."
        });
    }
}
