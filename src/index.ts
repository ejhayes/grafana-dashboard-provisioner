#!/usr/bin/env node

import {load, dump} from "js-yaml"
import {readdir, mkdirSync, writeFileSync, readFileSync} from "fs"
import {posix} from "path"
import {cleanEnv, str, num, url} from 'envalid'
import {promisify} from 'util'
import {get} from 'https'

interface GrafanaDashboardProvider {
    name: string
    type: "file" | "url"
    options?: {
        /**
         * Grafana dashboard id
         */
        gnetId?: number
        /**
         * Input to replace in the dashboard
         */
        inputs?: {
            [inputName: string]: string
        }
        /**
         * Path of the config
         */
        path?: string
    }
}

interface GrafanaDashboardInput {
    /**
     * Input name
     */
    name: string
    /**
     * Input type
     */
    type: string
    /**
     * Input label
     */
    label: string
}
interface GrafanaDashboardJson {
    "__inputs": GrafanaDashboardInput[]
}
interface GrafanaDashboardProvisioner {
    apiVersion?: number
    providers?: GrafanaDashboardProvider[]
}

class Config {
    readonly config = cleanEnv(process.env, {
        BASE_URL: url({default: 'https://grafana.com', desc: 'Default base Grafana url'}),
        DEST_PATH_PREFIX: str({default: ''})
    })
}

class GrafanaDashboardProvisionerParser {
    constructor(
        private readonly inputPath: string, 
        private readonly outputPath: string,
        private readonly config: Config
    ) {

    }

    async convertFile(filename: string) {
        let destOutput: GrafanaDashboardProvisioner = {
            apiVersion: 1,
            providers: []
        }
        const destOutputPath = posix.join(this.outputPath, filename)

        const provisioner = load(readFileSync(posix.join(this.inputPath, filename)).toString()) as GrafanaDashboardProvisioner
        
        if (provisioner.providers) {
            for (const provider of provisioner.providers) {
                if (provider.type === "url") {
                    //  convert this to a regular file provider
                    if (! provider.options?.gnetId) {
                        throw new Error(`Provider ${provider.name} missing required properties: gnetId`)
                    }

                    const dashboardPath = posix.join(this.outputPath, `${provider.options.gnetId}.json`)
                    const dashboard = JSON.parse(await this.getDashboardById(provider.options.gnetId))
                    
                    if (dashboard.title && provider.name !== "") {
                        dashboard.title = provider.name
                    }

                    writeFileSync(dashboardPath, this.tokenize(JSON.stringify(dashboard, null, 2), provider.options.inputs))
                    provider.type = 'file'
                    provider.options = {
                        path: posix.join(this.config.config.DEST_PATH_PREFIX, `${provider.options.gnetId}.json`)
                    }
                }

                destOutput.providers?.push(provider)
            }
        }

        writeFileSync(destOutputPath, dump(destOutput))
    }

    tokenize(input: string, tokens?: {[token: string]: string}): string {
        if (tokens) {
            for (const [key, value] of Object.entries(tokens)) {
                input = input.replace(new RegExp('\\${' + key +'}','g'), value)
            }
        }
        return input
    }

    async getDashboardById(id: number): Promise<string> {
        let data: string = ""
        return new Promise((resolve, reject) => {
            console.log(`Fetching dashboard: ${id}`)
            get(`${this.config.config.BASE_URL}/api/dashboards/${id}/revisions/latest/download`, function(response) {
              //response.pipe(file);
              response.on("data", (chunk: string) => {
                  data += chunk
              })
              response.on("end", () => {
                  resolve(data)
              })
              
            }).on('error', (err) => {
              reject(err.message)
            });
          })
    }

    async run() {
        console.log('Starting...')
        mkdirSync(this.outputPath, {recursive: true})

        for (const file of await promisify(readdir)(this.inputPath)) {
            console.log(`Parsing ${file}`)
            await this.convertFile(file)
        }
        console.log('Done...')
    }
}

if (require.main === module) {

    if (process.argv.length !== 4) {
        console.log(`Usage: ${process.argv[1]} [input] [output]`)
        process.exit(1)
    }

    const service = new GrafanaDashboardProvisionerParser(process.argv[2], process.argv[3], new Config())

    service.run()
}
    