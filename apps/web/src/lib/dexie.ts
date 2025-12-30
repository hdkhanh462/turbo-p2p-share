import { Dexie, type EntityTable } from "dexie";

export interface EncryptionKey {
	id: string;
	privateKey: string;
	publicKey: string;
}

const db = new Dexie("AppDatabase") as Dexie & {
	keys: EntityTable<EncryptionKey, "id">;
};

db.version(1).stores({
	keys: "id",
});

export { db };
