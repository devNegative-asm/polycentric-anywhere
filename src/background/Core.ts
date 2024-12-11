import { derivePublicKey, PolycentricUtils, PostHead } from "../core/PolycentricUtils";
import { base64FromBytes, bytesFromBase64, timeLimit } from "../core/Util";
import {
    decodeEvent,
    decodeSignedEvent,
    deserializeBufferObject,
    encodeSignedEvent,
    EventType,
    ImageManifestType,
    PrivateKeyType,
    ProcessType,
    PublicKeyType,
    ReferenceType,
    serializeBufferObject
} from '../protobufs';
import { utils as noble } from "@noble/ed25519"

type PolycentricAppSettings = Encoded<{
    width: string,
    height: string,
}>

export enum OperationRequest {
    INC = "INC",//test operation
    SYNC = "SYNC",
    POST = "POST",
    SIGN_IN = "SIGN_IN",
    SIGN_OUT = "SIGN_OUT",
    SETTINGS = "SETTINGS",
    CACHE_PUT = "CACHE_PUT",
    CACHE_GET = "CACHE_GET",
    CACHE_CLEAR = "CACHE_CLEAR",
    CACHE_CLEAN = "CACHE_CLEAN",
    CACHE_DELETE = "CACHE_DELETE",
    GET_STATE = "GET_STATE",
    ADD_SERVER = "ADD_SERVER",    
    GET_SERVERS = "GET_SERVERS",
    REMOVE_SERVER = "REMOVE_SERVER",
    DERIVE_PUBLIC = "DERIVE_PUBLIC",
}

export type Decoded<T> =
    T extends undefined ? undefined :
    T extends string ? string :
    T extends {__type: "bigint", __value: string} ? bigint :
    T extends {__type: "buffer", __value: string} ? Uint8Array :
    T extends (infer U)[] ? Decoded<U>[] :
    {[K in keyof T as T[K] extends Function ? never: K]: T[K] extends (string|number|boolean) ? T[K] : Decoded<T[K]>}

export type Encoded<T> =
    T extends undefined ? undefined :
    T extends string ? string :
    T extends bigint ? {__type: "bigint", __value: string} :
    T extends ArrayBufferLike ? {__type: "buffer", __value: string} :
    T extends Uint8Array ? {__type: "buffer", __value: string} :
    T extends ArrayLike<any> ? Encoded<T[number]>[] :
    {[K in keyof T as T[K] extends Function ? never: K]: T[K] extends (string|number|boolean) ? T[K] : Encoded<T[K]>}

interface PostPayload {
    content: string
    references?: ReferenceType[]
    image?: ImageManifestType
}


export function encodeUInt8Array(arg: Uint8Array): Encoded<Uint8Array> {
    return {
        __type: "buffer",
        __value: base64FromBytes(arg)
    }
}

export function decodeUInt8Array(arg: Encoded<Uint8Array>): Uint8Array {
    return bytesFromBase64(arg.__value)
}

export function extensionInvoke<T>(operation: (Operation & {operation: T})): Promise<OperationResult & {operation: T}> {
    return browser.runtime.sendMessage(operation)
}

//all Operation, OperationResult, and PersistentStore values must be serialized.
export type Operation =
Encoded<
    |{operation: OperationRequest.INC, payload: number}//testing purposes only
    |{operation: OperationRequest.SYNC, payload: {server: string[], historyCount: number}}//TODO: not implemented
    |{operation: OperationRequest.POST, payload: PostPayload}
    |{operation: OperationRequest.SIGN_IN, payload: {key: PrivateKeyType, process: ProcessType|null}}
    |{operation: OperationRequest.SIGN_OUT, payload: {}}
    |{operation: OperationRequest.CACHE_PUT, payload: {key: string, value: Uint8Array, expiry?:number}}
    |{operation: OperationRequest.CACHE_GET, payload: {key: string}}
    |{operation: OperationRequest.CACHE_CLEAR, payload: {}}
    |{operation: OperationRequest.CACHE_CLEAN, payload: {}}
    |{operation: OperationRequest.CACHE_DELETE, payload: {key: string}}//TODO: not implemented
    |{operation: OperationRequest.GET_STATE, payload: {}}
    |{operation: OperationRequest.ADD_SERVER, payload: {server: string}}
    |{operation: OperationRequest.GET_SERVERS, payload: {}}
    |{operation: OperationRequest.REMOVE_SERVER, payload: {server: string}}
    |{operation: OperationRequest.DERIVE_PUBLIC, payload: {privateKey: PrivateKeyType}}
    |{operation: OperationRequest.SETTINGS, payload: { [P in keyof PolycentricAppSettings]?: PolycentricAppSettings[P] | undefined | null}}
