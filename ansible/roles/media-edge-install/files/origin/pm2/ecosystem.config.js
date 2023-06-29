module.exports = {
         apps: [
                 {
                     name : "origin",
                     script: "/root/origin/daemon.js",
                     args: "--reset",
                     instances: 1
                 },
         ]
}