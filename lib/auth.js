
import {
    createHmac,
    timingSafeEqual
} from "node:crypto";

const DURACAO_SESSAO = 8 * 60 * 60 * 1000;
const NOME_COOKIE = "admin_session";
const TAMANHO_MAX_TOKEN = 300;

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

export function criarSessao(administradorId) {
    if (
        !Number.isSafeInteger(administradorId) ||
        administradorId <= 0
    ) {
        throw new Error("ID de administrador inválido.");
    }

    const expiracao = Date.now() + DURACAO_SESSAO;

    const dados = JSON.stringify({
        id: administradorId,
        exp: expiracao
    });

    const payload = Buffer.from(dados).toString("base64url");
    const assinatura = assinar(payload);

    return `${payload}.${assinatura}`;
}

export function validarSessao(token) {
    if (
        typeof token !== "string" ||
        token.length === 0 ||
        token.length > TAMANHO_MAX_TOKEN
    ) {
        return null;
    }

    const partes = token.split(".");

    if (partes.length !== 2) {
        return null;
    }

    const [payload, assinatura] = partes;

    if (
        !/^[A-Za-z0-9_-]+$/.test(payload) ||
        !/^[a-f0-9]{64}$/.test(assinatura)
    ) {
        return null;
    }

    const assinaturaEsperada = assinar(payload);

    const recebida = Buffer.from(assinatura, "hex");
    const esperada = Buffer.from(
        assinaturaEsperada,
        "hex"
    );

    if (
        recebida.length !== esperada.length ||
        !timingSafeEqual(recebida, esperada)
    ) {
        return null;
    }

    try {
        const dados = JSON.parse(
            Buffer.from(payload, "base64url").toString("utf8")
        );

        if (
            !Number.isSafeInteger(dados.id) ||
            dados.id <= 0 ||
            !Number.isSafeInteger(dados.exp) ||
            dados.exp <= Date.now()
        ) {
            return null;
        }

        return {
            administradorId: dados.id,
            expiracao: dados.exp
        };
    } catch {
        return null;
    }
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
    return validarSessao(obterToken(req)) !== null;
}

export function obterAdministradorId(req) {
    const sessao = validarSessao(obterToken(req));

    return sessao?.administradorId ?? null;
}
