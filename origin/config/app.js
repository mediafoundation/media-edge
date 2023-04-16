const env = require("./env");

module.exports = {
  media: {
    minimum_amount: env.minimum_amount
  },
  server: {
    env: "development",
    url: "http://127.0.0.1",
    httpPort: 8080,
    httpsPort: 443,
    privateKey: "/etc/letsencrypt/live/xxxx/privkey.pem",
    certificate: "/etc/letsencrypt/live/xxxx/cert.pem"
  },
  caddyInitialApps: {
    "http": {
      "servers": {
        "srv0": {
          "automatic_https": {
            "disable": true
          },
          "listen": [
            ":80"
          ],
          "routes": [],
          "tls_connection_policies": [{}]
        }
      }
    }
  }
}