>

type Potential<V extends string,T> = ({[K in V]: T}&{outcome: "success"})|{outcome: "error", error: string}
type Success = {outcome: "success"}|{outcome: "error", error: string}
export type OperationResult =
Encoded<
    |{operation: OperationRequest.INC, result: number}//testing purposes only
    |{operation: OperationRequest.SYNC, result: {server: string[]}}//TODO: not implemented
    |{operation: OperationRequest.POST, result: Potential<"event",EventType>}
    |{operation: OperationRequest.SIGN_IN, result: Potential<"system",PublicKeyType>}
    |{operation: OperationRequest.SIGN_OUT, result: Success}
    |{operation: OperationRequest.CACHE_PUT, result: Success}
    |{operation: OperationRequest.CACHE_GET, result: {outcome: "success", value: Uint8Array}|{outcome: "not_found"}}
    |{operation: OperationRequest.CACHE_CLEAR, result: Success}
    |{operation: OperationRequest.CACHE_CLEAN, result: Success}
    |{operation: OperationRequest.CACHE_DELETE, result: Success}//TODO: not implemented
    |{operation: OperationRequest.GET_STATE, result: Potential<"system",PublicKeyType>}
    |{operation: OperationRequest.ADD_SERVER, result: Success}
    |{operation: OperationRequest.GET_SERVERS, result: Potential<"servers",string[]>}
    |{operation: OperationRequest.REMOVE_SERVER, result: Success}
    |{operation: OperationRequest.DERIVE_PUBLIC, result: Potential<"publicKey", PublicKeyType>}
    |{operation: OperationRequest.SETTINGS, result: {outcome: "success", settings: Partial<PolycentricAppSettings>}}
    |{operation: any, result: {outcome: "error", error: "match failure"}}
>

interface PersistentStore {
    saved: boolean,
    writeHead: Parameters<typeof PostHead.fromJSON>[number]|null
    myProcessEvents: Encoded<Uint8Array[]>|null
    otherUsers: {[key:string] : Omit<PersistentStore,"otherUsers">}
}

const store = browser.storage.local

const POST_LOCK = "POLYCENTRIC_ANYWHERE_POST_LOCK"
const SERVER_LIST_LOCK = "POLYCENTRIC_ANYWHERE_SERVER_LIST_LOCK"
const CACHE_LOCK = "CACHE_LOCK"

const defaultSettings: PolycentricAppSettings = {
    width: "40vw",
    height: "40vh",
}

