import * as API from "./Api"
import { bytesToHexString, cache, extensionCache, flattenUint8Arrays, UTF8Decoder, UTF8Encoder } from "./Util";
import {
    ContentType,
    decodeDecodedImages,
    decodeEvent,
    decodeImageBundle,
    decodeSystemProcesses,
    deserializeBufferObject,
    digestsAreEqual,
    encodeDecodedImages,
    encodeEvent,
    encodePointer,
    encodePost,
    encodeSystemProcesses,
    EventType,
    ImageManifestType,
    IndexType,
    indicesPattern,
    IndicesType,
    PointerType,
    PrivateKeyType,
    processPattern,
    ProcessType,
    prototypeToProtobufDecoder,
    prototypeToProtobufEncoder,
    publicKeyPattern,
    PublicKeyType,
    RangesForSystemType,
    ReferenceType,
    serializeBufferObject,
    signedEventToPointer,
    SignedEventType,
    SystemType,
    vectorClockPattern,
    VectorClockType
} from "../protobufs";
import {signAsync, getPublicKeyAsync, verifyAsync} from "@noble/ed25519"
import { extensionInvoke, OperationRequest } from "../background/Core";

function sortByDescendingTime(events: EventType[]): void {
    events.sort((event1, event2) => {
        //return in descending order
        //default to real time
        if(event1.unixMilliseconds !==undefined && event2.unixMilliseconds !== undefined) {
            return Number(event2.unixMilliseconds - event1.unixMilliseconds)
        }
        //if real time is missing, break ties with logical clocks
        return Number(event2.logicalClock - event1.logicalClock)
    })
}

async function onlyFulfilled<T>(promises: Promise<T>[]): Promise<T[]> {
    const settled = await Promise.allSettled(promises)
    const results:T[] = []
    for(const result of settled) {
        if(result.status === "fulfilled") {
            results.push(result.value)
        }
    }
    return results
}

export async function derivePublicKey(privateKey: PrivateKeyType): Promise<PublicKeyType> {
    return {
        keyType: privateKey.keyType,
        key: await getPublicKeyAsync(privateKey.key),
    }
}

const postHeadPattern = {
    system: publicKeyPattern,
    process: processPattern,
    logicalClock: 0,
    vectorClock: vectorClockPattern,
    processes: [processPattern],
    privateKey: publicKeyPattern,
    indices: indicesPattern
} as const

export class PostHead {

    /**
     * Creates a post head for consistently creating new events and posting them.
     * @param utils A PolycentricUtils instance constructed with the `system`'s private key, and the same process as `process`
     * @param system The public key of the system creating posts.
     * @param process The process to post under
     * @param logicalClock The logicalClock of the next post to be made
     * @param vectorClock The vectorClock keeping track of other processes
     * @param processes The other processes tracked by the vectorClock
     * @param privateKey The `system`'s private key. Should be the same as that coming from `utils`
     * @param indices References to the `logicalClock` of some previous events.
     */
    constructor(
        readonly utils: PolycentricUtils,
        readonly system: PublicKeyType,// The public key of the system this can post to
        public process: ProcessType,// The process this can post to
        public logicalClock: bigint, // The logical clock of the next event to be posted
        public vectorClock: VectorClockType,// The logicalClock of the last known event from the corresponding process in the processes array
        public processes: ProcessType[],// The list of processes tracked in the vector clock
        public privateKey: PrivateKeyType,// The private key of the system this can post to
        public indices: IndicesType// Backreferences
    ) {}

    public toJSON() {
        const [encoder] = prototypeToProtobufEncoder(postHeadPattern)
        return {
            encoded: [...encoder(this)]
        }
    }

    public static fromJSON(obj: ReturnType<PostHead["toJSON"]>):PostHead {
        const decoder = prototypeToProtobufDecoder(postHeadPattern)
        const decoded = decoder(new Uint8Array(obj.encoded))
        return new PostHead(
            new PolycentricUtils(),
            decoded.system,
            decoded.process,
            decoded.logicalClock,
            decoded.vectorClock,
            decoded.processes,
            decoded.privateKey,
            decoded.indices
        )
    }

