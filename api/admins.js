
import bcrypt from "bcryptjs";
import sql from "../lib/db.js";
import { obterAdministradorId } from "../lib/auth.js";

export default async function handler(req, res) {
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private"
    );

    const metodosPermitidos = ["GET", "POST", "DELETE"];

    if (!metodosPermitidos.includes(req.method)) {
        res.setHeader("Allow", metodosPermitidos.join(", "));
        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {
        // Verifica a sessão atual.
        const idAtual = obterAdministradorId(req);

        if (!idAtual) {
            return res.status(401).json({
                erro: "Sessão inválida."
            });
        }

        // Confirma que a conta existe e está ativa.
        const atual = await sql`
            SELECT id, nivel, ativo
            FROM administradores
            WHERE id = ${idAtual}
            LIMIT 1
        `;

        if (!atual.length || !atual[0].ativo) {
            return res.status(401).json({
                erro: "Conta inativa ou inexistente."
            });
        }

        // Somente superadministradores podem gerenciar contas.
        if (atual[0].nivel !== "superadmin") {
            return res.status(403).json({
                erro: "Somente o superadministrador pode gerenciar contas."
            });
        }

        // LER: lista todas as contas administrativas.
        if (req.method === "GET") {
            const administradores = await sql`
                SELECT id, nome, email, nivel, ativo, criado_em
                FROM administradores
                ORDER BY id ASC
            `;

            return res.status(200).json(administradores);
        }

        // Interpreta e valida o corpo das requisições POST e DELETE.
        let dados;

        try {
            dados = typeof req.body === "string"
                ? JSON.parse(req.body)
                : req.body;
        } catch {
            return res.status(400).json({
                erro: "Dados inválidos."
            });
        }

        if (
            !dados ||
            typeof dados !== "object" ||
            Array.isArray(dados)
        ) {
            return res.status(400).json({
                erro: "Informe os dados necessários."
            });
        }

        // CADASTRAR: cria uma nova conta administrativa.
        if (req.method === "POST") {
            const nome = typeof dados.nome === "string"
                ? dados.nome.trim()
                : "";

            const email = typeof dados.email === "string"
                ? dados.email.trim().toLowerCase()
                : "";

            const senha = typeof dados.senha === "string"
                ? dados.senha
                : "";

            if (nome.length < 2 || nome.length > 100) {
                return res.status(400).json({
                    erro: "O nome deve ter entre 2 e 100 caracteres."
                });
            }

            if (
                email.length > 254 ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ) {
                return res.status(400).json({
                    erro: "Informe um e-mail válido."
                });
            }

            if (
                senha.length < 12 ||
                senha.length > 72 ||
                Buffer.byteLength(senha, "utf8") > 72
            ) {
                return res.status(400).json({
                    erro: "A senha deve ter pelo menos 12 caracteres e no máximo 72 bytes."
                });
            }

            const nivel = dados.nivel === "superadmin"
                ? "superadmin"
                : "administrador";

            const existente = await sql`
                SELECT id
                FROM administradores
                WHERE LOWER(email) = ${email}
                LIMIT 1
            `;

            if (existente.length) {
                return res.status(409).json({
                    erro: "Já existe uma conta com esse e-mail."
                });
            }

            const senhaHash = await bcrypt.hash(senha, 12);

            const criado = await sql`
                INSERT INTO administradores
                    (nome, email, senha_hash, nivel, ativo, criado_em)
                VALUES
                    (
                        ${nome},
                        ${email},
                        ${senhaHash},
                        ${nivel},
                        TRUE,
                        NOW()
                    )
                RETURNING id, nome, email, nivel, ativo, criado_em
            `;

            return res.status(201).json({
                mensagem: "Administrador cadastrado com sucesso.",
                administrador: criado[0]
            });
        }

        // DESATIVAR: desativa uma conta sem apagar seus registros.
        if (req.method === "DELETE") {
            const id = Number(dados.id);

            if (!Number.isSafeInteger(id) || id <= 0) {
                return res.status(400).json({
                    erro: "ID de administrador inválido."
                });
            }

            if (id === Number(idAtual)) {
                return res.status(400).json({
                    erro: "Você não pode desativar sua própria conta."
                });
            }

            const alvo = await sql`
                SELECT id, nome, nivel, ativo
                FROM administradores
                WHERE id = ${id}
                LIMIT 1
            `;

            if (!alvo.length || !alvo[0].ativo) {
                return res.status(404).json({
                    erro: "Administrador não encontrado ou já desativado."
                });
            }

            if (alvo[0].nivel === "superadmin") {
                // Impede desativar o último superadministrador ativo.
                const resultado = await sql`
                    UPDATE administradores
                    SET ativo = FALSE
                    WHERE id = ${id}
                      AND ativo = TRUE
                      AND (
                          SELECT COUNT(*)
                          FROM administradores
                          WHERE nivel = 'superadmin'
                            AND ativo = TRUE
                      ) > 1
                    RETURNING id, nome, email, nivel, ativo
                `;

                if (!resultado.length) {
                    return res.status(409).json({
                        erro: "Não é possível desativar o último superadministrador ativo."
                    });
                }

                return res.status(200).json({
                    mensagem: "Superadministrador desativado com sucesso.",
                    administrador: resultado[0]
                });
            }

            const resultado = await sql`
                UPDATE administradores
                SET ativo = FALSE
                WHERE id = ${id}
                  AND ativo = TRUE
                RETURNING id, nome, email, nivel, ativo
            `;

            if (!resultado.length) {
                return res.status(404).json({
                    erro: "Administrador não encontrado ou já desativado."
                });
            }

            return res.status(200).json({
                mensagem: "Administrador desativado com sucesso.",
                administrador: resultado[0]
            });
        }
    } catch (erro) {
        if (erro?.code === "23505") {
            return res.status(409).json({
                erro: "Já existe uma conta com esse e-mail."
            });
        }

        console.error("Erro na API de administradores:", erro);

        return res.status(500).json({
            erro: "Não foi possível concluir a operação."
        });
    }
}
