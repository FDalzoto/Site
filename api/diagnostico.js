
import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
    const nomes = [
        "DATABASE_URL",
        "POSTGRES_URL",
        "POSTGRES_URL_NON_POOLING",
        "PETSHOP_DATABASE_URL"
    ];

    const resultados = [];

    for (const nome of nomes) {
        const url = process.env[nome];

        if (!url) {
            resultados.push({
                variavel: nome,
                status: "nao configurada"
            });

            continue;
        }

        try {
            const sql = neon(url);

            const banco = await sql`
                SELECT
                    current_database() AS banco,
                    current_schema() AS esquema,
                    current_user AS usuario
            `;

            const tabelas = await sql`
                SELECT
                    table_schema,
                    table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            `;

            resultados.push({
                variavel: nome,
                status: "conectada",
                banco: banco[0].banco,
                esquema: banco[0].esquema,
                tabelasEncontradas: tabelas.length,
                tabelas: tabelas.map(
                    tabela => tabela.table_name
                ),
                possuiTabelaProdutos: tabelas.some(
                    tabela => tabela.table_name === "produtos"
                )
            });
        } catch (erro) {
            console.error(
                `Erro ao testar ${nome}:`,
                erro.message
            );

            resultados.push({
                variavel: nome,
                status: "falha na consulta"
            });
        }
    }

    return res.status(200).json(resultados);
}
