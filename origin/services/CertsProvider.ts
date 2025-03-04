import express, { Application } from "express";
import { Server } from "node:http";
import { certsRouter, getDomains } from "./certificates";
import { challengesPath } from "../utils/certs";

class CertsProvider {
    public express: Application
    public server?: Server
    private port = 7878;

    constructor() {
        this.express = express()
        this.loadConfig()
        this.mountMiddlewares()
        this.mountRoutes()
    }

    private loadConfig() {
        //this.express.locals = Locals.config()
    }

    private mountMiddlewares() {
        this.express.use("/.well-known/acme-challenge", express.static(challengesPath));
        this.express.use('/domains', getDomains);
    }

    private mountRoutes() {
        this.express.use(certsRouter)
    }

    public init() {
        //const port = Locals.config().port
        this.server = this.express
            .listen(this.port, () => {
                return console.log(
                    `[server]: Server is running at http://localhost:${this.port}`
                )
            })
            .on("error", (err) => {
                return console.error("[server]: Error:", err)
            })
    }
}

export default new CertsProvider()