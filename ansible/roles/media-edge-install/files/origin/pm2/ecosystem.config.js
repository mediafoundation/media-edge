module.exports = {
    apps: [
        {
            name : "origin",
            script: "/root/origin/daemon.js",
            args: "--reset",
            instances: 1
        },
        {
            name : "certificates",
            script: "/root/origin/services/certificates.js",
            instances: 1
        },
        {
            name : "api",
            script: "/root/origin/services/api.js",
            instances: 1
        },
    ]
}