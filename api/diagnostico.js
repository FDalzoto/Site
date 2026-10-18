
import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
    const nomes = [
        "DATABASE_URL",
        "POSTGRES_URL",
        "POSTGRES_URL_NON_POOLING"
    ];

    const resultados = [];

    for (const nome of nomes) {
        const url = process.env[nome];

        if (!url) {
            resultados.push({
                variavel: nome,
                status: "não configurada"
            });
            continue;
        }

        try {
            const sql = neon(url);

            const banco = await sql`
                SELECT current_database() AS banco,
                       current_schema() AS esquema
            `;

            const tabelas = await sql`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            `;

            resultados.push({
                variavel: nome,
                status: "conectada",
                banco: banco[0].banco,
                esquema: banco[0].esquema,
                tabelas: tabelas.map(t => t.table_name)
            });
        } catch {
            resultados.push({
                variavel: nome,
                status: "falha na consulta"
            });
        }
    }

    return res.status(200).json(resultados);
}
