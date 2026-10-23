import sql from "../lib/db.js";
import { obterAdministradorId } from "../lib/auth.js";

function validarImagem(valor) {
    // Se a propriedade não foi enviada, mantém a imagem atual.
    if (valor === undefined) {
        return {
            valida: true,
            manterAtual: true,
            valor: null
        };
    }

    // null ou string vazia remove a imagem atual.
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
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private"
    );

    if (req.method !== "PUT") {
        res.setHeader("Allow", "PUT");

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

        // Lê e valida o corpo da requisição.
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
        const descricao =
            typeof dados.descricao === "string"
                ? dados.descricao.trim()
                : "";

        const preco = Number(dados.preco);
        const estoque = Number(dados.estoque);
        const categoriaId = Number(dados.categoria_id);
        const imagemValidada = validarImagem(dados.imagem);

        if (!imagemValidada.valida) {
            return res.status(400).json({
                erro: "Informe um endereço HTTPS válido para a imagem."
            });
        }

        if (
            nome.length < 2 ||
            nome.length > 150 ||
            descricao.length > 2000 ||
            dados.preco === "" ||
            dados.estoque === "" ||
            dados.categoria_id === "" ||
            !Number.isFinite(preco) ||
            preco <= 0 ||
            !Number.isSafeInteger(estoque) ||
            estoque < 0 ||
            !Number.isSafeInteger(categoriaId) ||
            categoriaId < 1
        ) {
            return res.status(400).json({
                erro: "Confira o nome, a descrição, o preço, o estoque e a categoria."
            });
        }

        // Confirma que a categoria existe.
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

        // Atualiza os campos sem sobrescrever a imagem
        // quando ela não foi enviada.
        let resultado;

        if (imagemValidada.manterAtual) {
            resultado = await sql`
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
            resultado = await sql`
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
                erro: "Produto não encontrado ou já desativado."
            });
        }

        return res.status(200).json({
            mensagem: "Produto atualizado com sucesso.",
            produto: resultado[0]
        });
    } catch (erro) {
        console.error(
            "Erro ao atualizar produto:",
            erro
        );

        return res.status(500).json({
            erro: "Não foi possível atualizar o produto."
        });
    }
}