    /**
     * Creates and signs a Post event
     * @param content The text content
     * @param references Optional: A list of references, either to a blob (like a url), or to another event, or to nothing for general posts.
     * @param image Optional: an image to include in the post.
     * @returns The assigned event
     * 
     * the event is a signed event that can be posted using `utils.send` or `API.postEvents`. 
     */
    public async createSignedPostEvent(content: string, references?: ReferenceType[], image?: ImageManifestType): Promise<SignedEventType> {

        const event: Partial<EventType> = {
            system: this.system,
            process: this.process,
            logicalClock: this.logicalClock,
            contentType: ContentType.Post,
            content: encodePost({
                content: UTF8Encoder.encode(content),
                image: image!,
            }),
            vectorClock: this.vectorClock,
            indices: this.indices,
            references: references ?? [],
            unixMilliseconds: BigInt(new Date().getTime()),
        }

        const oldIndices = (this.indices?.indices ?? [])
        const newIndices = oldIndices.map(index => index.indexType.toString() === ContentType.Post.toString() ? ({...index, logicalClock: event.logicalClock!}) : ({...index}))
        this.indices = ({indices: newIndices})
        this.logicalClock = this.logicalClock + BigInt(1)
        const encodedEvent = encodeEvent(event)
        const signature = await signAsync(encodedEvent, this.privateKey.key)
        return {
            signature: signature,
            event: encodedEvent
        }
    }

    public toString(): string {
        return JSON.stringify({
            logicalClock: this.logicalClock.toString(),
            vectorClock: JSON.stringify(this.vectorClock?.logicalClocks?.map(clock => clock.toString()) ?? []),
            processes: this.processes.map(proc => bytesToHexString(proc.process)).join(","),
            system: bytesToHexString(this.system.key),
            privateKey: "[redacted]",
            indices: "["+(this.indices?.indices?.map(ind => `{indexType:${ind.indexType.toString()}, logicalClock:${ind.logicalClock.toString()}}`)?.join(",") ?? "")+"]" 
        })
    }
}

export class PolycentricUtils {

    /**
     * Posts the given event to all servers
     * @param event the SignedEvent to post
     * @returns an list of results objects containing `{server, success, error}`.For each result, `server` is the server that handled that post, `success` is whether the post to that server was successful, and `error` is the reason if the post was unsuccessful.
     */
    public async send(event: SignedEventType): Promise<({readonly server: string,readonly  success: true,readonly  error: undefined}|{readonly server:string, readonly success:false,readonly  error:any})[]> {
        const serverPromises = (await this.getServers()).map(server => API.postEvents(server, [event])
            .then(() => ({server, success: true, error: undefined} as const))
            .catch((e) => ({server, success: false, error: e} as const)))
        return await Promise.all(serverPromises);
    }

    public async getServers(): Promise<string[]> {
        const {result} = await extensionInvoke({operation: OperationRequest.GET_SERVERS, payload: {}})
        if(result.outcome === "success" && result.servers.length) {
            return result.servers
        } else {
            return ["https://srv1-prod.polycentric.io"]
        }
    }

    /**
     * Signs the given event with the system's private key
     * @param event The event to sign
     * @returns The signed event
     */
    public async sign(privateKey:PrivateKeyType, event: Partial<EventType>): Promise<SignedEventType> {
        const encodedEvent = encodeEvent(event)
        const signature = await signAsync(encodedEvent, privateKey.key)
        return {
            event: encodedEvent,
            signature
        }
    }

    public async discoverProcesses(system:PublicKeyType): Promise<ProcessType[]> {
        const heads = await this.getHeadEvents(system)
        const results = new Set<string>()
        for(const head of heads) {
            results.add(JSON.stringify(serializeBufferObject(head.process)))
            if(head.contentType === ContentType.SystemProcesses) {
                const processes = decodeSystemProcesses(head.content).processes
                processes.forEach(process => results.add(JSON.stringify(serializeBufferObject(process))));
            }
        }
        return [...results].map(str => deserializeBufferObject<ProcessType>(JSON.parse(str)))
    }

