module.exports = {
         apps: [
                 {
                     name : "origin",
                     script: "/root/origin/daemon.js",
                     args: "--reset",
                     instances: 1
                 },
                 {
                     name : "certs",
                     script: "/root/origin/certs.js",
                     instances: 1
                 },
         ]
}