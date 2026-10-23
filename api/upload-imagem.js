
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import sql from "../lib/db.js";
import { obterAdministradorId } from "../lib/auth.js";

export const config = {
    api: {
        bodyParser: false
    }
};

const TAMANHO_MAXIMO = 4 * 1024 * 1024;

const tiposPermitidos = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
};

function verificarImagem(buffer, tipo) {
    if (tipo === "image/jpeg") {
        return (
            buffer.length >= 3 &&
            buffer[0] === 0xff &&
            buffer[1] === 0xd8 &&
            buffer[2] === 0xff
        );
    }

    if (tipo === "image/png") {
        return (
            buffer.length >= 8 &&
            buffer.subarray(0, 8).equals(
                Buffer.from([
                    0x89, 0x50, 0x4e, 0x47,
                    0x0d, 0x0a, 0x1a, 0x0a
                ])
            )
        );
    }

    if (tipo === "image/webp") {
        return (
            buffer.length >= 12 &&
            buffer.toString("ascii", 0, 4) === "RIFF" &&
            buffer.toString("ascii", 8, 12) === "WEBP"
        );
    }

    return false;
}

async function lerImagem(req) {
    const partes = [];
    let tamanhoTotal = 0;

    for await (const parte of req) {
        const buffer = Buffer.isBuffer(parte)
            ? parte
            : Buffer.from(parte);

        tamanhoTotal += buffer.length;

        if (tamanhoTotal > TAMANHO_MAXIMO) {
            const erro = new Error("IMAGEM_MUITO_GRANDE");
            erro.codigo = "IMAGEM_MUITO_GRANDE";
            throw erro;
        }

        partes.push(buffer);
    }

    if (tamanhoTotal === 0) {
        const erro = new Error("IMAGEM_VAZIA");
        erro.codigo = "IMAGEM_VAZIA";
        throw erro;
    }

    return Buffer.concat(partes, tamanhoTotal);
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store, private");

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");

        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {
        const administradorId = obterAdministradorId(req);

        if (!administradorId) {
            return res.status(401).json({
                erro: "Você precisa estar autenticado."
            });
        }

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

        const tipo = String(
            req.headers["content-type"] || ""
        )
            .split(";")[0]
            .trim()
            .toLowerCase();

        const extensao = tiposPermitidos[tipo];

        if (!extensao) {
            return res.status(400).json({
                erro: "Envie uma imagem JPG, PNG ou WebP."
            });
        }

        const tamanhoInformado = req.headers["content-length"];

        if (tamanhoInformado !== undefined) {
            if (
                !/^\d+$/.test(String(tamanhoInformado)) ||
                !Number.isSafeInteger(Number(tamanhoInformado))
            ) {
                return res.status(400).json({
                    erro: "Tamanho do arquivo inválido."
                });
            }

            if (Number(tamanhoInformado) > TAMANHO_MAXIMO) {
                return res.status(413).json({
                    erro: "A imagem deve ter no máximo 4 MB."
                });
            }
        }

        const storeId = process.env.PETSHOP_PUBLIC_BLOB_STORE_ID;

        if (!storeId) {
            console.error(
                "PETSHOP_PUBLIC_BLOB_STORE_ID ausente."
            );

            return res.status(500).json({
                erro: "O armazenamento de imagens não está configurado."
            });
        }

        const imagem = await lerImagem(req);

        if (!verificarImagem(imagem, tipo)) {
            return res.status(400).json({
                erro: "O arquivo não corresponde a uma imagem JPG, PNG ou WebP válida."
            });
        }

        const blob = await put(
            `produtos/${randomUUID()}.${extensao}`,
            imagem,
            {
                access: "public",
                storeId,
                contentType: tipo,
                addRandomSuffix: true
            }
        );

        return res.status(200).json({
            sucesso: true,
            url: blob.url
        });
    } catch (erro) {
        if (erro?.codigo === "IMAGEM_MUITO_GRANDE") {
            return res.status(413).json({
                erro: "A imagem deve ter no máximo 4 MB."
            });
        }

        if (erro?.codigo === "IMAGEM_VAZIA") {
            return res.status(400).json({
                erro: "O arquivo enviado está vazio."
            });
        }

        console.error("Falha no upload do Blob:", erro);

        return res.status(500).json({
            erro: "Falha no upload da imagem. Consulte os logs da Vercel."
        });
    }
}
