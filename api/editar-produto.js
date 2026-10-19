
import { neon } from "@neondatabase/serverless";
import { administradorAutenticado } from "../lib/auth.js";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "PUT") {
        res.setHeader("Allow", "PUT");
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

        if (
            typeof dados?.nome !== "string" ||
            typeof dados?.descricao !== "string" &&
                dados?.descricao !== undefined &&
                dados?.descricao !== null
        ) {
            return res.status(400).json({
                erro: "Confira os dados informados."
            });
        }

        const nome = dados.nome.trim();
        const descricao = dados.descricao?.trim() || "";
        const imagem =
            typeof dados.imagem === "string" &&
            dados.imagem.trim() !== ""
                ? dados.imagem.trim()
                : null;

        const preco = Number(dados.preco);
        const estoque = Number(dados.estoque);
        const categoriaId = Number(dados.categoria_id);

        if (
            nome.length < 2 ||
            nome.length > 150 ||
            descricao.length > 2000 ||
            (imagem !== null && imagem.length > 2000) ||
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
            UPDATE produtos
            SET
                nome = ${nome},
                descricao = ${descricao},
                preco = ${preco},
                estoque = ${estoque},
                imagem = ${imagem},
                categoria_id = ${categoriaId}
            WHERE id = ${id}
              AND ativo = TRUE
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

        if (resultado.length === 0) {
            return res.status(404).json({
                erro: "Produto não encontrado ou já inativo."
            });
        }

        return res.status(200).json({
            mensagem: "Produto atualizado com sucesso.",
            produto: resultado[0]
        });
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return res.status(400).json({
                erro: "Os dados enviados são inválidos."
            });
        }

        console.error("Erro ao editar produto:", erro);

        return res.status(500).json({
            erro: "Não foi possível atualizar o produto."
        });
    }
}
