import { EventEmitter } from 'events'
import type TypedEventEmitter from 'typed-emitter'
import type { Tabs, Browser } from 'webextension-polyfill-ts'

import { mapChunks } from 'src/util/chunk'
import { CONCURR_TAB_LOAD } from '../constants'
import {
    registerRemoteFunctions,
    remoteFunctionWithExtraArgs,
    remoteFunctionWithoutExtraArgs,
    runInTab,
} from 'src/util/webextensionRPC'
import { TabManager } from './tab-manager'
import { TabChangeListener, TabManagementInterface } from './types'
import { resolvablePromise } from 'src/util/resolvable'
import { RawPageContent } from 'src/page-analysis/types'
import { fetchFavIcon } from 'src/page-analysis/background/get-fav-icon'
import { LoggableTabChecker } from 'src/activity-logger/background/types'
import { isLoggable } from 'src/activity-logger'
import { blacklist } from 'src/blacklist/background'
import { captureException } from 'src/util/raven'
import type { InPageUIContentScriptRemoteInterface } from 'src/in-page-ui/content_script/types'
import { isExtensionTab } from '../utils'

const SCROLL_UPDATE_FN = 'updateScrollState'
const CONTENT_SCRIPTS = ['/lib/browser-polyfill.js', '/content_script.js']

export interface TabManagementEvents {
    tabRemoved(event: { tabId: number }): void
}

export default class TabManagementBackground {
    events = new EventEmitter() as TypedEventEmitter<TabManagementEvents>
    tabManager: TabManager
    remoteFunctions: TabManagementInterface<'provider'>
    _indexableTabs: { [tabId: number]: true } = {}

    /**
     * Used to stop of tab updated event listeners while the
     * tracking of existing tabs is happening.
     */
    private trackingExistingTabs = resolvablePromise()

    constructor(
        private options: {
            tabManager: TabManager
            browserAPIs: Pick<
                Browser,
                'tabs' | 'runtime' | 'webNavigation' | 'storage' | 'windows'
            >
            extractRawPageContent(tabId: number): Promise<RawPageContent>
        },
    ) {
        this.tabManager = options.tabManager
        this.remoteFunctions = {
            fetchTab: remoteFunctionWithoutExtraArgs(async (id) =>
                this.tabManager.getTabState(id),
            ),
            fetchTabByUrl: remoteFunctionWithoutExtraArgs(async (url) =>
                this.tabManager.getTabStateByUrl(url),
            ),
            setTabAsIndexable: remoteFunctionWithExtraArgs(
                this.setTabAsIndexable,
            ),
            confirmBackgroundScriptLoaded: remoteFunctionWithoutExtraArgs(
                async () => {
                    // not used for now
                    return true
                },
            ),
        }
    }

    static isTabLoaded = (tab: Tabs.Tab) => tab.status === 'complete'

    setupRemoteFunctions() {
        registerRemoteFunctions(this.remoteFunctions)
    }

    setupWebExtAPIHandlers() {
        this.setupScrollStateHandling()
        this.setupNavStateHandling()
        this.setupTabLifecycleHandling()
    }

    setTabAsIndexable: TabManagementInterface<
        'provider'
    >['setTabAsIndexable']['function'] = async ({ tab }) => {
        this._indexableTabs[tab.id] = true
    }

    async extractRawPageContent(tabId: number): Promise<RawPageContent> {
        return this.options.extractRawPageContent(tabId)
    }

    async getOpenTabsInCurrentWindow(): Promise<
        Array<{ id: number; url: string }>
    > {
        const windowId = this.options.browserAPIs.windows.WINDOW_ID_CURRENT
        return (await this.options.browserAPIs.tabs.query({ windowId }))
            .map((tab) => ({ id: tab.id!, url: tab.url }))
            .filter(
                (tab) =>
                    tab.id &&
                    tab.url &&
                    tab.id !== this.options.browserAPIs.tabs.TAB_ID_NONE,
            )
    }

    async getFavIcon({ tabId }: { tabId: number }) {
        const tab = await this.options.browserAPIs.tabs.get(tabId)

        if (tab?.favIconUrl == null) {
            return undefined
        }

        return fetchFavIcon(tab.favIconUrl)
    }

    async findTabIdByFullUrl(fullUrl: string) {
        const tabs = await this.options.browserAPIs.tabs.query({ url: fullUrl })
        return tabs.length ? tabs[0].id : null
    }

