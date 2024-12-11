import * as React from "react"
import { base64FromBytes, bytesToHexString, UTF8Decoder } from "../core/Util"
import { ContentType, EventType, decodePost, decodeSystemProcesses } from "../protobufs"
import { AsyncComponentSingleton, PolycentricUtils } from "../barrel"

export interface PostProps {
    event: EventType
    utils: PolycentricUtils
}

const Timestamp = (props: {time: bigint | undefined}): React.ReactElement => {
    if(props.time === undefined) {
        return <>{"[]"}</>
    }
    return <div className="timestamp">{" @ ["+(new Date(Number(props.time)).toString().split(" ").slice(0,5).join(" "))+"]"}</div>
}

const imageFormatWhitelist = Object.freeze(["image/png", "image/jpeg", "image/jpg", "image/webp"])

export const Post:React.FC<PostProps> = (props:PostProps) => {
    const {utils, event} = props
    return <tr>
        <td style={{padding: "10px", verticalAlign: "middle"}}>
            <AsyncComponentSingleton promise={() => utils.systemToAvatar({system: event.system, resolution:[128n,128n]})} fallback={() => <>[?]</>}>
                {(avatars) => {
                    if(avatars && avatars.length && imageFormatWhitelist.includes(avatars[0].mimeType)) {
                        const avatar = avatars[0]
                        return <img className="avatar" src={`data:${avatar.mimeType};base64,${base64FromBytes(avatar.blob)}`}/>
                    } else {
                        return <>[?]</>
                    }
                }}
            </AsyncComponentSingleton>
        </td>
        <td style={{padding: "10px", verticalAlign: "middle"}}>
            <div style={{display: "flex", flexDirection: "column"}}>
                <div style={{display: "flex", flexDirection: "row"}}>
                    <AsyncComponentSingleton promise={() => utils.systemToUsername(event.system)} fallback={() => <>...</>}>
                        {(name) => <div className="username">{name}</div>}
                    </AsyncComponentSingleton>
                    <Timestamp time={event.unixMilliseconds} />
                </div>
            {contentDecode(event.contentType, event.content)}
            </div>
        </td>
    </tr>
}

export function contentDecode(contentType: bigint, content: Uint8Array) {
    const decoder = UTF8Decoder
    return ({
        [ContentType.Post.toString()]:
            (text: Uint8Array) => decoder.decode(decodePost(text).content),
        [ContentType.SystemProcesses.toString()]:
            (procBuffer: Uint8Array) => decodeSystemProcesses(procBuffer).processes.map((proc) => <>
                <br />
                {bytesToHexString(proc.process)}
            </>)
    }[contentType.toString()] ?? decoder.decode.bind(decoder))(content)
}