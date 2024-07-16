import type { Encoded } from "../background/core"
import { base64FromBytes, bytesFromBase64 } from "../core/Util"

const bytes = [] as const

export const referencePattern = {
    referenceType: 0,
    reference: bytes
}

export const indexPattern = {
    indexType: 0,
    logicalClock: 0,
}

export const indicesPattern = {
    indices: [indexPattern]
}

export const publicKeyPattern = {
    keyType: 0,
    key: bytes
}

export const processPattern = {
    process: bytes
}

export const vectorClockPattern = {
    logicalClocks: [0]
}

export const lwwElementPattern = {
    value: bytes,
    unixMilliseconds: 0
}

export const lwwElementSetPattern = {
    operation: 0,
    value: bytes,
    unixMilliseconds: 0
}

export const rangePattern = {
    low: 0,
    high: 0,
}

export const imageManifestPattern = {
    mime: bytes,
    width: 0,
    height: 0,
    byteCount: 0,
    process: processPattern,
    sections: [rangePattern],
}

export const imageBundlePattern = {
    imageManifests: [imageManifestPattern],
}

export const eventPattern = {
    system: publicKeyPattern,
    process: processPattern,
    logicalClock: 0,
    contentType: 0,
    content: bytes,
    vectorClock: vectorClockPattern,
    indices: indicesPattern,
    lwwElementSet: lwwElementSetPattern,
    lwwElement: lwwElementPattern,
    references: [referencePattern],
    unixMilliseconds: 0
}

export const signedEventPattern = {
    signature: bytes,
    event: bytes
}

export const signedEventsPattern = {
    events: [signedEventPattern]
}

export const postPattern = {
    content: bytes,
    image: imageManifestPattern,
}

export const systemProcessesPattern = {
    processes: [processPattern]
}

export const digestPattern = {
    digestType: 0,
    digest: bytes,
}

export const pointerPattern = {
    system: publicKeyPattern,
    process: processPattern,
    logicalClock: 0,
    eventDigest: digestPattern,
}

export const rangesForProcessPattern = {
    process: processPattern,
    ranges: [rangePattern]
}
  
export const rangesForSystemPattern = {
    rangesForProcesses: [rangesForProcessPattern]
}

export const numbersPattern = {
    numbers: [0]
}

export const queryReferencesRequestCountReferencesPattern = {
    fromType: 0
}

export const queryReferencesRequestCountLWWElementReferencesPattern = {
    value: bytes,
    fromType: 0
}

export const queryReferencesRequestEventsPattern = {
    fromType: 0,
    countLwwElementReferences: [queryReferencesRequestCountLWWElementReferencesPattern],
    countReferences: [queryReferencesRequestCountReferencesPattern]
}

export const queryReferencesRequestPattern = {
    reference: referencePattern,
    cursor: bytes,
    requestEvents: queryReferencesRequestEventsPattern,
    countLwwElementReferences: [queryReferencesRequestCountLWWElementReferencesPattern],
    countReferences: [queryReferencesRequestCountReferencesPattern],
    extraByteReferences: [bytes]
}

export const queryReferencesResponseEventItemPattern = {
    event: signedEventPattern,
    counts: [0]
}

export const queryReferencesResponsePattern = {
    items: [queryReferencesResponseEventItemPattern],
    relatedEvents: [signedEventPattern],
    cursor: bytes,
    counts: [0],
}

export const queryIndexResponsePattern = {
    events: [signedEventPattern],
    proof: [signedEventPattern]
}

export const decodedImagePattern = {
    mimeType: bytes,
    blob: bytes
}

export const decodedImagesPattern = {
    images: [decodedImagePattern]
}

export type ProtobufParsed<T> = T extends number ? bigint
    : T extends readonly [infer U] ? ProtobufParsed<U>[]
    : T extends [infer U] ? ProtobufParsed<U>[]
    : T extends readonly [] ? Uint8Array
    : T extends [] ? Uint8Array
    : T extends undefined ? undefined
    : {[key in keyof T] : ProtobufParsed<T[key]>}