    async mapTabChunks<T>(
        mapFn: (tab: Tabs.Tab) => Promise<T>,
        {
            chunkSize = CONCURR_TAB_LOAD,
            query = {},
            onError,
        }: {
            chunkSize?: number
            query?: Tabs.QueryQueryInfoType
            onError?: (error: Error, tab: Tabs.Tab) => void
        } = {},
    ) {
        const tabs = await this.options.browserAPIs.tabs.query(query)
        await mapChunks(tabs, chunkSize, mapFn, onError)
    }

    async trackExistingTabs() {
        this.mapTabChunks(async (tab) => {
            if (this.tabManager.isTracked(tab.id)) {
                return
            }

            this.tabManager.trackTab(tab, {
                isLoaded: TabManagementBackground.isTabLoaded(tab),
            })

            // NOTE: this is now done on-demand. See `BackgroundScript.setupOnDemandContentScriptInjection`
            // await this.injectContentScripts(tab)
        })

        this.trackingExistingTabs.resolve()
    }

    private async trackNewTab(id: number) {
        const browserTab = await this.options.browserAPIs.tabs.get(id)

        this.tabManager.trackTab(browserTab, {
            isLoaded: TabManagementBackground.isTabLoaded(browserTab),
        })
    }

    async injectContentScriptsIfNeeded(tabId: number) {
        try {
            await runInTab<InPageUIContentScriptRemoteInterface>(tabId, {
                quietConsole: true,
            }).ping()
        } catch (err) {
            // If the ping fails, the content script is not yet set up
            const _tab = await this.options.browserAPIs.tabs.get(tabId)
            await this.injectContentScripts(_tab)
        }
    }

    async injectContentScripts(tab: Tabs.Tab) {
        const isLoggable = await this.shouldLogTab(tab)

        if (!isLoggable || isExtensionTab({ url: tab.url! })) {
            return
        }

        for (const file of CONTENT_SCRIPTS) {
            await this.options.browserAPIs.tabs
                .executeScript(tab.id, { file, runAt: 'document_idle' })
                .catch((err) => {
                    const message = `Cannot inject content-script "${file}" into page "${tab.url}" - reason: ${err.message}`
                    captureException(new Error(message))
                    console.error(message)
                })
        }
    }

    /**
     * Combines all "loggable" conditions for logging on given tab data to determine
     * whether or not a tab should be logged.
     */
    shouldLogTab: LoggableTabChecker = async function ({ url }) {
        // Short-circuit before async logic, if possible
        if (!url || !isLoggable({ url })) {
            return false
        }

        const isBlacklisted = await blacklist.checkWithBlacklist() // tslint:disable-line
        return !isBlacklisted({ url })
    }

    /**
     * Ensure tab scroll states are kept in-sync with scroll events from the content script.
     */
    private setupScrollStateHandling() {
        this.options.browserAPIs.runtime.onMessage.addListener(
            ({ funcName, ...scrollState }, { tab }) => {
                if (funcName !== SCROLL_UPDATE_FN || tab == null) {
                    return
                }
                this.tabManager.updateTabScrollState(tab.id, scrollState)
            },
        )
    }

    private setupTabLifecycleHandling() {
        this.options.browserAPIs.tabs.onCreated.addListener((tab) => {
            if (!tab.id) {
                return
            }
            this.tabManager.trackTab(tab)
        })

        this.options.browserAPIs.tabs.onActivated.addListener(
            async ({ tabId }) => {
                if (!this.tabManager.isTracked(tabId)) {
                    await this.trackNewTab(tabId)
                }

                this.tabManager.activateTab(tabId)
            },
        )

        this.options.browserAPIs.tabs.onRemoved.addListener((tabId) => {
            const tab = this.tabManager.removeTab(tabId)
            delete this._indexableTabs[tabId]

            if (tab != null) {
                this.events.emit('tabRemoved', { tabId })
            }
        })
    }

    /**
     * The `webNavigation.onCommitted` event gives us some useful data related to how the navigation event
     * occured (client/server redirect, user typed in address bar, link click, etc.). Might as well keep the last
     * navigation event for each tab in state for later decision making.
     */
    private setupNavStateHandling() {
        this.options.browserAPIs.webNavigation.onCommitted.addListener(
            ({ tabId, frameId, ...navData }: any) => {
                // Frame ID is always `0` for the main webpage frame, which is what we care about
                if (frameId === 0) {
                    this.tabManager.updateNavState(tabId, {
                        type: navData.transitionType,
                        qualifiers: navData.transitionQualifiers,
                    })
                }
            },
        )
    }

    private tabUpdatedListener: TabChangeListener = async (
        tabId,
        changeInfo,
        tab,
    ) => {
        await this.trackingExistingTabs

        if (changeInfo.status) {
            this.tabManager.setTabLoaded(
                tabId,
                changeInfo.status === 'complete',
            )
        }
    }
}
