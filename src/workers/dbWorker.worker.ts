import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
    },
    eh: {
        mainModule: duckdb_wasm_eh,
        mainWorker: eh_worker,
    },
};

class DatabaseStore {
    worker: Worker | null = null;
    db: duckdb.AsyncDuckDB | null = null;
    logger: duckdb.ConsoleLogger | null = null;
    connection : duckdb.AsyncDuckDBConnection | null = null;

    constructor() {
        this.init();
    }

    async init() {
        if (!this.db) {
            const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
            this.worker = new Worker(bundle.mainWorker!);
            this.logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING)
            this.db = new duckdb.AsyncDuckDB(this.logger, this.worker);
            await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
            await this.createTables();
            console.log("Database initialized");
        }
    }

    async connect() {
        if (!this.db) {
            await this.init();
        }
        if (this.db) {
            this.connection = await this.db.connect();
        } else {
            console.error("Database not initialized");
        }
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.close();
            this.connection = null;
        }
    }

    async query(sql: string) {
        if (!this.connection) {
            await this.connect();
        }
        if (this.connection) {
            const result = await this.connection.query(sql);
            return result;
        } else {
            throw new Error("No connection to database");
        }
    }

    async createTables() {
        if (!this.connection) {
            await this.connect();
        }
        if (this.connection) {
            await this.query("CREATE TABLE IF NOT EXISTS people (id INTEGER, name VARCHAR)");
        } else {
            throw new Error("No connection to database");
        }
    }
}

const dbStore = new DatabaseStore();

onmessage = async function(event) {
    //console.log("Worker received message:", event.data);
    const { type, sql, returnResult } = event.data;
    try {
        if (type === "query") {
            const result = await dbStore.query(sql);
            if (returnResult) {
                const arrayResult = result.toArray();
                const cloneableResult = JSON.parse(
                    JSON.stringify(arrayResult, (_, v) => typeof v === "bigint" ? v.toString() : v)
                );
                postMessage({ type: "result", result: cloneableResult });
            }        
        }
    } catch (error: any) {
        postMessage({ type: "error", error: error.message });
    }
};
