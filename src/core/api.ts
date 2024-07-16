import {
    decodeQueryIndexResponse,
    decodeQueryReferencesResponse,
    decodeRangesForSystem,
    decodeSignedEvents,
    encodeNumbers,
    encodeQueryReferencesRequest,
    encodeRangesForSystem,
    encodeSignedEvents,
    encodeSystem,
    PublicKeyType,
    QueryIndexResponseType,
    QueryReferencesRequestCountLWWElementReferencesType,
    QueryReferencesRequestCountReferencesType,
    QueryReferencesRequestEventsType,
    QueryReferencesRequestType,
    QueryReferencesResponseType,
    RangesForSystemType,
    ReferenceType,
    SignedEventsType,
    SignedEventType
} from "../protobufs";
import * as Base64 from '@borderless/base64';

const userAgent = 'polycentric-anywhere-v1'

async function doFetch(...args: Parameters<typeof fetch>) {
    const response = await fetch(...args)
    if(!response.ok)
        throw new Error(`[err ${response.status}]: ${response.statusText}`)
    return response
}

type RecursivePartial<T> = T extends null|undefined|number|string|boolean ? T : T extends Uint8Array ? Uint8Array : T extends (infer U)[] ? (U[]) : T extends object ? {[key in keyof T] : RecursivePartial<T[key]>|undefined} : never

async function fetchAndDecode<T>(decoder: (arg: Uint8Array) => T, url: string, args: RequestInit & {headers?: {[key:string]: string}}): Promise<RecursivePartial<T>> {
    if(!args.headers) {
        args.headers = {}
    }
    if(!args.headers['x-polycentric-user-agent']) {
        args.headers['x-polycentric-user-agent'] = userAgent
    }
    const resp = await doFetch(url, args)
    return decoder(new Uint8Array(await resp.arrayBuffer())) as RecursivePartial<T>
}


export async function postEvents(
    server: string,
    events: SignedEventType[],
): Promise<void> {
    const response = await doFetch(server + '/events', {
        method: 'POST',
        body: encodeSignedEvents({
            events: events,
        }),
    })
}

export async function getRanges(
    server: string,
    system: PublicKeyType,
): Promise<RecursivePartial<RangesForSystemType>> {
    const systemQuery = Base64.encodeUrl(
        encodeSystem(system),
    )

    return fetchAndDecode(decodeRangesForSystem, `${server}/ranges?system=${systemQuery}`, {
        method: 'GET',
    })
}

export async function getEvents(
    server: string,
    system: PublicKeyType,
    ranges: RangesForSystemType,
): Promise<RecursivePartial<SignedEventsType>> {
    const systemQuery = Base64.encodeUrl(
        encodeSystem(system),
    )

    const rangesQuery = Base64.encodeUrl(
        encodeRangesForSystem(ranges),
    )

    return fetchAndDecode(decodeSignedEvents, `${server}/events?system=${systemQuery}&ranges=${rangesQuery}`, {
        method: 'GET',
    })
}

export async function getQueryLatest(
    server: string,
    system: PublicKeyType,
    eventTypes: bigint[],
): Promise<RecursivePartial<SignedEventsType>> {
    const systemQuery = Base64.encodeUrl(
        encodeSystem(system),
    )

    const eventTypesQuery = Base64.encodeUrl(
        encodeNumbers({
            numbers: eventTypes,
        }),
    )

    return fetchAndDecode(decodeSignedEvents, `${server}/query_latest?system=${systemQuery}&event_types=${eventTypesQuery}`, {
        method: 'GET',
    })
}

export async function getQueryIndex(
    server: string,
    system: PublicKeyType,
    contentType: bigint,
    after?: bigint,
    limit?: bigint,
): Promise<RecursivePartial<QueryIndexResponseType>> {
    const systemQuery = Base64.encodeUrl(
        encodeSystem(system),
    )

    const path =
        `${server}/query_index?system=${systemQuery}&content_type=${Number(contentType).toString()}` +
        (after ? `&after=${Number(after).toString()}` : '') +
        (limit ? `&limit=${Number(limit).toString()}` : '')

    return fetchAndDecode(decodeQueryIndexResponse, server + path, {
        method: 'GET',
    })
}

export async function getQueryReferences(
    server: string,
    reference: ReferenceType,
    cursor?: Uint8Array,
    requestEvents?: QueryReferencesRequestEventsType,
    countLwwElementReferences?: QueryReferencesRequestCountLWWElementReferencesType[],
    countReferences?: QueryReferencesRequestCountReferencesType[],
    extraByteReferences?: Uint8Array[],
): Promise<RecursivePartial<QueryReferencesResponseType>> {
    const query: Partial<QueryReferencesRequestType> = {
        reference: reference,
        cursor: cursor,
        requestEvents: requestEvents,
        countLwwElementReferences: countLwwElementReferences ?? [],
        countReferences: countReferences ?? [],
        extraByteReferences: extraByteReferences ?? [],
    }

    const encodedQuery = Base64.encodeUrl(
        encodeQueryReferencesRequest(query)
    )    
    
    return fetchAndDecode(decodeQueryReferencesResponse, `${server}/query_references?query=${encodedQuery}`, {
        method: 'GET',
    })
}

export async function getHead(
    server: string,
    system: PublicKeyType,
): Promise<RecursivePartial<SignedEventsType>> {
    const systemQuery = Base64.encodeUrl(
        encodeSystem(system),
    )

    return fetchAndDecode(decodeSignedEvents, `${server}/head?system=${systemQuery}`, {
        method: 'GET',
    })
}
