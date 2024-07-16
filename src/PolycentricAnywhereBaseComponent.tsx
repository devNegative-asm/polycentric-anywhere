import * as React from "react"
import {AsyncComponent, UTF8Encoder, PolycentricUtils, Post, PostInputBox, AsyncComponentSingleton, fixUrlToReference} from "./barrel"
import { extensionInvoke, OperationRequest } from "./background/core"
import App from "./App"
import { bufferToReference, ContentType, EventType } from "./protobufs"
interface PolycentricAnywhereProps {
    utils: PolycentricUtils
    dragger: React.ReactElement
}

export function PolycentricAnywhereBaseComponent(props:PolycentricAnywhereProps) {
    const urlRef = () => fixUrlToReference(window.location.toString())
    const urlBlob = () => UTF8Encoder.encode(urlRef())
    const utils = props.utils

    const [seqNo, setSeqNo] = React.useState(0)
    const [userPosts, setUserPosts] = React.useState<EventType[]>([])
    const [query, setQuery] = React.useState<Promise<EventType[]>>(Promise.resolve([]))
    const [serverText, setServerText] = React.useState("")
    const [servers, setServersState] = React.useState(() => utils.getServers())
    const dragger = props.dragger
    
    switch(seqNo) {
        case -1:
            return <div style={{flexDirection: "column", display: "flex"}}>
                {dragger}
                <div style={{flexDirection: "row", display: "flex", justifyContent: "space-between"}}>
                    <div>Settings</div>
                    <button onClick={() => setSeqNo(2)}>Back</button>
                </div>
                <AsyncComponentSingleton promise={() => extensionInvoke({operation: OperationRequest.GET_STATE, payload: {}})} >
                    {({result}) => 
                        result.outcome === "error" ? <div>Not signed in</div> :
                            <><div style={{paddingRight: "10px"}}>Account ID: {result.system.key.__value}</div>
                            <div>Sign out: <button onClick={() => {
                                setUserPosts([])
                                extensionInvoke({operation: OperationRequest.SIGN_OUT, payload: {}}).then(() => setSeqNo(0))
                            }}>👋</button></div></>
                    }
                </AsyncComponentSingleton>
                <div>Servers:</div>
                <AsyncComponent promise={servers} revertToLoadingOnUpdate={false}>
                    {(servers) => <>
                        {servers.map((server) => <div style={{flexDirection: "row", display: "flex"}}>
                            <button onClick={() => extensionInvoke({operation: OperationRequest.REMOVE_SERVER, payload: {server}}).then(() => setServersState(utils.getServers()))}>
                                ✖
                            </button>
                            <div>{server}</div>
                        </div>)}
                    </>}
                </AsyncComponent>
                <div style={{display: "flex", flexDirection: "row"}}>
                    <button onClick={async () => {
                        let err = "incorrect url format"
                        if(/https:\/\/.*/.test(serverText)) {
                            const result = await extensionInvoke({operation: OperationRequest.ADD_SERVER, payload: {server: serverText}})
                            if(result.result.outcome === "error") {
                                err = result.result.error
                            } else {
                                err = ""
                            }
                            setServerText("")
                        }
                        if(err) {
                            alert("Failed to add server: " + err)
                        } else {
                            setServerText("")
                        }
                        setServersState(utils.getServers())
                    }}>+</button>
                    <input type="text" key="polycentric-anywhere-input" id="polycentric-anywhere-input" value={serverText} onChange={(e) => {
                        setServerText(e.target.value)
                    }}/>
                </div>
            </div>
        case 0:
            return <div style={{flexDirection: "row", display: "flex", width:"55px"}}>
                <div>
                    <button type="button" onClick={() => {
                        setSeqNo(1)
                    }}>
                        ▶
                    </button>
                </div>
                {dragger}
            </div>
        case 1:
            return <div style={{display: "flex", flexDirection: "row"}}>
                <div style={{width: "50%"}}>
                    <button type="button" onClick={() => {
                        setSeqNo(2)
                        setQuery(utils.queryReferencingBlob(urlBlob(), ContentType.Post))
                    }}>
                        Show polycentric chat for
                        <br />{urlRef()}
                    </button>
                </div>
                {dragger}
            </div>
        case 2:
            return <div style={{top: 50, left: 50, width: "35vw", height: "35vh", display: "flex", flexDirection: "column"}}>
                <div id="polycentric-anywhere-controls" style={{display: "flex", flexDirection: "row"}}>
                    <button style={{marginRight: "15px"}} title="Close chat" onClick={() => setSeqNo(0)}>✖</button>
                    <button className="no_background" style={{marginRight: "15px"}} title="Reload chat" onClick={() => {
                        setUserPosts([])
                        setQuery(utils.queryReferencingBlob(urlBlob(), ContentType.Post))
                    }}>🔃</button>
                    {dragger}
                    <button className="no_background" title="Settings" onClick={async () => {
                        setSeqNo(-1)
                    }}>⚙</button>
                </div>
                <div style={{overflowY: "scroll", display: "flex", flexDirection: "column"}}>
                    <table>
                        <tbody>
                            <AsyncComponent promise={query}>
                                {(posts) => <>
                                    {posts.map(post => <Post event={post} utils={utils} />)}
                                </>}
                            </AsyncComponent>
                            {userPosts.map(post => <Post event={post} utils={utils}/>)}
                        </tbody>
                    </table>
                </div>
                <PostInputBox utils={utils} references={[
                    bufferToReference(urlBlob())
                ]} style={{flexDirection: "row", display: "flex", borderTop: "5px solid gray"}} 
                onPostError={window.alert}
                onPostFinished={(newEvent) => {
                    setUserPosts([...userPosts, newEvent])
                }}/>
            </div>
    }
}