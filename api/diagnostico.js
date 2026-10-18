
import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
    try {
        const sql = neon(process.env.POSTGRES_URL_NON_POOLING);

        const banco = await sql`
            SELECT
                current_database() AS banco,
                current_schema() AS esquema
        `;

        const tabelas = await sql`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `;

        return res.status(200).json({
            conexao: banco[0],
            tabelas: tabelas.map(t => t.table_name)
        });
    } catch (erro) {
        console.error("Erro no diagnóstico:", erro);

        return res.status(500).json({
            erro: "Falha no diagnóstico da conexão."
        });
    }
}
