/**
 * In-Memory Dexie.js v4 Implementation for E2E Testing Track
 * Provides full IndexedDB collection, table, index, and query emulation.
 */

export class Table<T = any, TKey = any> {
  private records = new Map<TKey, T>();
  private keyPath: string;

  constructor(keyPath = 'id') {
    this.keyPath = keyPath;
  }

  async add(item: T): Promise<TKey> {
    const key = (item as any)[this.keyPath];
    this.records.set(key, JSON.parse(JSON.stringify(item)));
    return key;
  }

  async put(item: T): Promise<TKey> {
    return this.add(item);
  }

  async get(key: TKey): Promise<T | undefined> {
    const item = this.records.get(key);
    return item ? JSON.parse(JSON.stringify(item)) : undefined;
  }

  async bulkGet(keys: TKey[]): Promise<Array<T | undefined>> {
    return Promise.all(keys.map((k) => this.get(k)));
  }

  async update(key: TKey, changes: Partial<T>): Promise<number> {
    const existing = this.records.get(key);
    if (!existing) return 0;
    Object.assign(existing, JSON.parse(JSON.stringify(changes)));
    return 1;
  }

  async delete(key: TKey): Promise<void> {
    this.records.delete(key);
  }

  async clear(): Promise<void> {
    this.records.clear();
  }

  async toArray(): Promise<T[]> {
    return Array.from(this.records.values()).map((v) => JSON.parse(JSON.stringify(v)));
  }

  orderBy(index: string) {
    const getAll = () => Array.from(this.records.values()).map((v) => JSON.parse(JSON.stringify(v)));
    return {
      reverse: () => ({
        toArray: async () => {
          const list = getAll();
          return list.sort((a, b) => {
            const valA = (a as any)[index];
            const valB = (b as any)[index];
            if (valB < valA) return -1;
            if (valB > valA) return 1;
            return 0;
          });
        },
      }),
      toArray: async () => {
        const list = getAll();
        return list.sort((a, b) => {
          const valA = (a as any)[index];
          const valB = (b as any)[index];
          if (valA < valB) return -1;
          if (valA > valB) return 1;
          return 0;
        });
      },
    };
  }

  where(field: string) {
    return {
      equals: (val: any) => ({
        reverse: () => ({
          sortBy: async (sortField: string) => {
            const list = Array.from(this.records.values()).filter((r: any) => r[field] === val);
            return list.sort((a: any, b: any) => b[sortField] - a[sortField]);
          },
          toArray: async () => {
            return Array.from(this.records.values()).filter((r: any) => r[field] === val).reverse();
          },
        }),
        sortBy: async (sortField: string) => {
          const list = Array.from(this.records.values()).filter((r: any) => r[field] === val);
          return list.sort((a: any, b: any) => a[sortField] - b[sortField]);
        },
        toArray: async () => {
          return Array.from(this.records.values()).filter((r: any) => r[field] === val);
        },
      }),
    };
  }
}

export type EntityTable<T, TKey extends keyof T> = Table<T, T[TKey]>;

export class Dexie {
  name: string;
  verno = 1;
  tables: Record<string, Table> = {};

  constructor(databaseName: string) {
    this.name = databaseName;
  }

  version(versionNumber: number) {
    this.verno = versionNumber;
    return {
      stores: (schema: Record<string, string>) => {
        for (const [tableName, indexDef] of Object.entries(schema)) {
          const primaryKey = indexDef.split(',')[0].trim().replace('&', '');
          const table = new Table(primaryKey);
          (this as any)[tableName] = table;
          this.tables[tableName] = table;
        }
        return this;
      },
    };
  }
}

export default Dexie;
