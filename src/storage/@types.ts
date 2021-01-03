export type DurableType = number | string;

export type DurableTypeMap = { [T in DurableType]: T };

export interface IDurableValue<T extends DurableType> {
    exists(): Promise<boolean>;
    getValue(): T;
    read(): Promise<T>;
    readIfExistsElseSetAndWrite(value: T): Promise<T>;
    setValue(value: T): void;
    write(): Promise<void>;
}

export interface IDurableValueOptions<T extends DurableType> {
    deserializer: (data: Uint8Array) => T;
    path: string;
    serializer: (value: T) => Uint8Array;
}
