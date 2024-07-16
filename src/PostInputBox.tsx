import * as React from "react"
import { PolycentricUtils } from "./core/PolycentricUtils"
import { Encoded, extensionInvoke, OperationRequest } from "./background/core"
import { AsyncComponent } from "./AsyncComponent"
import { deserializeBufferObject, EventType, PrivateKeyType, ProcessType, PublicKeyType, ReferenceType, serializeBufferObject, SystemType } from "./protobufs"
import { bytesToHexString, timeLimit, UTF8Decoder, UTF8Encoder } from "./barrel"


export interface PostInputBoxProps {
    utils: PolycentricUtils
    references?: ReferenceType[]
    onPostFinished(event: EventType): void
    onPostError(event: Error|string): void
}
export function PostInputBox<T extends PostInputBoxProps>(props: T & React.DetailedHTMLProps<React.HtmlHTMLAttributes<HTMLDivElement>, HTMLDivElement>) {
    const {utils, references, onPostFinished, onPostError, ...otherProps} = props
    const [content, setContent] = React.useState<string>("")
    const [privateKey, setPrivateKey] = React.useState<PrivateKeyType|undefined>()
    const [signedInPromise, setSignedInPromise] = React.useState(() => extensionInvoke({operation: OperationRequest.GET_STATE, payload: {}}).then(e => e.result))
    const [processOptions, setProcessOptions] = React.useState<ProcessType[]|undefined>(undefined)
    const usernamePromise = React.useMemo(async () => {
        const user = await signedInPromise
        if(user.outcome === "success") {
            return utils.systemToUsername((deserializeBufferObject<{system: SystemType}>(user).system))
        }
    }, [signedInPromise])
    const [seqNo, setSeqNo] = React.useState(0)

    return (
    <AsyncComponent promise={signedInPromise} fallback={() => <div>Logging in...</div>}>
        {(signedIn) => {
            const inputBox = <input type="text" key="polycentric-anywhere-input" id="polycentric-anywhere-input" value={content} onChange={(e) => {
                setContent(e.target.value)
            }}/>

            if(signedIn.outcome !== "error") {
                return <div {...otherProps}>
                    <label htmlFor="polycentric-anywhere-input">
                        <AsyncComponent promise={usernamePromise} fallback = {() => <></>}>
                            {(username) => <>[{username}]:</>}
                        </AsyncComponent>
                    </label>
                    {inputBox}
                    <button type="button" onClick={async () => {
                        extensionInvoke({operation: OperationRequest.POST, payload: {
                            content,
                            references: props.references?.map(serializeBufferObject)
                        }}).then(({result}) => {
                            if(result.outcome === "error") {
                                onPostError("error: " + result.error)
                            } else {
                                onPostFinished(deserializeBufferObject(result.event))
                            }
                        })
                    }}>{"Post"}</button>
                </div>
            }

            //login process
            switch(seqNo) {
                case 0:
                    //haven't typed password yet
                    return <div {...otherProps}>
                        <label htmlFor="polycentric-anywhere-input">
                            Password: {inputBox}
                            <button type="button" onClick={async () => {
                                if(!(/[0-9a-zA-Z\/+]{43}=/).test(content)) {
                                    alert("Expecting polycentric password to be a base-64 encoded private key.\nTry re-entering it.")
                                } else {
                                    const key:Encoded<PrivateKeyType> = {
                                        key: {
                                            __type: "buffer",
                                            __value: content
                                        },
                                        keyType: {
                                            __type: "bigint",
                                            __value: "1"
                                        }
                                    }
                                    const privateKey = deserializeBufferObject<PrivateKeyType>(key)
                                    //kinda dumb we have to do this, but there's some bug we have to work around
                                    const publicKeyInvocation = (await extensionInvoke({operation: OperationRequest.DERIVE_PUBLIC, payload: {privateKey: key}}))
                                    if(publicKeyInvocation.result.outcome === "success") {
                                        const publicKey = deserializeBufferObject<PublicKeyType>(publicKeyInvocation.result.publicKey)
                                        const processes = await timeLimit(utils.discoverProcesses.bind(utils))(publicKey).catch(e => [] as ProcessType[])
                                        setContent("")
                                        setProcessOptions(processes)
                                        setSeqNo(processes.length ? 1 : 3)
                                        setPrivateKey(privateKey)
                                    } else {
                                        setContent("")
                                        alert("Expecting polycentric password to be a base-64 encoded private key.\nTry re-entering it.")
                                    }                                    
                                }
                            }}>{"Sign in (polycentric key) " + signedIn.error}</button>
                        </label>
                    </div>
                case 1:
                    //have typed in password. Ask to reuse or create a new process
                    return <div {...otherProps}>
                        <label htmlFor="polycentric-anywhere-input">
                            Have you used this device before?
                        </label>
                        <button id="polycentric-anywhere-input" type="button" onClick={() => setSeqNo(2)}>
                            Yes
                        </button>
                        <button type="button" onClick={() => setSeqNo(3)}>
                            No
                        </button>
                    </div>
                case 2:
                    //reuse a process that for some reason we don't have a memory of using
                    return <div {...otherProps} style={{...otherProps.style, overflow: "scroll"}}>
                        <div style={{flexDirection:"column", display: "flex"}}>
                            <div>Select the name of this device:</div>
                            {processOptions?.map(process => {
                                const name = UTF8Decoder.decode(process.process)
                                let displayName;
                                if(/[ -~]{16}/.test(name)) {
                                    displayName = name
                                } else {
                                    displayName = bytesToHexString(process.process)
                                }
                                return <button type="button" onClick={async () => {
                                    setSignedInPromise(extensionInvoke({
                                        operation: OperationRequest.SIGN_IN,
                                        payload: {
                                            key: serializeBufferObject(privateKey!),
                                            process: serializeBufferObject(process),
                                        }
                                    }).then((resp) => resp.result))
                                }}>
                                    {displayName}
                                </button>
                            })}
                            <button type="button" onClick={() => {
                                setSeqNo(3)
                            }}>Other (create new)</button>
                        </div>
                    </div>
                case 3:
                    //Choose a new process. Either generate it randomly, or allow naming it
                    return <div {...otherProps}>
                        <label htmlFor="polycentric-anywhere-input">
                            Do you want to give this device a custom name?<br />
                            This name will be visible to other users.
                        </label>
                        <button id="polycentric-anywhere-input" type="button" onClick={() => setSeqNo(4)}>
                            Yes, name this device
                        </button>
                        <button type="button" onClick={() => {
                                setSignedInPromise(extensionInvoke({
                                    operation: OperationRequest.SIGN_IN,
                                    payload: {
                                        key: serializeBufferObject(privateKey!),
                                        process: null,
                                    }
                                }).then((resp) => resp.result))
                            }}>
                            No, generate a random device ID.
                        </button>
                    </div>
                case 4:
                    //allow naming the process (up to 16 characters)
                    if(!(/^[ -~]{0,16}$/g.test(content))) {
                        setContent(content.replaceAll(/[^ -~]/, "").substring(0,16))
                    }

                    return <div {...otherProps}>
                        <label htmlFor="polycentric-anywhere-input">
                            Device name (up to 16 characters):
                        </label>
                        {inputBox}
                        <button type="button" onClick={() => {
                            let process = UTF8Encoder.encode(content)
                            while(process.byteLength < 16) {
                                process = new Uint8Array([...process, 32])//space pad the end
                            }
                            setSignedInPromise(extensionInvoke({
                                operation: OperationRequest.SIGN_IN,
                                payload: {
                                    key: serializeBufferObject(privateKey!),
                                    process: serializeBufferObject({process}),
                                }
                            }).then((resp) => resp.result))
                        }}>
                            Confirm
                        </button>
                        <button type="button" onClick={() => setSeqNo(1)}>
                            Back
                        </button>
                    </div>
            }

            return <>unknown error: sign in seqno={seqNo}</>}
                    
        }
    </AsyncComponent>
    )
}