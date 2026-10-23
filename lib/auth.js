
import { createHmac, timingSafeEqual } from "node:crypto";

const DURACAO_SESSAO = 8 * 60 * 60 * 1000;
const NOME_COOKIE = "admin_session";
const TAMANHO_MAX_TOKEN = 100;

function obterChave() {
    const segredo = process.env.SESSION_SECRET;

    if (
        typeof segredo !== "string" ||
        segredo.length < 32
    ) {
        throw new Error(
            "SESSION_SECRET não configurado corretamente."
        );
    }

    return segredo;
}

function assinar(valor) {
    return createHmac("sha256", obterChave())
        .update(valor, "utf8")
        .digest("hex");
}

export function criarSessao() {
    const expiracao = Date.now() + DURACAO_SESSAO;
    const dados = String(expiracao);
    const assinatura = assinar(dados);

    return `${dados}.${assinatura}`;
}

export function validarSessao(token) {
    if (
        typeof token !== "string" ||
        token.length === 0 ||
        token.length > TAMANHO_MAX_TOKEN
    ) {
        return false;
    }

    const partes = token.split(".");

    if (partes.length !== 2) {
        return false;
    }

    const [dados, assinatura] = partes;

    // Aceita somente um timestamp numérico em milissegundos.
    if (!/^\d{13}$/.test(dados)) {
        return false;
    }

    // Uma assinatura HMAC-SHA256 em hexadecimal tem 64 caracteres.
    if (!/^[a-f0-9]{64}$/.test(assinatura)) {
        return false;
    }

    const expiracao = Number(dados);

    if (
        !Number.isSafeInteger(expiracao) ||
        expiracao <= Date.now()
    ) {
        return false;
    }

    const assinaturaEsperada = assinar(dados);

    const recebida = Buffer.from(assinatura, "hex");
    const esperada = Buffer.from(
        assinaturaEsperada,
        "hex"
    );

    if (recebida.length !== esperada.length) {
        return false;
    }

    return timingSafeEqual(recebida, esperada);
}

export function obterToken(req) {
    const cookies = req.headers?.cookie;

    if (
        typeof cookies !== "string" ||
        cookies.length === 0
    ) {
        return null;
    }

    const prefixo = `${NOME_COOKIE}=`;

    const cookie = cookies
        .split(";")
        .map(item => item.trim())
        .find(item => item.startsWith(prefixo));

    if (!cookie) {
        return null;
    }

    const valor = cookie.slice(prefixo.length);

    if (
        valor.length === 0 ||
        valor.length > TAMANHO_MAX_TOKEN
    ) {
        return null;
    }

    try {
        const token = decodeURIComponent(valor);

        if (
            token.length === 0 ||
            token.length > TAMANHO_MAX_TOKEN
        ) {
            return null;
        }

        return token;
    } catch {
        return null;
    }
}

export function administradorAutenticado(req) {
    return validarSessao(obterToken(req));
}
