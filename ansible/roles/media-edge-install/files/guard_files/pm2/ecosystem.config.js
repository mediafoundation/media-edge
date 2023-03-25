module.exports = {
         apps: [
                 {
                     name : "media-origin",
                     script: "/root/media-guard/web.js",
                     instances: 1
                 },
                //  {
                //      name: "dapp",
                //      cwd: "/root/media-dapp/",
                //      script: "yarn",
                //      args: "start",
                //      instances: 1
                //  }
         ]
}