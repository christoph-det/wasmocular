import initGitoxide from './wasm-gix-library/wasm_gix.js';

let gitoxide: any = null;
const GITOXIDE_LOG_PREFIX = '[gitoxide]';
const PERSIST_ROOT = '/repos';
const createdDirs: Set<string> = new Set(['/']);
let storedRepositories: string[] = [];

gitoxide = await initGitoxide();
console.log('gitoxide wasm module loaded');
await setupPersistentFs();


async function setupPersistentFs() {
    try {
        gitoxide.FS.mkdir(PERSIST_ROOT);
    } catch (error) {
        console.error('Error creating PERSIST_ROOT:', error);
    }

    try {
        gitoxide.FS.mount(gitoxide.IDBFS, {}, PERSIST_ROOT);
    } catch (error) {
        console.error('Error mounting IDBFS:', error);
    }

    await syncFs(true);
    createdDirs.add(PERSIST_ROOT);
    //persistentReady = true;
    await refreshStoredRepos();
}

async function syncFs(populate: boolean) {
    return new Promise((resolve, reject) => {
        gitoxide.FS.syncfs(populate, (error: Error) => {
            if (error) {
                reject(error);
            } else {
                console.log('IDBFS sync complete');
                resolve(null);
            }
        });
    }).catch((error) => {
        console.error('IDBFS sync failed:', error);
    });
}

async function refreshStoredRepos() {
    let repos: string[] = [];
    try {
        repos = gitoxide.FS.readdir(PERSIST_ROOT)
            .filter((name: string) => name !== '.' && name !== '..')
            .sort((a: string, b: string) => a.localeCompare(b));
    } catch (error) {
        console.warn('Failed to enumerate stored repositories', error);
    }
    storedRepositories = repos;
}


onmessage = (event) => {
  const data = event.data || {};
  if (!gitoxide) {
    console.log("wasmgixWorker: Received message but not initialized yet!");
    return;
  }


};