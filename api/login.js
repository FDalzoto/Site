
import { timingSafeEqual } from "node:crypto";
import { criarSessao } from "../lib/auth.js";

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
        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {
        const usuarioCorreto = process.env.ADMIN_USER;
        const senhaCorreta = process.env.ADMIN_PASSWORD;

        if (!usuarioCorreto || !senhaCorreta) {
            return res.status(500).json({
                erro: "Configuração de autenticação indisponível."
            });
        }

        const dados = typeof req.body === "string"
            ? JSON.parse(req.body)
            : req.body;

        const usuario = dados?.usuario;
        const senha = dados?.senha;

        if (
            typeof usuario !== "string" ||
            typeof senha !== "string" ||
            usuario.length > 200 ||
            senha.length > 200
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
        console.error("Erro no login administrativo:", erro);

        return res.status(500).json({
            erro: "Não foi possível realizar o login."
        });
    }
}