export type EventType = ProtobufParsed<typeof eventPattern>
export const [encodeEvent] = prototypeToProtobufEncoder(eventPattern)
export const decodeEvent = prototypeToProtobufDecoder(eventPattern)
export type SignedEventType = ProtobufParsed<typeof signedEventPattern>
export const [encodeSignedEvent] = prototypeToProtobufEncoder(signedEventPattern)
export const decodeSignedEvent = prototypeToProtobufDecoder(signedEventPattern)
export type SignedEventsType = ProtobufParsed<typeof signedEventsPattern>
export const [encodeSignedEvents] = prototypeToProtobufEncoder(signedEventsPattern)
export const decodeSignedEvents = prototypeToProtobufDecoder(signedEventsPattern)
export type ReferenceType = ProtobufParsed<typeof referencePattern>
export const [encodeReference] = prototypeToProtobufEncoder(referencePattern)
export const decodeReference = prototypeToProtobufDecoder(referencePattern)
export type IndicesType = ProtobufParsed<typeof indicesPattern>
export const [encodeIndices] = prototypeToProtobufEncoder(indicesPattern)
export const decodeIndices = prototypeToProtobufDecoder(indicesPattern)
export type IndexType = ProtobufParsed<typeof indexPattern>
export const [encodeIndex] = prototypeToProtobufEncoder(indexPattern)
export const decodeIndex = prototypeToProtobufDecoder(indexPattern)
export type SystemType = ProtobufParsed<typeof publicKeyPattern>
export type PublicKeyType = SystemType
export type PrivateKeyType = PublicKeyType
export const [encodeSystem] = prototypeToProtobufEncoder(publicKeyPattern)
export const decodeSystem = prototypeToProtobufDecoder(publicKeyPattern)
export type ProcessType = ProtobufParsed<typeof processPattern>
export const [encodeProcess] = prototypeToProtobufEncoder(processPattern)
export const decodeProcess = prototypeToProtobufDecoder(processPattern)
export type VectorClockType = ProtobufParsed<typeof vectorClockPattern>
export const [encodeVectorClock] = prototypeToProtobufEncoder(vectorClockPattern)
export const decodeVectorClock = prototypeToProtobufDecoder(vectorClockPattern)
export type ImageManifestType = ProtobufParsed<typeof imageManifestPattern>
export const [encodeImageManifest] = prototypeToProtobufEncoder(imageManifestPattern)
export const decodeImageManifest = prototypeToProtobufDecoder(imageManifestPattern)
export type ImageBundleType = ProtobufParsed<typeof imageBundlePattern>
export const [encodeImageBundle] = prototypeToProtobufEncoder(imageBundlePattern)
export const decodeImageBundle = prototypeToProtobufDecoder(imageBundlePattern)
export type PostType = ProtobufParsed<typeof postPattern>
export const [encodePost] = prototypeToProtobufEncoder(postPattern)
export const decodePost = prototypeToProtobufDecoder(postPattern)
export type SystemProcessesType = ProtobufParsed<typeof systemProcessesPattern>
export const [encodeSystemProcesses] = prototypeToProtobufEncoder(systemProcessesPattern)
export const decodeSystemProcesses = prototypeToProtobufDecoder(systemProcessesPattern)
export type PointerType = ProtobufParsed<typeof pointerPattern>
export const [encodePointer] = prototypeToProtobufEncoder(pointerPattern)
export const decodePointer = prototypeToProtobufDecoder(pointerPattern)
export type DigestType = ProtobufParsed<typeof digestPattern>
export const [encodeDigest] = prototypeToProtobufEncoder(digestPattern)
export const decodeDigest = prototypeToProtobufDecoder(digestPattern)
export type RangesForProcessType = ProtobufParsed<typeof rangesForProcessPattern>
export const [encodeRangesForProcess] = prototypeToProtobufEncoder(rangesForProcessPattern)
export const decodeRangesForProcess = prototypeToProtobufDecoder(rangesForProcessPattern)
export type RangesForSystemType = ProtobufParsed<typeof rangesForSystemPattern>
export const [encodeRangesForSystem] = prototypeToProtobufEncoder(rangesForSystemPattern)
export const decodeRangesForSystem = prototypeToProtobufDecoder(rangesForSystemPattern)
export type NumbersType = ProtobufParsed<typeof numbersPattern>
export const [encodeNumbers] = prototypeToProtobufEncoder(numbersPattern)
export const decodeNumbers = prototypeToProtobufDecoder(numbersPattern)
export type QueryReferencesRequestCountLWWElementReferencesType = ProtobufParsed<typeof queryReferencesRequestCountLWWElementReferencesPattern>
export type QueryReferencesRequestCountReferencesType = ProtobufParsed<typeof queryReferencesRequestCountReferencesPattern>
export type QueryReferencesRequestEventsType = ProtobufParsed<typeof queryReferencesRequestEventsPattern>
export type QueryReferencesRequestType = ProtobufParsed<typeof queryReferencesRequestPattern>
export const [encodeQueryReferencesRequest] = prototypeToProtobufEncoder(queryReferencesRequestPattern)
export const decodeQueryReferencesRequest = prototypeToProtobufDecoder(queryReferencesRequestPattern)
export type QueryReferencesResponseType = ProtobufParsed<typeof queryReferencesResponsePattern>
export const [encodeQueryReferencesResponse] = prototypeToProtobufEncoder(queryReferencesResponsePattern)
export const decodeQueryReferencesResponse = prototypeToProtobufDecoder(queryReferencesResponsePattern)
export type QueryIndexResponseType = ProtobufParsed<typeof queryIndexResponsePattern>
export const [encodeQueryIndexResponse] = prototypeToProtobufEncoder(queryIndexResponsePattern)
export const decodeQueryIndexResponse = prototypeToProtobufDecoder(queryIndexResponsePattern)
export type DecodedImageType = ProtobufParsed<typeof decodedImagePattern>
export const [encodeDecodedImage] = prototypeToProtobufEncoder(decodedImagePattern)
export const decodeDecodedImage = prototypeToProtobufDecoder(decodedImagePattern)
export type DecodedImagesType = ProtobufParsed<typeof decodedImagesPattern>
export const [encodeDecodedImages] = prototypeToProtobufEncoder(decodedImagesPattern)
export const decodeDecodedImages = prototypeToProtobufDecoder(decodedImagesPattern)

