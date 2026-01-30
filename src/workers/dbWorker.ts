import * as duckdb from "@duckdb/duckdb-wasm";
import * as Comlink from "comlink";
import type { GitHubIssue, GitHubIssueEvent } from "./dbWorker.d";
import { MANUAL_BUNDLES } from "./dbWorker.d";

/**
 * Worker to manage DuckDB database operations.
 */
export class DatabaseWorker {
  private worker: Worker | null = null;
  private db: duckdb.AsyncDuckDB | null = null;
  private connection: duckdb.AsyncDuckDBConnection | null = null;
  private isInitialized = false;
  private repositoryIdentifier: string | null = null;
  private accessMode: duckdb.DuckDBAccessMode | null = null;

  /**
   * Initializes the database for the given repository identifier and access mode.
   */
  async initialize(
    repositoryIdentifier: string,
    accessMode: duckdb.DuckDBAccessMode
  ) {
    if (this.isInitialized) {
      const sameIdentifier = this.repositoryIdentifier === repositoryIdentifier;
      const sameMode = this.accessMode === accessMode;

      if (sameIdentifier && sameMode) {
        return;
      }

      await this.shutdown(!sameIdentifier);
    }

    await this.instantiateDatabase(repositoryIdentifier, accessMode);

    this.repositoryIdentifier = repositoryIdentifier;
    this.accessMode = accessMode;
    this.isInitialized = true;
    this.connection = null;

    console.log(
      `Database initialized for identifier "${repositoryIdentifier}" in ${duckdb.DuckDBAccessMode[accessMode]} mode`
    );
  }

  private async instantiateDatabase(
    repositoryIdentifier: string,
    accessMode: duckdb.DuckDBAccessMode
  ) {
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    this.worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.VoidLogger();
    //const logger = new duckdb.ConsoleLogger();
    this.db = new duckdb.AsyncDuckDB(logger, this.worker);
    await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    try {
      await this.db.open({
        path: `opfs://wasmocular_database_${repositoryIdentifier}.db`,
        accessMode
      });
    } catch (error) {
      if (accessMode === duckdb.DuckDBAccessMode.READ_ONLY) {
        console.log(
          "DB Worker: OPFS access handle busy; opening read-only snapshot.",
          error
        );
        await this.openReadOnlySnapshot(repositoryIdentifier);
        return;
      }
      throw error;
    }
  }

  private async openReadOnlySnapshot(repositoryIdentifier: string) {
    if (!this.db) {
      throw new Error("Database not instantiated");
    }

    const dbFileName = `wasmocular_database_${repositoryIdentifier}.db`;
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(dbFileName);
    const file = await fileHandle.getFile();
    const buffer = new Uint8Array(await file.arrayBuffer());

    await this.db.registerFileBuffer(dbFileName, buffer);
    await this.db.open({
      path: dbFileName,
      accessMode: duckdb.DuckDBAccessMode.READ_ONLY
    });
  }

  private async shutdown(resetRepositoryInfo: boolean) {
    if (this.connection) {
      try {
        await this.connection.query("CHECKPOINT;");
      } catch (error) {
        console.warn("DB Worker: Failed to checkpoint before shutdown:", error);
      }

      try {
        await this.connection.close();
      } catch (error) {
        console.warn("DB Worker: Failed to close connection cleanly:", error);
      }

      this.connection = null;
    }

    if (this.db) {
      await this.db.terminate();
      this.db = null;
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.isInitialized = false;
    this.accessMode = null;

    if (resetRepositoryInfo) {
      this.repositoryIdentifier = null;
    }
  }

  /**
   * Deletes the database file for the given repository identifier.
   */
  async deleteDatabase(repositoryIdentifier: string) {
    this.repositoryIdentifier = repositoryIdentifier;
    const dbPath = `wasmocular_database_${repositoryIdentifier}.db`;
    await this.shutdown(false);
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(dbPath);
      await root.removeEntry(dbPath + ".wal");
    } catch (error) {
      console.error(
        `DB Worker: Failed to delete database for identifier "${repositoryIdentifier}":`,
        error
      );
    }
  }

  private async connect() {
    if (!this.db || !this.isInitialized) {
      throw new Error(
        "Database not initialized. Call INIT with a repository identifier first."
      );
    }
    this.connection = await this.db.connect();
  }

  private async ensureConnection(
    write = false
  ): Promise<duckdb.AsyncDuckDBConnection> {
    if (!this.repositoryIdentifier) {
      throw new Error("Database not initialized for any repository");
    }
    if (write && this.accessMode !== duckdb.DuckDBAccessMode.READ_WRITE) {
      await this.switchAccessMode(duckdb.DuckDBAccessMode.READ_WRITE);
    }
    if (!this.connection) {
      await this.connect();
    }
    return this.connection!;
  }

