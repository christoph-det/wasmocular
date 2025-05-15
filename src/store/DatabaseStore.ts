import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { makeAutoObservable } from 'mobx';

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




export class DatabaseStore {
    db: duckdb.AsyncDuckDB | null = null;
    worker: Worker | null = null;
    logger: duckdb.ConsoleLogger | null = null;
    connection : duckdb.AsyncDuckDBConnection | null = null;

    constructor() {
        makeAutoObservable(this);
        this.init();
    }   

    async init() {
        // Select a bundle based on browser checks
        const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
        // Instantiate the asynchronus version of DuckDB-wasm
        this.worker = new Worker(bundle.mainWorker!);
        this.logger = new duckdb.ConsoleLogger();
        this.db = new duckdb.AsyncDuckDB(this.logger, this.worker);
        await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    }

    async connect() {
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
        }
        else {
            return "No connection to database";
        }
    }


    

}