import bcrypt from "bcryptjs";
import sql from "../../lib/db.js";
import { obterAdministradorId } from "../../lib/auth.js";

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ erro: "Método não permitido." });
    }

    try {
        const idAtual = obterAdministradorId(req);

        if (!idAtual) {
            return res.status(401).json({ erro: "Sessão inválida." });
        }

        const atual = await sql`
            SELECT nivel, ativo
            FROM administradores
            WHERE id = ${idAtual}
            LIMIT 1
        `;

        if (!atual.length || !atual[0].ativo) {
            return res.status(401).json({ erro: "Conta inativa ou inexistente." });
        }

        if (atual[0].nivel !== "superadmin") {
            return res.status(403).json({ erro: "Sem permissão para cadastrar administradores." });
        }

        let dados;

        try {
            dados = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        } catch {
            return res.status(400).json({ erro: "Dados inválidos." });
        }

        if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
            return res.status(400).json({ erro: "Informe os dados do administrador." });
        }

        const nome = typeof dados.nome === "string" ? dados.nome.trim() : "";
        const email = typeof dados.email === "string" ? dados.email.trim().toLowerCase() : "";
        const senha = typeof dados.senha === "string" ? dados.senha : "";

        if (nome.length < 2 || nome.length > 100) {
            return res.status(400).json({ erro: "O nome deve ter entre 2 e 100 caracteres." });
        }

        if (
            email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return res.status(400).json({ erro: "Informe um e-mail válido." });
        }

        if (senha.length < 12 || senha.length > 72) {
            return res.status(400).json({
                erro: "A senha deve ter entre 12 e 72 caracteres."
            });
        }

        const nivelSolicitado = dados.nivel === "superadmin"
            ? "superadmin"
            : "administrador";

        const existente = await sql`
            SELECT id
            FROM administradores
            WHERE LOWER(email) = ${email}
            LIMIT 1
        `;

        if (existente.length) {
            return res.status(409).json({ erro: "Já existe uma conta com esse e-mail." });
        }

        const senhaHash = await bcrypt.hash(senha, 12);

        const criado = await sql`
            INSERT INTO administradores
                (nome, email, senha_hash, nivel, ativo, criado_em)
            VALUES
                (${nome}, ${email}, ${senhaHash}, ${nivelSolicitado}, TRUE, NOW())
            RETURNING id, nome, email, nivel, ativo, criado_em
        `;

        return res.status(201).json({
            mensagem: "Administrador cadastrado com sucesso.",
            administrador: criado[0]
        });
    } catch (erro) {
        if (erro?.code === "23505") {
            return res.status(409).json({ erro: "Já existe uma conta com esse e-mail." });
        }

        console.error("Erro ao cadastrar administrador:", erro);
        return res.status(500).json({ erro: "Não foi possível cadastrar o administrador." });
    }
}