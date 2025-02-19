import { browser } from 'webextension-polyfill-ts'
import { __OLD_INSTALL_TIME_KEY } from 'src/constants'

export type UserFeatureOptIn =
    | 'Auth'
    | 'Sync'
    | 'DirectLink'
    | 'SocialIntegration'
    | 'PDFViewerAutoOpen'
const allFeatures: UserFeatureOptIn[] = [
    'Auth',
    'Sync',
    'DirectLink',
    'SocialIntegration',
    'PDFViewerAutoOpen',
]
const featureDefaults = {
    Auth: true,
    Sync: false,
    DirectLink: false,
    SocialIntegration: false,
    PDFViewerAutoOpen: false,
}
const featureDefaultByInstallDate = {
    SocialIntegration: new Date(2020, 1, 11).valueOf(),
}
export type UserFeatureOptInMap = {
    [key in UserFeatureOptIn]: boolean
}
export interface FeaturesInterface {
    getFeatures(): Promise<UserFeatureOptInMap>
    toggleFeature(feature: UserFeatureOptIn): void
    getFeature(feature: UserFeatureOptIn): Promise<boolean>
}

export class FeatureOptIns implements FeaturesInterface {
    private keyPrefix = 'FeatureOptIn_'

    public getFeatures = async (): Promise<UserFeatureOptInMap> => {
        const allFeatureOptions = {} as UserFeatureOptInMap
        for (const feature of allFeatures) {
            allFeatureOptions[feature] = await this.getFeature(feature)
        }
        return allFeatureOptions
    }

    public getFeature = async (feature: UserFeatureOptIn): Promise<boolean> => {
        const val = localStorage.getItem(`${this.keyPrefix}${feature}`)
        if (val !== null) {
            // If the user has saved a value, use that
            return JSON.parse(val)
        } else if (featureDefaultByInstallDate[feature]) {
            // If a default for this feature is based on install time (support depreciated features for old users)
            const installTime = (
                await browser.storage.local.get(__OLD_INSTALL_TIME_KEY)
            )[__OLD_INSTALL_TIME_KEY]
            return installTime <= featureDefaultByInstallDate[feature]
        } else {
            // Otherwise use a static default
            return featureDefaults[feature]
        }
    }

    public toggleFeature = async (feature: UserFeatureOptIn) => {
        const val = await this.getFeature(feature)
        localStorage.setItem(
            `${this.keyPrefix}${feature}`,
            JSON.stringify(!val),
        )
    }
}
