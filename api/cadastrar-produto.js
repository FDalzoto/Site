import sql from "../lib/db.js";
import { obterAdministradorId } from "../lib/auth.js";

function validarImagem(valor) {
    if (valor === undefined || valor === null || valor === "") {
        return { valida: true, valor: null };
    }

    if (typeof valor !== "string") {
        return { valida: false };
    }

    const imagem = valor.trim();

    if (imagem === "") {
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

        return {
            valida: true,
            valor: url.href
        };
    } catch {
        return { valida: false };
    }
}

export default async function handler(req, res) {
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private"
    );

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");

        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {
        // Verifica se existe uma sessão válida.
        const administradorId = obterAdministradorId(req);

        if (!administradorId) {
            return res.status(401).json({
                erro: "Você precisa estar autenticado."
            });
        }

        // Confirma se a conta administrativa continua ativa.
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

        // Interpreta o corpo recebido.
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

        const descricao =
            typeof dados.descricao === "string"
                ? dados.descricao.trim()
                : "";

        const imagemValidada = validarImagem(dados.imagem);

        if (!imagemValidada.valida) {
            return res.status(400).json({
                erro: "Informe um endereço HTTPS válido para a imagem."
            });
        }

        // Impede que campos numéricos vazios sejam aceitos.
        if (
            dados.preco === undefined ||
            dados.preco === null ||
            String(dados.preco).trim() === "" ||
            dados.estoque === undefined ||
            dados.estoque === null ||
            String(dados.estoque).trim() === "" ||
            dados.categoria_id === undefined ||
            dados.categoria_id === null ||
            String(dados.categoria_id).trim() === ""
        ) {
            return res.status(400).json({
                erro: "Preencha o preço, o estoque e a categoria."
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

        // Confirma se a categoria existe.
        const categorias = await sql`
            SELECT id
            FROM categorias
            WHERE id = ${categoriaId}
            LIMIT 1
        `;

        if (categorias.length === 0) {
            return res.status(400).json({
                erro: "A categoria informada não existe."
            });
        }

        // Cadastra o produto no banco.
        const resultado = await sql`
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
                ${imagemValidada.valor},
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
        console.error(
            "Erro ao cadastrar produto:",
            erro
        );

        return res.status(500).json({
            erro: "Não foi possível cadastrar o produto."
        });
    }
}
