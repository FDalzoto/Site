
import { neon } from "@neondatabase/serverless";
import { administradorAutenticado } from "../lib/auth.js";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
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

        const nome = dados?.nome?.trim();
        const descricao = dados?.descricao?.trim() || "";
        const imagem = dados?.imagem?.trim() || null;
        const preco = Number(dados?.preco);
        const estoque = Number(dados?.estoque);
        const categoriaId = Number(dados?.categoria_id);

        if (
            typeof nome !== "string" ||
            nome.length < 2 ||
            nome.length > 150 ||
            descricao.length > 2000 ||
            (imagem !== null &&
                (typeof imagem !== "string" ||
                    imagem.length > 2000)) ||
            !Number.isFinite(preco) ||
            preco <= 0 ||
            !Number.isSafeInteger(estoque) ||
            estoque < 0 ||
            !Number.isSafeInteger(categoriaId) ||
            categoriaId < 1
        ) {
            return res.status(400).json({
                erro: "Confira os dados informados."
            });
        }

        const conexao = neon(
            process.env.PETSHOP_DATABASE_URL
        );

        const categoria = await conexao`
            SELECT id
            FROM categorias
            WHERE id = ${categoriaId}
            LIMIT 1
        `;

        if (categoria.length === 0) {
            return res.status(400).json({
                erro: "A categoria informada não existe."
            });
        }

        const resultado = await conexao`
            INSERT INTO produtos (
                nome,
                descricao,
                preco,
                estoque,
                imagem,
                categoria_id,
                ativo
            )
            VALUES (
                ${nome},
                ${descricao},
                ${preco},
                ${estoque},
                ${imagem},
                ${categoriaId},
                TRUE
            )
            RETURNING
                id,
                nome,
                descricao,
                preco,
                estoque,
                imagem,
                categoria_id,
                ativo
        `;

        return res.status(201).json({
            mensagem: "Produto cadastrado com sucesso.",
            produto: resultado[0]
        });
    } catch (erro) {
        console.error("Erro ao cadastrar produto:", erro);

        return res.status(500).json({
            erro: "Não foi possível cadastrar o produto."
        });
    }
}
