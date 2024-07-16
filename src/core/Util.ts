import { Encoded, extensionInvoke, OperationRequest } from "../background/core";
import { deserializeBufferObject, serializeBufferObject } from "../protobufs";

export const UTF8Decoder = new TextDecoder()
export const UTF8Encoder = new TextEncoder()

export function retain_keys<T extends {}>(obj:T, ...keys:(keyof T)[]): Extract<T, typeof keys> {
    const result:Partial<T> = {}
    for(const key of keys) {
        result[key] = obj[key]
    }
    return result as Extract<T, typeof keys>;
}

export function remove_keys<T extends {}>(obj:T, ...keys:(keyof T)[]): Partial<T> {
    const result:Partial<T> = {...obj}
    for(const key of keys) {
        delete result[key]
    }
    return result;
}

export function compose<I,T,O>(a:(inb:I)=>T, b:(mid:T)=>O): (inb:I)=>O {
    return (i) => b(a(i))
}

export function bytesToHexString(arr:Uint8Array): string {
    var result = ""
    for(const b of Array.from(arr)) {
        result += b.toString(16).padStart(2,"0").toUpperCase()
    }
    return result
}

export function extensionCache<T,U>(settings:{stringifier: (input: T) => string, resultEncoder: (input: U) => Uint8Array, resultRecover: (input: Uint8Array) => U, ttl?: number, func: (input: T) => Promise<U>}): (input: T) => Promise<U> {
    return async (input: T) => {
        const cacheKey = settings.stringifier(input)
        const cacheResult = await extensionInvoke({operation: OperationRequest.CACHE_GET, payload: {key: cacheKey}})
        if(cacheResult.result.outcome === "not_found" || cacheResult.result.outcome === "error") {
            const now = new Date()
            const calculated = await settings.func(input)
            await extensionInvoke({operation: OperationRequest.CACHE_PUT, payload: {
                key: cacheKey,
                value: serializeBufferObject(settings.resultEncoder(calculated)),
                expiry: settings.ttl? now.getTime() + settings.ttl : undefined
            }})
            return calculated
        } else {
            return settings.resultRecover(deserializeBufferObject(cacheResult.result.value))
        }
    }
}

export function cache<T,U>(func: (input: T) => NonNullable<U>, stringifier: (input: T) => string): (input: T) => NonNullable<U> {
    const cacheTable:Record<string,U|undefined>  = {}
    return (input: T) => {
        const cacheKey = stringifier(input)
        const cacheResult = cacheTable[cacheKey]
        if(cacheResult) {
            return cacheResult
        }
        const value = func(input)
        cacheTable[cacheKey] = value
        return value
    }
}

//idk why these weren't exported in the first place, so yoink!
export function bytesFromBase64(b64: string): Uint8Array {
    if ((globalThis as any).Buffer) {
        return Uint8Array.from(globalThis.Buffer.from(b64, "base64"));
    } else {
        const bin = globalThis.atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; ++i) {
            arr[i] = bin.charCodeAt(i);
        }
        return arr;
    }
}
  
export function base64FromBytes(arr: Uint8Array): string {
    if ((globalThis as any).Buffer) {
       return globalThis.Buffer.from(arr).toString("base64");
    } else {
        const bin: string[] = [];
        arr.forEach((byte) => {
            bin.push(globalThis.String.fromCharCode(byte));
        });
        return globalThis.btoa(bin.join(""));
    }
}

export function timeLimit<T extends (...args: any[]) => Promise<any>, U extends Awaited<ReturnType<T>>>(func:T, limit?: number):(...arg0: Parameters<T>) => Promise<U> {
    return (...args: Parameters<T>) =>
        new Promise((resolve, reject) => {
            func(...args).then(resolve).catch(reject)
            setTimeout(reject, limit ?? 25_000)
        })
}

export function flattenUint8Arrays(arrays: Uint8Array[], totalLen=arrays.reduce((a,b) => (a+b.length), 0)) {
    const res = new Uint8Array(totalLen)
    var loc = 0
    arrays.forEach(array => {
        res.set(array, loc)
        loc+=array.length
    })
    return res
}