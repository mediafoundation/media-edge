interface ProviderState {
    [provider: string]: {
        privateKey: string
    }
}

interface ProviderData {
    [privateKey: string]: {
        a_record: string[]
        cname: string[]
    }
}

export const providerState: ProviderState = {}

export const providerData: ProviderData = {}