export enum ClaimType {
    PLACEHOLDER,
    HackerNews,
    YouTube,
    Odysee,
    Rumble,
    Twitter,
    Bitcoin,
    Generic,
    Discord,
    Instagram,
    GitHub,
    Minds,
    Patreon,
    Substack,
    Twitch,
    Website,
    Kick,
    Soundcloud,
    Vimeo,
    Nebula,
    URL,
    Occupation,
    Skill,
    Spotify,
    Spreadshop,
    Polycentric,
    Gitlab,
    Dailymotion,
}

export function buffersAreEqual(a:Uint8Array, b:Uint8Array) {
    return a.length === b.length && a.find((val, index) => b[index] !== val) === undefined
}
export function digestsAreEqual(a:DigestType, b:DigestType) {
    return a.digestType === b.digestType && buffersAreEqual(a.digest, b.digest)
}

async function hash(arr: Uint8Array): Promise<Uint8Array> {
   return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", arr))
}

export function bufferToReference(buffer: Uint8Array): ReferenceType {
    return {
        referenceType: 3n,
        reference: buffer,
    };
}

export async function signedEventToPointer(signedEvent:SignedEventType): Promise<PointerType> {
    const event = decodeEvent(signedEvent.event);
    return {
        system: event.system,
        process: event.process,
        logicalClock: event.logicalClock,
        eventDigest: {
            digestType: 1n,
            digest: await hash(signedEvent.event),
        }
    };
}

function bits(a: bigint|number): string {
    let value = ""
    if(typeof a === "number") {
        while(a) {
            value = (["0", "1"][a % 2]) + value
            a = Math.floor(a/2)
        }
    }
    if(typeof a === "bigint") {
        while(a) {
            //@ts-ignore
            value = (["0", "1"][a % 2n]) + value
            //@ts-ignore
            a = a/2n
        }
    }
    return value
}

function parse_bytes(nt: Uint8Array, index=0): [Uint8Array, number] {
    const [length, newIndex] = parse_uint(nt, index)
    index = newIndex
    const end = index + Number(length)
    return [nt.slice(index, end), end]
}

function parse_uint(nt: Uint8Array, index=0): [bigint, number] {
    let result = 0n
    let place = 1n
    for(; nt[index] >= 128; index++) {
        result += place * (BigInt(nt[index]) - 128n)
        place *= 128n
    }
    result += place * BigInt(nt[index++])
    return [result, index]
}

