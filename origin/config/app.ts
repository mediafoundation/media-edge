import {env} from "./env"

const getHosts = (subdomain) => {
    let hostnames = []
    for(const provider of env.providers) {
        for(const domain of provider.domains) {
            hostnames.push(`${subdomain}.${domain.host}`)
        }
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
              ],
              "tls_connection_policies": [{}]
          }
      }
  }
};

export const appConfig = {
  caddyInitialApps: caddyInitialApps
}
