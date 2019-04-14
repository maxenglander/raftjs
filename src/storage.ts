import * as fs from 'fs';

export type DurableType = number | string;

export type DurableTypeMap = { [T in DurableType]: T };

export interface IDurableValue<T extends DurableType> {
    read(defaultValue?: T): Promise<T>;
    write(): Promise<void>;
    value: T;
}

export interface IDurableValueOptions<T extends DurableType> {
    deserializer: (data: Uint8Array) => T;
    path: string;
    serializer: (value: T) => Uint8Array;
}

// Wraps a value that can be read and written to a path
// on disk. Can be configured with a `serializer` and a
// `deserializer` for transforming values read from or
// written to disk.
class BaseDurableValue<T extends DurableType> implements IDurableValue<T> {
    private deserializer: (data: Uint8Array) => T;
    private path: string;
    private serializer: (value: T) => Uint8Array;
    private inSync: boolean;
    private _value: T;

    constructor(options: IDurableValueOptions<T>) {
        this.deserializer = options.deserializer;
        this._value = null;
        this.path = options.path;
        this.serializer = options.serializer;
        this.inSync = false;
    }

    // Returns a `Promise` containing the deserialized
    // contents of the path on disk, if present and non
    // empty; otherwise, returns the `defaultValue`.
    //
    // If the path on disk cannot be read due, for example
    // to insufficient permissions, a rejected `Promise`
    // is returned.
    public read(defaultValue: T = null): Promise<T> {
        if(this.inSync) return Promise.resolve(this._value);

        return new Promise((function(resolve: any, reject: any) {
            fs.readFile(this.path, (function(err: any, data: Buffer) {
                if(err == null || err.code == 'ENOENT') {
                    let value = null;
                    if(err != null) {
                        value = defaultValue;
                    } else {
                        value = this.deserializer(data);
                    }
                    this.inSync = true;
                    this.value = value;
                    resolve(this.value);
                } else {
                    reject('Failed to read durable value: ' + err);
                }
            }).bind(this));
        }).bind(this));
    }

    // Returns a `Promise` that is fulfilled unless the value
    // cannot be written to the disk path.
    public write(): Promise<void> {
        if(this.inSync) {
            return Promise.resolve();
        }

        return new Promise((function(resolve: any, reject: any) {
            fs.writeFile(this.path, this.serializer(this.value), { flag: 'w' }, (function(err: string) {
                if(err) {
                    reject('Failed to write durable value: ' + err);
                } else {
                    resolve(this.value);
                }
                this.inSync = true;
            }).bind(this));
        }).bind(this));
    }

    // Returns the currently known value.
    // The value is null until it is `read` from the
    // disk path, and is null when `read` is called but
    // the disk path does not exist or is empty.
    public get value(): T {
        return this._value;
    }

    // Updates the value. Changes to the value are not
    // persisted to disk until `write` is called.
    public set value(newValue: T) {
        this.inSync = false;
        this._value = newValue;
    }
}

// A durable value that serializes and deserializes
// integers.
class DurableInteger extends BaseDurableValue<number> {
    constructor(path: string) {
        super({
            deserializer(data: Buffer): number {
                return parseInt(data.toString('utf-8'));
            },
            path,
            serializer(value: number): Buffer {
                if(value == null) {
                    return Buffer.alloc(0);
                } else {
                    return Buffer.from(value + '');
                }
            }
        });
    }
}

// A durable value that serializes and deserializes
// strings.
class DurableString extends BaseDurableValue<string> {
    constructor(path: string) {
        super({
            deserializer(data: Buffer): string {
                return data.toString('utf-8');
            },
            path,
            serializer(value: string): Buffer {
                if(value == null) {
                    return Buffer.alloc(0);
                } else {
                    return Buffer.from(value);
                }
            }
        });
    }
}

export function createDurableInteger(path: string): IDurableValue<number> {
    return new DurableInteger(path);
}

export function createDurableString(path: string): IDurableValue<string> {
    return new DurableString(path);
}
