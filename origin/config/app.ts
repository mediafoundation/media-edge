import {env} from "./env"

const getHosts = (subdomain) => {
  console.log(env.hosts)
  let hostnames = []
  for(const host of env.hosts) {
    hostnames.push(`${subdomain}.${host}`)
  }
  return hostnames
}
function createRoute(name, dialAddress) {
  return {
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
                                      "dial": dialAddress
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
              "host": getHosts(name)
          }
      ],
      "terminal": true
  };
}

let caddyInitialApps = {
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
                  createRoute("api", "origin:8080"),
                  createRoute("appdev", "localhost:3000"),
                  createRoute("swaptest", "localhost:3002")
              ],
              "tls_connection_policies": [{}]
          }
      }
  }
};

export const appConfig = {
  media: {
    //minimum_amount: env.minimum_amount
  },
  server: {
    env: "development",
    url: "http://127.0.0.1",
    httpPort: 8080,
    httpsPort: 443,
    privateKey: "/etc/letsencrypt/live/xxxx/privkey.pem",
    certificate: "/etc/letsencrypt/live/xxxx/cert.pem"
  },
  caddyInitialApps: caddyInitialApps
}
