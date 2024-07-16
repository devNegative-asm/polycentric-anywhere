

const urlRegex:RegExp = /((https?|ftp|sftp|file):\/\/\/?[A-Za-z0-9.]+)((\/[^\/?]+)+\/?)?(\?(([^&=]+)=([^&=]+)(&([^&=]+)=([^&=]+))*))?/g
export function fixUrlToReference(url: string):string {
    const match = [...url.matchAll(urlRegex)][0]
    const fullUrl = url
    const localUrl = match[1]
    const path = match[3] ?? ""
    const args = match[6] ?? ""
    const params = new URLSearchParams(window.location.search)

    switch(localUrl) {
        case "https://www.youtube.com":
        case "https://m.youtube.com":
        case "https://youtube.com":
            let videoId = params.get("v")
            if(videoId === null) {
                videoId = path.replaceAll("/watch/","")
            }
            if(videoId) {
                return "https://www.youtube.com/watch?v="+videoId
            }
        default:
            /* NEVER!!!!!! include parameters in the default case.
                If a user navigates to a website, this string will be used to build a query, so that info will leak to every server in the servers list.
                Some URLs like password reset links store security tokens in the query parameters, and we don't want to be leaking those.
                Nothing stops a website from storing security tokens in the path, but this is so uncommon, it's a non-issue.
            */
            return localUrl + path
    }
}