    /**
     * Creates a post head that the system & process this util object was created with can use to create new Events.
     * Using this function puts implicit trust in the servers the util object was contstructed with to provide the most up-to-date process state.
     * Using this function with all untrustworthy servers may lead to strict ordering violations and failure to reconcile events.
     * If any of the servers is known to be both trustworthy and up-to-date, this will succeed, so adding a self-managed server before using this is recommended.
     * If you are using local storage or another storage method to maintain process state, do not use this function.
     * Also note that it is not safe to create multiple PostHead objects for the same process and use them concurrently.
     * @returns A PostHead object that can be used to create new posts. 
     */
    public async findOrCreatePostHead(system:PublicKeyType, privateKey:PrivateKeyType, systemProcess:ProcessType): Promise<{head: PostHead, event:SignedEventType[]}> {
        const heads = await this.getHeadEvents(system)
        // We can create a list of known processes by scanning heads
        const knownProcesses = new Set<string>()


        const indexObj:Record<string, IndexType|undefined> = {}

        for(const head of heads) {
            const comparable: string = head.process.process.toString()
            knownProcesses.add(comparable)
            //the relevant indices for posts are SystemProcesses, Servers, Post, Username, Avatar.
            //we can borrow indices from previous messages, or create anew if necessary
            const indexKey_ = head.contentType.toString()
            const indexValue_ = {
                indexType: head.contentType,
                logicalClock: head.logicalClock
            }

            const headIndices = head.indices.indices.map((index) => (
                {
                    indexKey: index.indexType.toString(),
                    indexValue: index
                }
            ))

            for(const {indexKey, indexValue} of [...headIndices, {indexKey: indexKey_, indexValue: indexValue_}]) {
                const existingIndex = indexObj[indexKey]
                switch(indexKey) {
                    case ContentType.Avatar.toString():
                    case ContentType.Username.toString():
                    case ContentType.Server.toString():
                    case ContentType.Post.toString():
                        if((!existingIndex) || existingIndex.logicalClock < head.logicalClock) {
                            indexObj[indexKey] = indexValue
                        }
                        break;
                    //SystemProcesses we have to be a bit more careful with. Only reference it if it's a SystemProcesses message from this process.
                    case ContentType.SystemProcesses.toString():
                        if(head.process.process.toString() === systemProcess.process.toString() && ((!existingIndex) || existingIndex.logicalClock < head.logicalClock)) {
                            indexObj[indexKey] = indexValue
                        }
                        break;
                }
            }
            
        }
        const writeIndices = Object.values(indexObj) as IndexType[]
        const createSystemProcessesEvent = async () => {
            const pairs:Record<string, {
                process: ProcessType,
                clock: bigint
            }> = {}

            let logicalClock = 0n
            const indices:IndexType[] = []
            for(const head of heads) {
                const comparable: string = head.process.process.toString()
                if(head.logicalClock > logicalClock) {
                    
                    const index = {indexType: 2n, logicalClock: head.logicalClock}
                    if(head.contentType === ContentType.SystemProcesses) {
                        if(indices.length) {
                            indices[0] = index
                        } else {
                            indices.push(index)
                        }
                    }
                    logicalClock = head.logicalClock
                }
                if((head.process.process.toString() !== systemProcess.process.toString() && pairs[comparable] && head.logicalClock > pairs[comparable].clock) || !(pairs[comparable])) {
                    pairs[comparable] = {
                        process: head.process,
                        clock: head.logicalClock
                    }
                }
            }
            logicalClock = logicalClock + 1n
            const dedupedElems = Object.values(pairs)
            const content = encodeSystemProcesses({processes: dedupedElems.map((elem) => elem.process)})
            const vectorClock = {logicalClocks: dedupedElems.map((elem) => elem.clock)}
            const processes = dedupedElems.map((elem) => elem.process)
            const event: Partial<EventType> = {
                system: system,
                process: systemProcess,
                logicalClock,
                contentType: ContentType.SystemProcesses,
                content,
                vectorClock,
                indices: {indices},
                references: [],
                unixMilliseconds: BigInt(new Date().getTime())
            }
            return [await this.sign(privateKey, event), event, processes] as const
        }

        // Check if the server is aware of this process
        let lastSystemMessage: EventType|undefined;
        if(knownProcesses.delete(systemProcess.process.toString()) && undefined !== (lastSystemMessage = heads.find((head) => head.contentType === ContentType.SystemProcesses && head.process.process.toString() === systemProcess.process.toString()))) {
            // Check our last system processes message to see if we know about all these processes already
            const lastSystemMessageKnownProcesses = decodeSystemProcesses(lastSystemMessage.content).processes
            const lastSystemMessageKnownCounts = [...lastSystemMessage.vectorClock.logicalClocks]
            const lastSystemMessageKnownProcessStrings = new Set(lastSystemMessageKnownProcesses.map((process) => process.process.toString()))

            let allProcessesKnown = true
            const addedEvents:Partial<EventType>[] = []
            allProcessesKnown &&= [...knownProcesses].every((knownProcess) => lastSystemMessageKnownProcessStrings.has(knownProcess))
            if(![...lastSystemMessageKnownProcessStrings].every((knownProcess) => knownProcesses.has(knownProcess))) {
                console.warn("Server seems to be hiding known processes:", [...lastSystemMessageKnownProcessStrings].filter((knownProcess) => !knownProcesses.has(knownProcess)))
            }
            if(!allProcessesKnown) {
                console.log("our last system message does not contain some known processes. Sending update.", [...knownProcesses].filter((knownProcess) => !lastSystemMessageKnownProcessStrings.has(knownProcess)))
                const [message, event, processes] = await createSystemProcessesEvent()
                addedEvents.push(event)
                //await Promise.allSettled(this.servers().map((server) => API.postEvents(server, [message])))
            }
            //we don't need to send a systemProcesses message to update our vector clock, but we do need to keep the vector clock ordering consistent & the clock itself up to date.
            let maxClock = 0n
            for(const head of [...heads, ...addedEvents]) {
                const messageClock: bigint = head.logicalClock!

                if(messageClock > maxClock) {
                    maxClock = messageClock
                }
                if(head.process?.process.toString() === systemProcess.process.toString()) {
                    continue
                }
                const vectorClockIndex = lastSystemMessageKnownProcesses.findIndex((process) => process.process.toString() === head.process!.process.toString())
                
                const lastVal: bigint = lastSystemMessageKnownCounts[vectorClockIndex]
                if(messageClock > lastVal) {
                    lastSystemMessageKnownCounts[vectorClockIndex] = messageClock
                }
            }
            const postVectorClock = {logicalClocks: lastSystemMessageKnownCounts}

            return {
                head: new PostHead(this, system, systemProcess, maxClock + 1n, postVectorClock, lastSystemMessageKnownProcesses, privateKey, {indices: writeIndices}),
                event: []
            }
        } else {
            console.log("Process list is not synchronized. sending update now")
            const [message, event, processes] = await createSystemProcessesEvent()
            await Promise.allSettled((await this.getServers()).map((server) => API.postEvents(server, [message])))
            return {
                head: new PostHead(this, system, systemProcess, event.logicalClock! + 1n, event.vectorClock!, processes, privateKey, {indices: writeIndices}),
                event: [message]
            }
        }
    }

