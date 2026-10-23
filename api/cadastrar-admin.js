import bcrypt from "bcryptjs";
import sql from "../lib/db.js";
import { obterAdministradorId } from "../lib/auth.js";

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
        // Verifica a sessão atual.
        const administradorId = obterAdministradorId(req);

        if (!administradorId) {
            return res.status(401).json({
                erro: "Você precisa estar autenticado."
            });
        }

        // Confirma que a conta está ativa e é superadmin.
        const administradores = await sql`
            SELECT id, nivel
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

        if (administradores[0].nivel !== "superadmin") {
            return res.status(403).json({
                erro: "Somente o superadministrador pode cadastrar administradores."
            });
        }

        // Interpreta os dados enviados.
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
                erro: "Informe nome, e-mail, senha e nível de acesso."
            });
        }

        const { nome, email, senha, nivel } = dados;

        if (
            typeof nome !== "string" ||
            typeof email !== "string" ||
            typeof senha !== "string" ||
            typeof nivel !== "string"
        ) {
            return res.status(400).json({
                erro: "Informe todos os campos corretamente."
            });
        }

        const nomeLimpo = nome.trim();
        const emailLimpo = email.trim().toLowerCase();

        if (
            nomeLimpo.length < 2 ||
            nomeLimpo.length > 100
        ) {
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

        // Não permite criar outro superadmin por este endpoint.
        if (nivel !== "admin") {
            return res.status(400).json({
                erro: "O nível permitido para novas contas é admin."
            });
        }

        // Confirma que o e-mail ainda não está cadastrado.
        const existente = await sql`
            SELECT id
            FROM administradores
            WHERE LOWER(email) = ${emailLimpo}
            LIMIT 1
        `;

        if (existente.length > 0) {
            return res.status(409).json({
                erro: "Já existe uma conta com esse e-mail."
            });
        }

        const senhaHash = await bcrypt.hash(senha, 12);

        const criado = await sql`
            INSERT INTO administradores (
                nome,
                email,
                senha_hash,
                nivel,
                ativo,
                criado_em
            )
            VALUES (
                ${nomeLimpo},
                ${emailLimpo},
                ${senhaHash},
                'admin',
                TRUE,
                CURRENT_TIMESTAMP
            )
            RETURNING id, nome, email, nivel, ativo, criado_em
        `;

        return res.status(201).json({
            mensagem: "Administrador cadastrado com sucesso.",
            administrador: criado[0]
        });
    } catch (erro) {
        // Evita registrar dados pessoais ou senhas nos logs.
        console.error("Erro ao cadastrar administrador.");

        return res.status(500).json({
            erro: "Não foi possível cadastrar o administrador."
        });
    }
}
