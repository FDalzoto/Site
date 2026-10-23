
import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
    // Evita que o navegador ou intermediários
    // mantenham uma lista desatualizada.
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
        const databaseUrl = process.env.PETSHOP_DATABASE_URL;

        if (!databaseUrl) {
            console.error(
                "PETSHOP_DATABASE_URL não configurada."
            );

            return res.status(500).json({
                erro: "Banco de dados indisponível."
            });
        }

        const conexao = neon(databaseUrl);

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
        console.error(
            "Erro ao consultar produtos:",
            erro
        );

        return res.status(500).json({
            erro: "Não foi possível carregar os produtos."
        });
    }
}
