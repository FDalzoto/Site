
import { neon } from "@neondatabase/serverless";
import { administradorAutenticado } from "../lib/auth.js";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {
        if (!administradorAutenticado(req)) {
            return res.status(401).json({
                erro: "Acesso não autorizado."
            });
        }

        const conexao = neon(process.env.PETSHOP_DATABASE_URL);

        const categorias = await conexao`
            SELECT id, nome
            FROM categorias
            ORDER BY nome ASC
        `;

        return res.status(200).json(categorias);
    } catch (erro) {
        console.error("Erro ao carregar categorias:", erro);

        return res.status(500).json({
            erro: "Não foi possível carregar as categorias."
        });
    }
}
