module.exports = {
    apps: [
        {
            name : "origin",
            script: "/root/origin/daemon.ts",
            args: "--reset",
            instances: 1
        },
        {
            name : "certificates",
            script: "/root/origin/services/certificates.ts",
            instances: 1
        },
        {
            name : "api",
            script: "/root/origin/services/api.ts",
            instances: 1
        },
    ]
}