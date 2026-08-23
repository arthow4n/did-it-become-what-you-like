import { Repo } from "automerge-repo";
import { IndexedDBStorageAdapter } from "automerge-idb";

export const REPOSITORY_DATABASE = "did-it-become-what-you-like";

export function createBrowserRepo(): Repo {
  return new Repo({
    network: [],
    storage: new IndexedDBStorageAdapter(REPOSITORY_DATABASE),
  });
}
