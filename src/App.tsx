import * as React from 'react';
import { bytesToHexString, UTF8Decoder } from "./core/Util"
import { PolycentricUtils } from './core/PolycentricUtils';
import { PolycentricAnywhereBaseComponent } from "./PolycentricAnywhereBaseComponent"
import { ContentType, decodePointer, decodePost } from './protobufs';

export function referenceDecode(contentType: bigint, reference: Uint8Array) {
  const decoder = UTF8Decoder
  return ({
      [String(ContentType.Post)]:
          (text: Uint8Array) => decoder.decode(decodePost(text).content),
      [String(ContentType.SystemProcesses)]:
          (procBuffer: Uint8Array) => {
              const pointer = decodePointer(procBuffer)
              return <>
                  System: {bytesToHexString(pointer.system.key)}
                  <br />
                  Process: {bytesToHexString(pointer.process.process)}
                  <br />
                  LogicalClock: {pointer.logicalClock.toString(10)}
                  <br />
                  Hash: {bytesToHexString(pointer.eventDigest.digest)}
              </>
          }
  }[contentType.toString()] ?? decoder.decode.bind(decoder))(reference)
}

function rmTag<T extends {__tag: any}>(input:T):Omit<T,"__tag"> {
  const {__tag, ...rest} = input
  return rest
}


//---------------------------------------------------------------
//---------------------- CONSTANTS ------------------------------
//---------------------------------------------------------------
const utils = new PolycentricUtils()

var ms = {x: 0, y: 0}

function App() {
  React.useEffect(() => {
    window.addEventListener("dragover", (e) => {
      ms = {x: e.clientX, y:e.clientY}
    })
    window.addEventListener("mousemove", (e) => {
      ms = {x: e.clientX, y:e.clientY}
    })
  }, [])

  const [transform, setTransform] = React.useState({x:0, y:0})
  const [drag, setDrag] = React.useState<undefined|typeof transform>(undefined)

  const dragger = <div className='button_style unselectable' title="move overlay" draggable="true" style={{background: "#6DABF6", userSelect: "none", width: "50%"}}
        onDragStart={(e) => {
          setDrag(ms)
          return false
        }}
        onDragEnd={(e) => {
          setDrag(undefined)
          e.preventDefault();
          return false
        }}
        onDrag={(e) => {
          e.preventDefault();
          const delta = {
              x: drag ? ms.x - drag.x : 0,
              y: drag ? ms.y - drag.y : 0,
          }
          setTransform({
              x: transform.x + delta.x,
              y: transform.y + delta.y
          })
          setDrag(ms)
          return false
      }}>
        &nbsp;
          </div>
  return (

    
    <div className="Polycentric_App" style={{position: "fixed", translate:`${transform.x}px ${transform.y}px`, zIndex: 9999, left: "10px", top: "10px", backgroundColor: "#0f0f4d"}}>
      <style>
        {`
          .Polycentric_App * {
            all: unset;
            font-family: monospace;
            font-size: 22px;
          }
          .Polycentric_App *.timestamp {
            font-size: 15px;
            color: #d0d000;
          }
          .Polycentric_App style {
            display: none;
          }
          .Polycentric_App table {
            display: table;
            border-collapse: collapse;
          }
          .Polycentric_App tr {
            display: table-row;
            border: 2px solid black;
          }
          .Polycentric_App td {
            border-right: 2px solid black;
            display: table-cell;
            padding-right: 20px;
            font-size: 18px;
          }
          .Polycentric_App div {
            color: white;
          }
          .Polycentric_App input {
            font-size: 22px;
            border: 2px solid #111;
            border-color: black;
            background: #0f0f4d;
            color: white;
          }
          .Polycentric_App .button_style {
            font-size: 22px;
            border: 2px solid #111;
            border-radius: 18px;
          }
          .Polycentric_App button {
            font-size: 22px;
            color: black;
            border: 2px solid #111;
            border-color: lime;
            background: lime;
            border-radius: 18px;
            padding: 0px 4px;
            margin: 0px;
          }
          .Polycentric_App button.no_background {
            font-size: 22px;
            color: white;
            border: 2px solid #111;
            border-color: black;
            background: #0f0f4d;
            border-radius: 18px;
            padding: 0px 4px;
            margin: 0px;
          }
          .Polycentric_App img.avatar {
            height: 50px;
            width: 50px;
            border-radius: 10px;
          }
          .Polycentric_App div.username {
            font-size: 15px;
            padding: 0px 10px 10px 10px;
            color: #dfaf00;
          }
          .unselectable {
            -moz-user-select: -moz-none;
            -khtml-user-select: none;
            -o-user-select: none;
            user-select: none;
          }
        `}
      </style>
        <PolycentricAnywhereBaseComponent dragger={dragger} utils={utils} />
    </div>
  );
}

export default App;
