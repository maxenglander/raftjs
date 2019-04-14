// Used by TypeScript, mainly for [exhaustiveness
// checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
export function compilerError(x: never): never {
    throw new Error('Unreachable code was reached');
}
