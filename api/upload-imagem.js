
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { administradorAutenticado } from "../lib/auth.js";

export const config = {
    api: {
        bodyParser: false
    }
};

const tiposPermitidos = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
};

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    if (!administradorAutenticado(req)) {
        return res.status(401).json({
            erro: "Você precisa estar autenticado."
        });
    }

    const tipo = String(req.headers["content-type"] || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

    const extensao = tiposPermitidos[tipo];

    if (!extensao) {
        return res.status(400).json({
            erro: "Envie uma imagem JPG, PNG ou WebP."
        });
    }

    const tamanho = Number(req.headers["content-length"]);

    if (
        !Number.isFinite(tamanho) ||
        tamanho <= 0 ||
        tamanho > 4 * 1024 * 1024
    ) {
        return res.status(413).json({
            erro: "A imagem deve ter no máximo 4 MB."
        });
    }

    try {
        const storeId =
            process.env.PETSHOP_PUBLIC_BLOB_STORE_ID;

        if (!storeId) {
            console.error(
                "Variável PETSHOP_PUBLIC_BLOB_STORE_ID ausente."
            );

            return res.status(500).json({
                erro: "O armazenamento de imagens não está configurado."
            });
        }

        const blob = await put(
            `produtos/${randomUUID()}.${extensao}`,
            req,
            {
                access: "public",
                storeId: storeId,
                contentType: tipo,
                addRandomSuffix: true
            }
        );

        return res.status(200).json({
            sucesso: true,
            url: blob.url
        });
    } catch (erro) {
        console.error("Falha no upload do Blob:", erro);

        return res.status(500).json({
            erro: "Falha no upload da imagem. Consulte os logs da Vercel."
        });
    }
}
