
import { neon } from "@neondatabase/serverless";
import { administradorAutenticado } from "../lib/auth.js";

function validarImagem(valor) {
    // Campo não enviado: manter a imagem atual.
    if (valor === undefined) {
        return {
            valida: true,
            manterAtual: true,
            valor: null
        };
    }

    // Campo vazio ou nulo: remover a imagem.
    if (valor === null || valor === "") {
        return {
            valida: true,
            manterAtual: false,
            valor: null
        };
    }

    if (typeof valor !== "string") {
        return { valida: false };
    }

    const imagem = valor.trim();

    if (imagem === "") {
        return {
            valida: true,
            manterAtual: false,
            valor: null
        };
    }

    if (imagem.length > 2000) {
        return { valida: false };
    }

    try {
        const url = new URL(imagem);

        if (
            url.protocol !== "https:" ||
            !url.hostname ||
            url.username ||
            url.password
        ) {
            return { valida: false };
        }

        return {
            valida: true,
            manterAtual: false,
            valor: url.href
        };
    } catch {
        return { valida: false };
    }
}

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
                erro: "Informe os dados do produto corretamente."
            });
        }

        const id = Number(dados.id);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                erro: "ID do produto inválido."
            });
        }

        if (
            typeof dados.nome !== "string" ||
            (
                dados.descricao !== undefined &&
                dados.descricao !== null &&
                typeof dados.descricao !== "string"
            )
        ) {
            return res.status(400).json({
                erro: "Confira o nome e a descrição do produto."
            });
        }

        const nome = dados.nome.trim();
        const descricao = dados.descricao?.trim() || "";

        const imagemValidada = validarImagem(dados.imagem);

        if (!imagemValidada.valida) {
            return res.status(400).json({
                erro: "Informe um endereço HTTPS válido para a imagem."
            });
        }

        const preco = Number(dados.preco);
        const estoque = Number(dados.estoque);
        const categoriaId = Number(dados.categoria_id);

        if (
            nome.length < 2 ||
            nome.length > 150 ||
            descricao.length > 2000 ||
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

        let resultado;

        if (imagemValidada.manterAtual) {
            resultado = await conexao`
                UPDATE produtos
                SET
                    nome = ${nome},
                    descricao = ${descricao},
                    preco = ${preco},
                    estoque = ${estoque},
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
        } else {
            resultado = await conexao`
                UPDATE produtos
                SET
                    nome = ${nome},
                    descricao = ${descricao},
                    preco = ${preco},
                    estoque = ${estoque},
                    imagem = ${imagemValidada.valor},
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
        }

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
        console.error("Erro ao atualizar produto:", erro);

        return res.status(500).json({
            erro: "Não foi possível atualizar o produto."
        });
    }
}
