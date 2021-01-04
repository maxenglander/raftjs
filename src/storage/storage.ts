import * as fs from 'fs';

import { DurableType, IDurableValue, IDurableValueOptions } from './@types';

// Wraps a value that can be read and written to a path
// on disk. Can be configured with a `serializer` and a
// `deserializer` for transforming values read from or
// written to disk.
class BaseDurableValue<T extends DurableType> implements IDurableValue<T> {
  private deserializer: (data: Uint8Array) => T;
  private path: string;
  private serializer: (value: T) => Uint8Array;
  private inSync: boolean;
  private value: T;

  constructor(options: IDurableValueOptions<T>) {
    this.deserializer = options.deserializer;
    this.path = options.path;
    this.serializer = options.serializer;
    this.inSync = false;
    this.value = null;
  }

  // Returns a resolved Promise containing `true` if the
  // path exists on disk,  otherwise, resolved with `false`.
  public exists(): Promise<boolean> {
    return new Promise(resolve => {
      fs.access(this.path, fs.constants.F_OK, err => {
        if (err) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  // Returns a `Promise` containing the deserialized
  // contents of the path on disk, if present and non
  // empty; otherwise, returns the `defaultValue`.
  //
  // If the path on disk cannot be read due, for example
  // to insufficient permissions, a rejected `Promise`
  // is returned.
  public read(): Promise<T> {
    return new Promise((resolve, reject) => {
      fs.readFile(
        this.path,
        (
          err: any, // eslint-disable-line @typescript-eslint/no-explicit-any
          data: Buffer
        ) => {
          if (err != null) reject('Failed to read durable value: ' + err);
          this.value = this.deserializer(data);
          this.inSync = true;
          resolve(this.value);
        }
      );
    });
  }

  // If the path exists, read its value and return a Promise
  // resolved with the deserialized contents.
  //
  // Otherwise, set the provided value and write to disk,
  // returning a Promise resolved with the provided value.
  public readIfExistsElseSetAndWrite(value: T): Promise<T> {
    return this.exists().then(exists => {
      if (exists) {
        return this.read();
      } else {
        this.setValue(value);
        return this.write().then(() => {
          return value;
        });
      }
    });
  }

  // Returns a `Promise` that is resolved unless the value
  // cannot be written to the disk path.
  public write(): Promise<void> {
    if (this.inSync) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      fs.writeFile(
        this.path,
        this.serializer(this.value),
        { flag: 'w' },
        (
          err: any // eslint-disable-line @typescript-eslint/no-explicit-any
        ) => {
          if (err) {
            reject('Failed to write durable value: ' + err);
          } else {
            resolve();
          }
          this.inSync = true;
        }
      );
    });
  }

  // Returns the currently known value.
  // The value is null until it is `read` from the
  // disk path, and is null when `read` is called but
  // the disk path does not exist or is empty.
  public getValue(): T {
    return this.value;
  }

  // Updates the value. Changes to the value are not
  // persisted to disk until `write` is called.
  public setValue(newValue: T) {
    this.inSync = false;
    this.value = newValue;
  }
}

// A durable value that serializes and deserializes
// integers.
export class DurableInteger extends BaseDurableValue<number> {
  constructor(path: string) {
    super({
      deserializer(data: Buffer): number {
        return parseInt(data.toString('utf-8'));
      },
      path,
      serializer(value: number): Buffer {
        if (value == null) {
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
export class DurableString extends BaseDurableValue<string> {
  constructor(path: string) {
    super({
      deserializer(data: Buffer): string {
        return data.toString('utf-8');
      },
      path,
      serializer(value: string): Buffer {
        if (value == null) {
          return Buffer.alloc(0);
        } else {
          return Buffer.from(value);
        }
      }
    });
  }
}