    /**
     * Takes a signed event, verifies its signature, and transforms it into a EventType
     * @param signedEvent 
     * @param blame The server that provided the event. This function prints a warning to the console blaming this server if any checks fail.
     * @returns the unwrapped event, or `undefined` if any of the checks fail
     */
    private async unwrapSignedEventUnknownSystem(signedEvent: SignedEventType, blame?:string): Promise<EventType | undefined> {
        const unwrapped = decodeEvent(signedEvent.event)
        if(!await verifyAsync(signedEvent.signature, signedEvent.event, unwrapped.system.key)) {
            console.warn(`Message tampering detected in event for ${JSON.stringify({
                system: bytesToHexString(unwrapped.system.key),
                ...(
                    blame? {server: blame} : {}
                )
            })}`)
            return undefined
        }
        return unwrapped
    }

    /**
     * Takes a signed event, verifies its signature, verifies that the system passed in is the system expected, and transforms it into a EventType
     * @param system The system that the signedEvent is expected to belong to
     * @param signedEvent The signed event
     * @param blame The server that provided the event. This function prints a warning to the console blaming this server if any checks fail.
     * @returns the unwrapped event, or `undefined` if any of the checks fail
     */
    private async unwrapSignedEvent(system:PublicKeyType, signedEvent: SignedEventType, blame?:string): Promise<EventType | undefined> {
        if(!await verifyAsync(signedEvent.signature, signedEvent.event, system.key)) {
            console.warn(`Message tampering detected in event for ${JSON.stringify({
                system: bytesToHexString(system.key),
                ...(
                    blame? {server: blame} : {}
                )
            })}`)
            return undefined
        }
        return decodeEvent(signedEvent.event)
    }

