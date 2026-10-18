
import { createHmac, timingSafeEqual } from "node:crypto";

const DURACAO_SESSAO = 8 * 60 * 60 * 1000;

function obterChave() {
    const segredo = process.env.SESSION_SECRET;

    if (!segredo || segredo.length < 32) {
        throw new Error("SESSION_SECRET não configurado corretamente.");
    }

    return segredo;
}

function assinar(valor) {
    return createHmac("sha256", obterChave())
        .update(valor)
        .digest("hex");
}

export function criarSessao() {
    const expiracao = Date.now() + DURACAO_SESSAO;
    const dados = String(expiracao);

    return `${dados}.${assinar(dados)}`;
}

export function validarSessao(token) {
    if (!token || typeof token !== "string") {
        return false;
    }

    const partes = token.split(".");

    if (partes.length !== 2) {
        return false;
    }

    const [dados, assinatura] = partes;
    const expiracao = Number(dados);

    if (
        !Number.isSafeInteger(expiracao) ||
        expiracao <= Date.now() ||
        !/^[a-f0-9]{64}$/.test(assinatura)
    ) {
        return false;
    }

    const assinaturaEsperada = assinar(dados);
    const recebida = Buffer.from(assinatura, "hex");
    const esperada = Buffer.from(assinaturaEsperada, "hex");

    return timingSafeEqual(recebida, esperada);
}

export function obterToken(req) {
    const cookies = req.headers.cookie || "";

    const cookie = cookies
        .split(";")
        .map(item => item.trim())
        .find(item => item.startsWith("admin_session="));

    if (!cookie) {
        return null;
    }

    try {
        return decodeURIComponent(
            cookie.slice("admin_session=".length)
        );
    } catch {
        return null;
    }
}

export function administradorAutenticado(req) {
    return validarSessao(obterToken(req));
}
