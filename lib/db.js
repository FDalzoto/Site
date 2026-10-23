import { neon } from "@neondatabase/serverless";

const connectionString =
    process.env.PETSHOP_DATABASE_URL ||
    process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error(
        "A conexão com o banco de dados não está configurada."
    );
}

const sql = neon(connectionString);

export default sql;