    /**
     * Consolidates getHead API calls from known servers for the given system. An attempt is made to sort the resulting list in reverse chronological order.
     * @param system The system to query for
     * @returns The list of head events
     */
    public async getHeadEvents(system: PublicKeyType): Promise<EventType[]> {
        const serverResponse = async (server: string) => ({
            server: server,
            response: await API.getHead(server, system)
        })
        const heads = await onlyFulfilled((await this.getServers()).map(serverResponse))
        
        const signedEvents = heads.flatMap((heads) => 
            heads?.response?.events?.map(event => ({
                untrustworthy: event,
                server: heads.server
            })) ?? []
        )
        const events: EventType[] = (await Promise.all(signedEvents.map(async (signedEvent) => {
            return await this.unwrapSignedEvent(system, signedEvent.untrustworthy, signedEvent.server)
        }))).filter((e): e is EventType => e !== undefined)
        
        sortByDescendingTime(events)
        return events
    }

    private publicKeyToString(system: PublicKeyType) {
        return bytesToHexString(system.key)
    }

    /**
     * Takes an event pointer and searches for the event referenced therein
     * @param pointer A pointer to an event
     * @returns The event content that the pointer refers to
     */
    public async derefPointerEvent(pointer: PointerType): Promise<EventType | undefined> {
        const {eventDigest, system, logicalClock, process} = pointer
        const rangesForSystem: RangesForSystemType = {
            rangesForProcesses:[{
                process: process,
                ranges: [
                    {
                        low: logicalClock,
                        high: logicalClock
                    }
                ]
            }]
        }
        const events = await onlyFulfilled((await this.getServers()).map(async (server) => ({
            server: server,
            response: await API.getEvents(server, system, rangesForSystem)
        })))

        for(const response of events) {
            const eventsReturned = response.response.events ?? []
            if(eventsReturned.length > 1) {
                console.warn(response.server + " returned multiple events for a single pointer")
            }
        }
        
        const signedEvents = events.flatMap(events => (events.response.events ?? []).map(event => ({
            event: event,
            server: events.server
        })))

        const recreatedPointers = await Promise.all(signedEvents.map(async (event) => ({
            pointer: await signedEventToPointer(event.event),
            server: event.server,
            event: await this.unwrapSignedEvent(system, event.event, event.server)
        })))

        let results:EventType|undefined = undefined
        recreatedPointers.forEach((rcPointer) => {
            if(digestsAreEqual(rcPointer.pointer.eventDigest, eventDigest)) {
                results = rcPointer.event
            } else {
                console.warn(`Message tampering detected in event for ${JSON.stringify({
                    system: bytesToHexString(system.key),
                    eventNo: logicalClock.toString(),
                    server: rcPointer.server
                })}`)
            }
        })
        return results
    }

