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
          "routes": [
            { //media-api
              "handle": [
                {
                  "handler": "subroute",
                  "routes": [
                    {
                      "handle": [
                        {
                          "handler": "reverse_proxy",
                          "upstreams": [
                            {
                              "dial": "127.0.0.1:8080"
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ],
              "match": [
                {
                  "host": [
                    "media-api."+env.host
                  ]
                }
              ],
              "terminal": true
            },
            { //appdev
              "handle": [
                {
                  "handler": "subroute",
                  "routes": [
                    {
                      "handle": [
                        {
                          "handler": "reverse_proxy",
                          "upstreams": [
                            {
                              "dial": "localhost:3000"
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ],
              "match": [
                {
                  "host": [
                    "appdev."+env.host
                  ]
                }
              ],
              "terminal": true
            },
            { //ipfs
              "handle": [
                {
                  "handler": "subroute",
                  "routes": [
                    {
                      "handle": [
                        {
                          "handler": "reverse_proxy",
                          "headers": {
                            "request": {
                              "set": {
                                "Host": [
                                  "{http.reverse_proxy.upstream.hostport}"
                                ]
                              }
                            }
                          },
                          "upstreams": [
                            {
                              "dial": "185.177.124.24:8080"
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ],
              "match": [
                {
                  "host": [
                    "ipfs."+env.host,
                    "ipfs.gateway.name",
                  ]
                }
              ],
              "terminal": true
            },
            { //arweave
              "handle": [
                {
                  "handler": "subroute",
                  "routes": [
                    {
                      "handle": [
                        {
                          "handler": "reverse_proxy",
                          "headers": {
                            "request": {
                              "set": {
                                "Host": [
                                  "{http.reverse_proxy.upstream.hostport}"
                                ]
                              }
                            }
                          },
                          "upstreams": [
                            {
                              "dial": "185.177.124.24:3000"
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ],
              "match": [
                {
                  "host": [
                    "arweave."+env.host,
                    "*.gateway.name",
                  ]
                }
              ],
              "terminal": true
            }
          ],
          "tls_connection_policies": [{}]
        }
      }
    }
  }
}
