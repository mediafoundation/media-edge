import * as psl from "psl";
import {parse, ParsedDomain} from "psl";

function isARecord(host: string): boolean {
    if (psl.isValid(host)) {
        const parsed = parse(host) as ParsedDomain;
        return !parsed.subdomain;
    } else {
        throw new Error("Invalid host");
    }
}

function getHostName(host: string): string {
    if (psl.isValid(host)) {
        const parsed: ParsedDomain = psl.parse(host) as ParsedDomain
        return parsed.domain as string;
    } else {
        throw new Error("Invalid host");
    }
}

export { isARecord, getHostName };