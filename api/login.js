import bcrypt from "bcryptjs";
import sql from "../lib/db.js";
import { criarSessao } from "../lib/auth.js";

const TAMANHO_MAXIMO_CREDENCIAL = 200;

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
                erro: "Informe e-mail e senha válidos."
            });
        }

        const usuario = dados.usuario;
        const senha = dados.senha;

        if (
            typeof usuario !== "string" ||
            typeof senha !== "string" ||
            usuario.trim().length === 0 ||
            usuario.length > TAMANHO_MAXIMO_CREDENCIAL ||
            senha.length === 0 ||
            senha.length > TAMANHO_MAXIMO_CREDENCIAL
        ) {
            return res.status(400).json({
                erro: "Informe e-mail e senha válidos."
            });
        }

        const email = usuario.trim().toLowerCase();

        const administradores = await sql`
            SELECT id, email, senha_hash, nivel
            FROM administradores
            WHERE LOWER(email) = ${email}
              AND ativo = TRUE
            LIMIT 1
        `;

        if (administradores.length === 0) {
            return res.status(401).json({
                erro: "E-mail ou senha incorretos."
            });
        }

        const administrador = administradores[0];

        if (
            typeof administrador.senha_hash !== "string" ||
            administrador.senha_hash.length === 0
        ) {
            return res.status(401).json({
                erro: "E-mail ou senha incorretos."
            });
        }

        let senhaValida = false;

        try {
            senhaValida = await bcrypt.compare(
                senha,
                administrador.senha_hash
            );
        } catch {
            senhaValida = false;
        }

        if (!senhaValida) {
            return res.status(401).json({
                erro: "E-mail ou senha incorretos."
            });
        }

        const token = criarSessao(administrador.id);

        res.setHeader(
            "Set-Cookie",
            `admin_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`
        );

        return res.status(200).json({
            mensagem: "Login realizado com sucesso."
        });
    } catch (erro) {
        console.error(
            "Erro no login administrativo:",
            erro
        );

        return res.status(500).json({
            erro: "Não foi possível realizar o login."
        });
    }
}