    private async queryEventsReferencing(ref:ReferenceType, contentType: bigint, limitCalls?: number, entriesPerPage?: number) {
        let queryResults = (await this.getServers()).map(async (server) => ({
            response: await API.getQueryReferences(server, ref, undefined, {
                fromType: contentType,
                countReferences: [],
                countLwwElementReferences: [],
            }),
            server: server
        }))

        if(limitCalls) {
            while(limitCalls > 1) {
                queryResults = queryResults.map(
                    async (previousQueryResponse) => {
                        const response = await previousQueryResponse
                        if(!response.response.cursor) {
                            return response
                        } else {
                            const nextResponse = await API.getQueryReferences(response.server, ref, response.response.cursor, {
                                fromType: contentType,
                                countReferences: [],
                                countLwwElementReferences: [],
                            })
                            return {
                                server: response.server,
                                response: {
                                    items: (response.response.items ?? []).concat(nextResponse.items ?? []),
                                    cursor: nextResponse.cursor,
                                    counts: (response.response.counts ?? []).concat(nextResponse.counts ?? []),
                                    relatedEvents: (response.response.relatedEvents ?? []).concat(nextResponse.relatedEvents ?? [])
                                }
                            }
                        }
                    }
                )
                limitCalls--;
            }
        }

        const finishedQueries = await onlyFulfilled(queryResults)
        const results = await Promise.all(finishedQueries.map(async (queryResponse) =>
            (await Promise.all((queryResponse.response.items ?? [])
                .map((item) => item.event)
                .filter((event): event is SignedEventType => event !== undefined)
                .map((event) => this.unwrapSignedEventUnknownSystem(event))))
                .filter((event): event is EventType => event !== undefined))
            
        )
        //we don't need duplicate results from different servers. just cross-verify and take as many as possible
        const reconciled:Record<string,EventType> = {}
        const key = (event:EventType) => (bytesToHexString(event.system.key)+":"+event.logicalClock.toString())
        for(const event of results.flat(1)) {
            reconciled[key(event)] = event
        }
        const events = Object.values(reconciled)
        events.sort((ev1, ev2) => {
            const t1 = ev1.unixMilliseconds ?? 0n
            const t2 = ev2.unixMilliseconds ?? 0n
            return Number(t1 - t2)
        })
        return events
    }

    /**
     * Finds the events referencing the given event pointer
     * @param pointer The event pointer being referenced
     * @param contentType Limits the content type to that specified
     * @param limitCalls Number of network calls to allow. 
     * @param entriesPerPage (unimplemented)
     * @returns The list of events referencing the event pointer.
     */
    public async queryReferencingPointer(pointer:PointerType, contentType:bigint, limitCalls?: number, entriesPerPage?: number) {
        const ref:ReferenceType = {
            referenceType: 2n,
            reference: encodePointer(pointer),
        };
        return this.queryEventsReferencing(ref, contentType, limitCalls, entriesPerPage)
    }

    /**
     * Finds the events referencing the given blob reference
     * @param blob The blob being referenced
     * @param contentType Limits the content type to that specified
     * @param limitCalls Number of network calls to allow.
     * @param entriesPerPage (unimplemented)
     * @returns The list of events referencing the blob.
     */
    public async queryReferencingBlob(blob: Uint8Array, contentType:bigint, limitCalls?: number, entriesPerPage?: number):Promise<EventType[]> {
        const ref: ReferenceType = {
            referenceType: 3n,
            reference: blob
        }
        return this.queryEventsReferencing(ref, contentType, limitCalls, entriesPerPage)
    }

    private async getAllAndUnwrap(generator: (server: string) => Promise<SignedEventType[]>, system?: SystemType) {
        const servers = await this.getServers()
        const events = await onlyFulfilled(servers.map(async (server) => ({
            response: await generator(server),
            server: server
        })))
        const signedEvents = events.flatMap(events => (events.response ?? []).map(event => ({
            event: event,
            server: events.server
        })))
        const unwrappedEvents = system
            ? await Promise.all(signedEvents.map((event) => this.unwrapSignedEvent(system, event.event, event.server)))
            : await Promise.all(signedEvents.map((event) => this.unwrapSignedEventUnknownSystem(event.event, event.server)))
        const verifiedEvents = unwrappedEvents.filter((event): event is EventType => event !== undefined)
        sortByDescendingTime(verifiedEvents)
        return verifiedEvents
    }

