
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import sql from "../lib/db.js";

function segredoValido(recebido, esperado) {
    if (
        typeof recebido !== "string" ||
        typeof esperado !== "string" ||
        esperado.length < 32
    ) {
        return false;
    }

    const a = Buffer.from(recebido, "utf8");
    const b = Buffer.from(esperado, "utf8");

    return a.length === b.length &&
        timingSafeEqual(a, b);
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
        const esperado = process.env.ADMIN_SETUP_SECRET;
        const recebido = req.headers["x-admin-setup-secret"];

        if (!segredoValido(recebido, esperado)) {
            return res.status(403).json({
                erro: "Autorização inválida."
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
                erro: "Informe nome, e-mail e senha."
            });
        }

        const { nome, email, senha } = dados;

        if (
            typeof nome !== "string" ||
            typeof email !== "string" ||
            typeof senha !== "string"
        ) {
            return res.status(400).json({
                erro: "Informe nome, e-mail e senha válidos."
            });
        }

        const nomeLimpo = nome.trim();
        const emailLimpo = email.trim().toLowerCase();

        if (nomeLimpo.length < 2 || nomeLimpo.length > 100) {
            return res.status(400).json({
                erro: "O nome deve ter entre 2 e 100 caracteres."
            });
        }

        if (
            emailLimpo.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)
        ) {
            return res.status(400).json({
                erro: "Informe um e-mail válido."
            });
        }

        if (
            senha.length < 12 ||
            Buffer.byteLength(senha, "utf8") > 72
        ) {
            return res.status(400).json({
                erro: "A senha deve ter pelo menos 12 caracteres e no máximo 72 bytes."
            });
        }

        const senhaHash = await bcrypt.hash(senha, 12);

        const resultados = await sql.transaction([
            sql`
                SELECT pg_advisory_xact_lock(734291806)
            `,
            sql`
                SELECT id
                FROM public.administradores
                LIMIT 1
            `,
            sql`
                INSERT INTO public.administradores (
                    nome,
                    email,
                    senha_hash,
                    nivel,
                    ativo,
                    criado_em
                )
                SELECT
                    ${nomeLimpo},
                    ${emailLimpo},
                    ${senhaHash},
                    'superadmin',
                    TRUE,
                    CURRENT_TIMESTAMP
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM public.administradores
                )
                RETURNING id, nome, email, nivel
            `
        ]);

        const criado = resultados[2];

        if (!criado || criado.length === 0) {
            return res.status(409).json({
                erro: "Já existe um administrador cadastrado."
            });
        }

        return res.status(201).json({
            mensagem: "Administrador inicial criado com sucesso.",
            administrador: criado[0]
        });
    } catch (erro) {
        console.error(
            "Erro ao criar administrador inicial:",
            erro
        );

        return res.status(500).json({
            erro: "Não foi possível criar o administrador."
        });
    }
}