function handler(message: Operation, notifier: any, sendResponse:(response:OperationResult)=>void):boolean {
    const {operation} = message

    console.log(`got request ${JSON.stringify(message)}`)
    const asyncHandle = (async () => {
        const getStore = async () => await store.get({
            saved: false,
            writeHead: null,
            myProcessEvents: null,
            otherUsers: {},
        }) as PersistentStore

        const getServers = async () => (await store.get({
            servers: ["https://srv1-prod.polycentric.io"]
        }) as {servers: string[]}).servers

        const settingsKey = (str: string) => "SETTINGS." + str
        const cacheKey = (str: string) => "CACHE." + str

        var result:OperationResult = {operation: operation, result: {outcome: "error", error: "match failure"}}
        switch(operation) {
            case OperationRequest.CACHE_PUT: {
                const payload = message.payload
                const key = cacheKey(payload.key)
                const value = payload.value.__value
                //24h
                const expiry = payload.expiry ?? new Date().getTime() + 86_400_000
                await store.set({[key]: {
                    expiry,
                    value
                }})
                result = {operation, result: {outcome: "success"}}
            }
            break
            case OperationRequest.CACHE_GET: {
                const payload = message.payload
                const now = new Date().getTime()
                const key = cacheKey(payload.key)
                const stored = (await store.get({
                    [key]: null
                }) as {[key:string]: null|{expiry: number, value: string}})[key]
                if(stored === null) {
                    result = {operation, result: {outcome: "not_found"}}
                } else if (stored.expiry < now){
                    result = {operation, result: {outcome: "not_found"}}
                    store.remove(key)
                } else {
                    result = {operation, result: {outcome: "success", value: {
                        __type: "buffer",
                        __value: stored.value
                    }}}
                }
            }
            break
            case OperationRequest.CACHE_CLEAR: {
                await navigator.locks.request(CACHE_LOCK, async () => {
                    const everything = await store.get(null)
                    const allCacheKeys = []
                    for(const key of Object.keys(everything)) {
                        if(key.startsWith("CACHE.")) {
                            allCacheKeys.push(key)
                        }
                    }
                    await store.remove(allCacheKeys)
                    result = {operation, result: {outcome: "success"}}
                })
            }
            break
            case OperationRequest.CACHE_CLEAN: {
                await navigator.locks.request(CACHE_LOCK, async () => {
                    const everything = await store.get(null)
                    const now = new Date().getTime()
                    const expiredCacheKeys = []
                    for(const [key, val] of Object.entries<{expiry: number, value: string}>(everything)) {
                        if(key.startsWith("CACHE.")) {
                            if(val.expiry < now) {
                                expiredCacheKeys.push(key)
                            }
                        }
                    }
                    await store.remove(expiredCacheKeys)
                    result = {operation, result: {outcome: "success"}}
                })
            }
            break
            case OperationRequest.SETTINGS: {
                const readSettings: Partial<PolycentricAppSettings> = {}
                const writeSettings: {[key: string]: any} = {}
                const requests = Object.entries(message.payload) as ({[key in keyof PolycentricAppSettings] : [key, null|PolycentricAppSettings[key]]}[keyof PolycentricAppSettings])[]
                for(const [keyText,val] of requests) {
                    const key = settingsKey(keyText)
                    if(val === null || val === undefined) {
                        readSettings[keyText] = (await store.get({[key]: defaultSettings[keyText]}))[key]
                    } else {
                        writeSettings[key] = val
                    }
                }
                //no lock needed because store.get isn't used to populate writeSettings
                await store.set(writeSettings)
                result = {operation, result: {outcome: "success", settings: readSettings}}
                
            }
            break
            case OperationRequest.GET_SERVERS: {
                result = {operation, result: {outcome: "success", servers: await getServers()}}
            }
            break
            case OperationRequest.REMOVE_SERVER: {
                const permissionsUrl = message.payload.server.endsWith("/") ? message.payload.server.substring(0, message.payload.server.length-1) : message.payload.server

                await navigator.locks.request(SERVER_LIST_LOCK, async () => {
                    const servers = await getServers()
                    if(servers.length < 2) {
                        result = {operation, result: {outcome: "error", error: "cannot remove all servers"}}
                    } else if(!servers.includes(permissionsUrl)) {
                        result = {operation, result: {outcome: "error", error: "cannot delete nonregistered server"}}
                    } else {
                        await store.set({servers: servers.filter((server) => server !== permissionsUrl)})
                        result = {operation, result: {outcome: "success"}}
                    }
                })
            }
            break
            case OperationRequest.ADD_SERVER: {
                const permissionsUrl = message.payload.server.endsWith("/") ? message.payload.server.substring(0, message.payload.server.length-1) : message.payload.server
                await navigator.locks.request(SERVER_LIST_LOCK, async () => {
                    const servers = await getServers()
                    if(!servers.includes(permissionsUrl)) {
                        servers.push(permissionsUrl)
                        await store.set({servers})
                    }
                })
                result = {operation, result: {outcome: "success"}}
            }
            break
            case OperationRequest.DERIVE_PUBLIC: {
                result = {operation: operation, result: {
                    publicKey: serializeBufferObject(await derivePublicKey(deserializeBufferObject(message.payload.privateKey))),
                    outcome: "success"
                }}
            }
            break
            case OperationRequest.INC: {
                console.log("incrementing to get")
                console.log(message.payload + 1)
                result = {operation: operation, result: message.payload + 1}
            }
            break
            case OperationRequest.SYNC: {
                const {historyCount, server} = message.payload
                const data = await getStore()
                const processEvents = (data.myProcessEvents ?? []).map(decodeUInt8Array)
                const events = processEvents.slice(-historyCount).map((buffer) => decodeSignedEvent(buffer))

                // TODO: only returned the servers which with syncing was successful
                result = {operation: operation, result: {server: server}}
            }
            break
            case OperationRequest.GET_STATE: {
                const data = await getStore()
                result = {operation: operation, result: data.saved ? {outcome: "success", system: serializeBufferObject(PostHead.fromJSON(data.writeHead!).system)} : {outcome: "error", error: "not logged in"}}
            }
            break
            case OperationRequest.SIGN_IN: {
                const payload: Decoded<typeof message.payload> = deserializeBufferObject(message.payload)
                await navigator.locks.request(POST_LOCK, async () => {
                    const data = await getStore()
                    try {
                        const privateKey = payload.key
                        const publicKey = await derivePublicKey(privateKey)
                        const { saved, writeHead, myProcessEvents, otherUsers } = data
                        const publicKeyString:string = base64FromBytes(publicKey.key)
                        let currentUserPublicKeyString = ""
                        if(saved && writeHead) {
                            const realWriteHead = PostHead.fromJSON(writeHead)
                            currentUserPublicKeyString = base64FromBytes(realWriteHead.system.key)
                        }
                        if(publicKeyString === currentUserPublicKeyString) {
                            result = {operation: operation, result: {outcome: "error", error: "already signed in as that user"}}
                            return
                        }
                        if(otherUsers[publicKeyString]) {
                            otherUsers[currentUserPublicKeyString] = {
                                saved,
                                writeHead,
                                myProcessEvents,
                            }
                            await store.set({
                                saved: otherUsers[publicKeyString].saved,
                                writeHead: otherUsers[publicKeyString].writeHead,
                                myProcessEvents: otherUsers[publicKeyString].myProcessEvents,
                                otherUsers
                            })
                        } else {
                            let {process} = payload
                            if(process === null) {
                                process = {
                                    process: noble.randomPrivateKey().slice(0, 16)
                                }
                            }
                            const utils = new PolycentricUtils()
                            utils.getServers = getServers
                            const {head, event} = await timeLimit(utils.findOrCreatePostHead.bind(utils))(publicKey, privateKey, process)
                            const storageEntry = {
                                saved: true,
                                writeHead: head.toJSON(),
                                myProcessEvents: event.map(event => encodeUInt8Array(encodeSignedEvent(event))),
                            }
                            const otherUsers = data.otherUsers
                            otherUsers[publicKeyString] = storageEntry
                            await store.set({
                                ...storageEntry,
                                otherUsers
                            })
    
                        }
                        result = {operation: operation, result: {outcome: "success", system: serializeBufferObject(publicKey)}}
                    } catch (e) {
                        console.error("error while signing in", e)
                        result = {operation: operation, result: {outcome: "error", error: (e as Error).message}}
                    }
                })
            }
            break
            case OperationRequest.SIGN_OUT: {
                const payload: Decoded<typeof message.payload> = deserializeBufferObject(message.payload)
                await navigator.locks.request(POST_LOCK, async () => {
                    const data = await getStore()
                    try {
                        const { saved, writeHead, myProcessEvents, otherUsers } = data
                        if(saved) {
                            const realWriteHead = PostHead.fromJSON(writeHead!)
                            const currentUserPublicKeyString = base64FromBytes(realWriteHead.system.key)
                            otherUsers[currentUserPublicKeyString] = {
                                saved,
                                writeHead,
                                myProcessEvents,
                            }
                            await store.set({
                                saved: false,
                                writeHead: null,
                                myProcessEvents: null,
                                otherUsers
                            })
                        }
                        result = {operation: operation, result: {outcome: "success"}}
                    } catch (e) {
                        console.error("error while signing out", e)
                        result = {operation: operation, result: {outcome: "error", error: (e as Error).message}}
                    }
                })
            }
            break
            case OperationRequest.POST: {
                const payload: Decoded<typeof message.payload> = deserializeBufferObject(message.payload)
                await navigator.locks.request(POST_LOCK, async () => {
                    const data = await getStore()
                    if(!data.writeHead || !data.saved || !data.myProcessEvents) {
                        console.error("error while creating post", "Not logged in")
                        result = {operation: operation, result: {outcome: "error", error: "Not logged in"}}
                    }
                    try {
                        const head = PostHead.fromJSON(data.writeHead!)
                        head.utils.getServers = getServers
                        const signedEvent = await head.createSignedPostEvent(payload.content, payload.references, payload.image)
                        const encodedSignedEvent = encodeSignedEvent(signedEvent)
                        await store.set({
                            writeHead: head.toJSON(),
                            myProcessEvents: [...data.myProcessEvents!, encodeUInt8Array(encodedSignedEvent)]
                        })
                        const results = await timeLimit(head.utils.send.bind(head.utils))(signedEvent)
                        results.forEach(e => {
                            if(!e.success) {
                                console.warn(`${e.server} failed to process post event`)
                            }
                        })
                        result = {operation: operation, result: {outcome: "success", event: serializeBufferObject(decodeEvent(signedEvent.event))}}
                    } catch (e) {
                        console.error("error while posting", e)
                        result = {operation: operation, result: {outcome: "error", error: (e as Error).message}}
                    }
                })
            }
            break
        }
        console.log(result)
        return result
    })

    asyncHandle().then(sendResponse)
    return true
}

browser.runtime.onMessage.addListener(handler);