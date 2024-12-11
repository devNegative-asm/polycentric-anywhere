const esbuild = require("esbuild")
const child_process = require("child_process")
const fs = require("fs")
const curpath = fs.realpathSync(".")
if(!/\/polycentric-anywhere$/.test(curpath)) {
    console.error("can only build in the main directory")
    process.exit(1)
}
fs.rmSync("./dist", {recursive: true, force: true})
console.log("type checking")
const typeChecker = child_process.spawn("npx", ["tsc"])
typeChecker.on("error", (errno) => {
    console.error("type checking failed, errno=",errno)
    process.exit(errno)
})
typeChecker.on("exit", (exitCode) => {
    if(exitCode) {
        console.error("type checking failed, exit code:",exitCode)
        process.exit(exitCode)
    } else {
        console.log("completed type checking")
    }
})
typeChecker.stderr.on("data", (bytes) => console.error(bytes.toString("utf8")))
typeChecker.stdout.on("data", (bytes) => console.log(bytes.toString("utf8")))

console.log("building")
const backend = esbuild.build({
    entryPoints: {
        "background-task": "./src/background/Core.ts",
        "content-task": "./src/index.tsx"
    },
    minify: true,
    bundle: true,
    sourcemap: false,
    outdir: "./dist",
})

backend.then(() => {
    console.log("completed build")
}).catch((e) => {
    console.error("esbuild failed", e)
    process.exit(1)
})