  async terminate() {
    await this.shutdown(true);
  }

  /**
   * Sets the connection access mode (READ_ONLY or READ_WRITE).
   */
  async switchAccessMode(accessMode: duckdb.DuckDBAccessMode) {
    if (!this.repositoryIdentifier) {
      throw new Error("Cannot switch access mode before initialization");
    }

    if (this.accessMode === accessMode && this.isInitialized) {
      return;
    }

    await this.shutdown(false);
    await this.instantiateDatabase(this.repositoryIdentifier, accessMode);

    this.accessMode = accessMode;
    this.isInitialized = true;
    this.connection = null;

    console.log(
      `Database access mode switched to ${duckdb.DuckDBAccessMode[accessMode]} for identifier "${this.repositoryIdentifier}"`
    );
  }

  // Saves the current state of the database to persistent storage.
  private async persistCheckpoint() {
    if (!this.connection) {
      throw new Error("No active database connection for checkpointing");
    }
    await this.connection.query("CHECKPOINT;");
  }

  /**
   * Executes the given SQL query and returns the results.
   */
  async query(sql: string) {
    const connection = await this.ensureConnection();
    const result = await connection.query(sql);
    const rows = result
      .toArray()
      .map((row) =>
        row && typeof (row as { toJSON?: () => unknown }).toJSON === "function"
          ? (row as { toJSON: () => unknown }).toJSON()
          : row
      );
    const cloneableResult: unknown = JSON.parse(
      JSON.stringify(rows, (_, value: unknown) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );
    return cloneableResult;
  }

  /**
   * Inserts indexer data (in Arrow IPC format) into the database.
   */
  async insertIndexerData(identifier: string, buffer: Uint8Array) {
    if (identifier !== this.repositoryIdentifier) {
      throw new Error(
        `Indexer data identifier "${identifier}" does not match initialized repository "${this.repositoryIdentifier}"`
      );
    }

    const connection = await this.ensureConnection(true);

    const tableName = `commits`;
    const tableExistsResult = await connection.query(`SELECT COUNT(table_name)
      FROM information_schema.tables
      WHERE table_schema = 'main' and table_name = '${tableName}'
    `);

    const tableExists =
      (tableExistsResult.toArray()[0] as { "count(table_name)": number })[
        "count(table_name)"
      ] > 0;

    await connection.insertArrowFromIPCStream(buffer, {
      name: tableName,
      create: !tableExists
    });
    await this.persistCheckpoint();

    console.log(`DB Worker: Inserted indexer data into table ${tableName}`);
  }

  /**
   * Inserts GitHub issues into the database and creates the necessary table.
   */
  async insertGitHubIssues(issues: GitHubIssue[]) {
    const connection = await this.ensureConnection(true);
    const tableName = "github_issues";

    await connection.query(`
      CREATE TABLE ${tableName} (
        id BIGINT,
        number INTEGER,
        title VARCHAR,
        state VARCHAR,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        closed_at TIMESTAMP,
        author VARCHAR,
        labels VARCHAR,
        comments_count INTEGER,
        body VARCHAR
      )
    `);

    if (issues.length > 0) {
      const stmt = await connection.prepare(
        `INSERT INTO ${tableName} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const issue of issues) {
        await stmt.query(
          issue.id,
          issue.number,
          issue.title,
          issue.state,
          issue.createdAt,
          issue.updatedAt,
          issue.closedAt,
          issue.author,
          issue.labels,
          issue.commentsCount,
          issue.body
        );
      }
      await stmt.close();
    }

    await this.persistCheckpoint();
    console.log(`DB Worker: Inserted ${issues.length} GitHub issues.`);
  }

  /**
   * Inserts GitHub issue events into the database and creates the necessary table.
   */
  async insertGitHubIssueEvents(events: GitHubIssueEvent[]) {
    const connection = await this.ensureConnection(true);
    const tableName = "github_issue_events";

    await connection.query(`
      CREATE TABLE ${tableName} (
        issue_number INTEGER,
        event_type VARCHAR,
        commit_sha VARCHAR,
        created_at TIMESTAMP,
        actor VARCHAR
      )
    `);

    if (events.length > 0) {
      const stmt = await connection.prepare(
        `INSERT INTO ${tableName} VALUES (?, ?, ?, ?, ?)`
      );

      for (const event of events) {
        await stmt.query(
          event.issueNumber,
          event.eventType,
          event.commitSha,
          event.createdAt,
          event.actor
        );
      }

      await stmt.close();
    }

    await this.persistCheckpoint();
    console.log(`DB Worker: Inserted ${events.length} GitHub issue events.`);
  }
}

const dbWorker = new DatabaseWorker();
Comlink.expose(dbWorker);
