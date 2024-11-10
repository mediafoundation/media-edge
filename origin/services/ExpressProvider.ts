import express, { Application } from "express"
import cors from "cors"
import {Server} from "node:http"
import apiRouter from "./api"

class Express {
    public express: Application
    public server?: Server
    private port = 8080;

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
        this.express.use(express.json())
        this.express.use(cors({
            origin: '*',
            credentials: true,
        }))
        this.express.use(express.urlencoded({ extended: true }))
    }

    private mountRoutes() {
        this.express.use(apiRouter)
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

export default new Express()