function write_uint(nt: bigint | number) {
    const groups = bits(nt).split(/(?=(.{7})+$)/).filter((_,i) => ~i%2)
    for(let i = 0; i<groups.length; i++) {
        while(groups[i].length < 7) {
            groups[i] = "0" + groups[i]
        }
        if(i === 0) {
            groups[i] = "0" + groups[i]
        } else {
            groups[i] = "1" + groups[i]
        }
    }
    const result = new Uint8Array(groups.map(i =>parseInt(i, 2))).reverse()
    return result
}

function append(a: Uint8Array, b: Uint8Array): Uint8Array {
    return new Uint8Array([...a, ...b])
}

function write_bytes(content: Uint8Array): Uint8Array {
    if(content.length) {
        return new Uint8Array([...write_uint(content.length), ...content])
    } else {
        return new Uint8Array(0)
    }
}

function write_field(buffer: Uint8Array, id: number|bigint, content: Uint8Array): Uint8Array {
    if(content.length) {
        return new Uint8Array([...buffer, ...write_uint(id), ...content])
    } else {
        return new Uint8Array([...buffer])
    }
    
}

function write_subStruct(buffer:Uint8Array, id: number|bigint, content:Uint8Array) {
    if(content.length) {
        return new Uint8Array([...buffer, ...write_uint(id), ...write_uint(content.length), ...content])
    } else {
        return new Uint8Array([...buffer])
    }
}

export function prototypeToProtobufDecoder<T>(pattern: T): (buf: Uint8Array) => ProtobufParsed<T> {
    return (buffer:Uint8Array) => parse_struct(buffer, 0, pattern)[0]
}

function parse_struct<T>(nt: Uint8Array, index=0, pattern: T, size=nt.length-index): [ProtobufParsed<T>, number] {
    const keys = Object.keys(pattern as any) as (keyof T)[]
    const subpatterns = keys.map(key => (pattern as any)[key])
    let currentIndex = index, fieldId:any, value:any, subObjectLength:bigint;
    const resultObject:Record<string,any> = {}
    for(const [key, subpattern] of Object.entries(pattern as any)) {
        if((subpattern as any).constructor === Array) {
            resultObject[key] = []
        }
    }
    while(currentIndex < index + size) {
        ;[fieldId, currentIndex] = parse_uint(nt, currentIndex)
        fieldId/=8n
        //@ts-ignore
        const key = keys[fieldId - 1n]
        //@ts-ignore
        const subPattern = subpatterns[fieldId - 1n]
        if(subPattern.constructor === Array && subPattern.length === 0) {
            ;[value, currentIndex] = parse_bytes(nt, currentIndex)
            resultObject[key] = value
        } else if(subPattern.constructor === Number) {
            ;[value, currentIndex] = parse_uint(nt, currentIndex)
            resultObject[key] = value
        } else if(subPattern.constructor === Object) {
            ;[subObjectLength, currentIndex] = parse_uint(nt, currentIndex)
            ;[value, currentIndex] = parse_struct(nt, currentIndex, subPattern, Number(subObjectLength))
            resultObject[key] = value
        } else if(subPattern.constructor === Array && subPattern.length === 1 && subPattern[0] === 0) {
            ;[subObjectLength, currentIndex] = parse_uint(nt, currentIndex)
            const curLen = currentIndex
            let numb
            //@ts-ignore
            while((currentIndex - curLen) < subObjectLength) {
                [numb, currentIndex] = parse_uint(nt, currentIndex)
                resultObject[key].push(numb)
            }
        } else if(subPattern.constructor === Array && subPattern.length === 1 && subPattern[0].constructor === Object) {
            //first
            ;[subObjectLength, currentIndex] = parse_uint(nt, currentIndex)
            
            ;[value, currentIndex] = parse_struct(nt, currentIndex, subPattern[0], Number(subObjectLength))
            resultObject[key].push(value)
        }
    }
    
    return [resultObject as ProtobufParsed<T>, currentIndex]
}

export function deserializeBufferObject<T> (obj: Encoded<T>): T {
    if(obj === undefined || obj === null) {
        //@ts-ignore
        return obj
    }
    switch(obj.constructor.name) {
        case "Number":
        case "Boolean":
        case "String":
            //@ts-ignore
            return obj
        case "Array":
            //@ts-ignore
            return obj.map(deserializeBufferObject)
        default:
            //@ts-ignore
            switch(obj.__type) {
                case "bigint":
                    //@ts-ignore
                    return BigInt(obj.__value)
                case "buffer":
                    //@ts-ignore
                    return bytesFromBase64(obj.__value)
                default:
                    //@ts-ignore
                    return Object.fromEntries(Object.entries(obj).map(([key, val]) => [key, deserializeBufferObject(val)]))
            }
    }
}