    public readonly systemToAvatar = extensionCache({
        func: async (payload:{system: SystemType, resolution?: [bigint, bigint]}) => {
            const servers = await this.getServers()
            const {system, resolution} = payload

            const verifiedEvents = await this.getAllAndUnwrap(async (server) => (await API.getQueryLatest(server, system, [ContentType.Avatar])).events ?? [], system)

            const element = verifiedEvents[0]?.lwwElement?.value
            if(!element) {
                return []
            }
            const decodedManifests = decodeImageBundle(element).imageManifests.filter(manifest => {
                if(resolution === undefined) {
                    return true
                }
                return (resolution[0] === manifest.width && resolution[1] === manifest.height)
            })
            decodedManifests.forEach(manifest => {
                const {mime, ...rest} = manifest
            })

            const rangesMap: RangesForSystemType = {
                rangesForProcesses: decodedManifests.map(({process, sections}) => ({process, ranges: sections}))
            }

            const verifiedBlobEvents = await this.getAllAndUnwrap(async (server) => (await API.getEvents(server, system, rangesMap)).events ?? [], system)

            function range(low:bigint, high:bigint): bigint[] {
                const retv = [] as bigint[]
                while(low <= high) {
                    retv.push(low)
                    low++
                }
                return retv
            }

            const stringify = (process:ProcessType, index:bigint) => `${bytesToHexString(process.process)}#${index.toString()}`
            const blobEventMap = {} as {[key: string]: Uint8Array}
            verifiedBlobEvents.forEach((event) => {
                blobEventMap[stringify(event.process, event.logicalClock)] = event.content
            })
            return decodedManifests.map(
                ({process, sections, byteCount, mime}) => {//byteCount is kinda unnecessary? 
                    const result = flattenUint8Arrays(sections.map(
                        (section) => range(section.low, section.high).map(
                            (index) => blobEventMap[stringify(process, index)]
                        )
                        ).flat(), Number(byteCount))
                    return {
                        mimeType: UTF8Decoder.decode(mime),
                        blob: result
                    }
                }
            )
        },
        stringifier: ({system, resolution}) => {
            return `${this.publicKeyToString(system)}#${resolution ? resolution[0].toString() + "," + resolution[1].toString() : "<null>"}`
        },
        resultEncoder: (inputs: {mimeType: string, blob: Uint8Array}[]) => {
            const images = inputs.map(input => ({blob: input.blob, mimeType: UTF8Encoder.encode(input.mimeType)}))
            return encodeDecodedImages({images})
        },
        resultRecover: (input: Uint8Array) => {
            const {images} = decodeDecodedImages(input)
            return images.map(decoded => ({blob: decoded.blob, mimeType: UTF8Decoder.decode(decoded.mimeType)}))
        }
    })

    /**
     * Takes a system' public key, and finds its likely username
     * @param system The system's public key
     * @returns The most recent username set by the system.
     */
    public readonly systemToUsername = cache(async (system: SystemType) => {
        const modelSystem = system
        const events = await onlyFulfilled((await this.getServers()).map(async (server) => ({
            response: await API.getQueryLatest(server, modelSystem, [ContentType.Username]),
            server: server
        })))
        const signedEvents = events.flatMap(events => (events.response.events ?? []).map(event => ({
            event: event,
            server: events.server
        })))
        const unwrappedEvents = await Promise.all(signedEvents.map((event) => this.unwrapSignedEvent(modelSystem, event.event, event.server))) 
        const verifiedEvents = unwrappedEvents.filter((event): event is EventType => event !== undefined)
        sortByDescendingTime(verifiedEvents)
        return UTF8Decoder.decode(verifiedEvents[0]?.lwwElement?.value ?? new Uint8Array()) || "<#unknown username#>"
    }, this.publicKeyToString)


}
