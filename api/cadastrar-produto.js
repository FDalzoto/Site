
import { neon } from "@neondatabase/serverless";
import { administradorAutenticado } from "../lib/auth.js";

function validarImagem(valor) {
    if (valor === undefined || valor === null || valor === "") {
        return { valida: true, valor: null };
    }

    if (typeof valor !== "string") {
        return { valida: false };
    }

    const imagem = valor.trim();

    if (imagem.length === 0) {
        return { valida: true, valor: null };
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

        return { valida: true, valor: url.href };
    } catch {
        return { valida: false };
    }
}

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

        const imagem = imagemValidada.valor;
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