export function serializeBufferObject<T> (obj: T): Encoded<T> {
    if(obj === undefined || obj === null) {
        //@ts-ignore
        return obj
    }
    switch(obj.constructor.name) {
        case "Number":
        case "Boolean":
        case "String":
            //@ts-ignore
            return obj
        case "BigInt":
            //@ts-ignore
            return {
                __type: "bigint",
                __value: obj.toString().replace("n","")
            }
        case "ArrayBuffer":
        case "Uint8Array":
            //@ts-ignore
            return {
                __type: "buffer",
                //@ts-ignore
                __value: base64FromBytes(obj)
            }
        case "Array":
            //@ts-ignore
            return obj.map(serializeBufferObject)
        default:
            //@ts-ignore
            return Object.fromEntries(Object.entries(obj).map(([key, val]) => [key, serializeBufferObject(val)]))
    }
}

export function prototypeToProtobufEncoder<T extends object>(pattern: T, fieldKey = 0): [(item: Partial<ProtobufParsed<T>>) => Uint8Array, number] {
    if(pattern.constructor === Number) {
        //@ts-ignore
        return [write_uint, 0]
        //@ts-ignore
    } else if(pattern.constructor === Array && pattern.length === 0) {
        //@ts-ignore
        return [write_bytes, 2]
        //@ts-ignore
    } else if(pattern.constructor === Array && pattern.length === 1) {
        const [encodeContent, type] = prototypeToProtobufEncoder(pattern[0])
        //@ts-ignore maybe this one shouldn't be ignored?
        return [(list) => {
            if(type === 2) {
                //@ts-ignore
                return list.reduce((arr, elem) => {
                    if(type === 2) {
                        //@ts-ignore
                        return write_subStruct(arr, fieldKey + type, encodeContent(elem))
                    }
                }, new Uint8Array())
            } else {
                //@ts-ignore
                return write_subStruct(new Uint8Array(), fieldKey + 2, list.map(encodeContent).reduce(append, []))
            }
            
        }, 2]
    } else if(pattern.constructor === Object) {
        return [obj => {
            let result = new Uint8Array(0)
            let fieldCount = 0
            for(const key of Object.keys(pattern)) {
                fieldCount++;
                //@ts-ignore
                const subPattern = pattern[key]
                //@ts-ignore
                const value = obj[key]
                if(value === undefined || value === null) {
                    continue;
                }
                if(subPattern.constructor === Array) {
                    if(subPattern.length === 0) {
                        result = write_field(result, fieldCount * 8 + 2, write_bytes(value))
                    } else if(subPattern.length === 1) {
                        const [encodeContent, type] = prototypeToProtobufEncoder(subPattern, fieldCount*8)
                        result = append(result, encodeContent(value))
                    } else {
                        throw new Error("invalid schema: " + JSON.stringify(subPattern))
                    }
                } else if(subPattern.constructor === Object) {
                    const [encodeContent, type] = prototypeToProtobufEncoder(subPattern, fieldCount*8)
                    result = write_subStruct(result, fieldCount * 8 + type, encodeContent(value))
                } else if(subPattern.constructor === Number) {
                    const [encodeContent, type] = prototypeToProtobufEncoder(subPattern, fieldCount*8)
                    result = write_field(result, fieldCount * 8 + type, encodeContent(value))
                } else {
                    throw new Error("invalid schema: " + JSON.stringify(subPattern))
                }
            }
            return result
        }, 2]
    } else {
        throw new Error("invalid schema: " + JSON.stringify(pattern))
    }
}

export const ContentType = Object.freeze({
    Delete: 1n,
    SystemProcesses: 2n,
    Post: 3n,
    Follow: 4n,
    Username: 5n,
    Description: 6n,
    BlobMeta: 7n,
    BlobSection: 8n,
    Avatar: 9n,
    Server: 10n,
    Vouch: 11n,
    Claim: 12n,
    Banner: 13n,
    Opinion: 14n,
    Store: 15n,
    Authority: 16n,
    JoinTopic: 17n,
    Block: 18n,
})