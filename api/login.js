
import { timingSafeEqual } from "node:crypto";
import { criarSessao } from "../lib/auth.js";

const TAMANHO_MAXIMO_CREDENCIAL = 200;

function compararSeguro(valorRecebido, valorCorreto) {
    const recebido = Buffer.from(valorRecebido, "utf8");
    const correto = Buffer.from(valorCorreto, "utf8");

    if (recebido.length !== correto.length) {
        return false;
    }

    return timingSafeEqual(recebido, correto);
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");

        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {
        const usuarioCorreto = process.env.ADMIN_USER;
        const senhaCorreta = process.env.ADMIN_PASSWORD;

        if (
            typeof usuarioCorreto !== "string" ||
            typeof senhaCorreta !== "string" ||
            usuarioCorreto.trim() === "" ||
            senhaCorreta.length === 0
        ) {
            console.error(
                "Credenciais administrativas não configuradas."
            );

            return res.status(500).json({
                erro: "Configuração de autenticação indisponível."
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
                erro: "Informe usuário e senha válidos."
            });
        }

        const usuario = dados.usuario;
        const senha = dados.senha;

        if (
            typeof usuario !== "string" ||
            typeof senha !== "string" ||
            usuario.length === 0 ||
            usuario.length > TAMANHO_MAXIMO_CREDENCIAL ||
            senha.length === 0 ||
            senha.length > TAMANHO_MAXIMO_CREDENCIAL
        ) {
            return res.status(400).json({
                erro: "Informe usuário e senha válidos."
            });
        }

        const usuarioValido = compararSeguro(
            usuario.trim(),
            usuarioCorreto.trim()
        );

        const senhaValida = compararSeguro(
            senha,
            senhaCorreta
        );

        if (!usuarioValido || !senhaValida) {
            return res.status(401).json({
                erro: "Usuário ou senha incorretos."
            });
        }

        const token = criarSessao();

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
