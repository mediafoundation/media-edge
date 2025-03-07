import { Provider } from "../config/interfaces"

interface ProviderState {
    [provider: string]: {
        privateKey: string
    }
}

interface ProviderData {
    [privateKey: string]: Provider
}

export const providerState: ProviderState = {}

export const providerData: ProviderData = {}