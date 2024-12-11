import * as React from "react"
interface AsyncComponentProps<T> {
    promise: Promise<T>
    revertToLoadingOnUpdate?: boolean
    fallback?: () => React.ReactElement
    children: (arg:T) => React.ReactElement
}

export function AsyncComponent<T>(props: AsyncComponentProps<T>) {
    const promiseRef = React.useRef<Promise<T>>(props.promise)
    promiseRef.current = props.promise
    const [value, setValue] = React.useState<T|undefined>(undefined)
    const [error, setError] = React.useState<Error|undefined>(undefined)
    React.useEffect(() => {
        if(props.revertToLoadingOnUpdate ?? true) {
            setValue(undefined)
        }
        props.promise.then((t:T) => {
            if(promiseRef.current === props.promise) {
                setValue(t)
            }
        }).catch((t:any) => {
            if(promiseRef.current === props.promise) {
                setError(t)
            }
        })
    }, [props.promise])
    if(error) {
        return <p>[Error: {error.name}:{error.message}]</p>
    } else if(value !== undefined) {
        return props.children(value)
    } else if(props.fallback) {
        return props.fallback()
    } else {
        return <p>Loading...</p>
    }
}

export function AsyncComponentSingleton<T>(props: Omit<AsyncComponentProps<T>, "promise"|"revertToLoadingOnUpdate"> & {promise: () => Promise<T>}) {
    const promise = React.useMemo(props.promise, [])
    return <AsyncComponent {...props} promise={promise} />
}