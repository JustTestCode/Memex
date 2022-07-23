import {
    makeSingleDeviceUILogicTestFactory,
    UILogicTestDevice,
    insertBackgroundFunctionTab,
} from 'src/tests/ui-logic-tests'
import {
    RibbonContainerLogic,
    INITIAL_RIBBON_COMMENT_BOX_STATE,
    RibbonLogicOptions,
} from './logic'
import { Annotation } from 'src/annotations/types'
import { AnnotationPrivacyLevels } from '@worldbrain/memex-common/lib/annotations/types'
import { SharedInPageUIState } from 'src/in-page-ui/shared-state/shared-in-page-ui-state'
import { createAnnotationsCache } from 'src/annotations/annotations-cache'
import { FakeAnalytics } from 'src/analytics/mock'
import * as DATA from './logic.test.data'
import { normalizeUrl } from '@worldbrain/memex-url-utils'
import { createSyncSettingsStore } from 'src/sync-settings/util'

describe('Ribbon logic', () => {
    const it = makeSingleDeviceUILogicTestFactory()

    async function setupTest(
        device: UILogicTestDevice,
        options: {
            dependencies?: Partial<RibbonLogicOptions>
        } = {},
    ) {
        const { backgroundModules } = device
        const currentTab = {
            id: 654,
            url: 'https://www.foo.com',
            normalizedUrl: 'foo.com',
            title: 'Foo.com: Home',
        }
        const annotations = insertBackgroundFunctionTab(
            backgroundModules.directLinking.remoteFunctions,
            currentTab,
        ) as any
        const highlighter = {
            renderHighlights: () => {},
            removeHighlights: () => {},
        } as any

        const inPageUI = new SharedInPageUIState({
            loadComponent: () => {},
            unloadComponent: () => {},
            getNormalizedPageUrl: () => currentTab.normalizedUrl,
        })

        const annotationsManager = {} as any

        let globalTooltipState = false
        let globalHighlightsState = false
        const analytics = new FakeAnalytics()
        const annotationsCache = createAnnotationsCache(
            {
                ...backgroundModules,
                contentSharing:
                    backgroundModules.contentSharing.remoteFunctions,
                customLists: backgroundModules.customLists.remoteFunctions,
                annotations,
            },
            { skipPageIndexing: true },
        )

        const syncSettings = createSyncSettingsStore({
            syncSettingsBG: backgroundModules.syncSettings,
        })

        const ribbonLogic = new RibbonContainerLogic({
            activityIndicatorBG: backgroundModules.activityIndicator,
            getPageUrl: () => currentTab.normalizedUrl,
            analytics,
            syncSettings,
            setRibbonShouldAutoHide: () => undefined,
            getSidebarEnabled: async () => true,
            setSidebarEnabled: async () => {},
            focusCreateForm:
                options.dependencies?.focusCreateForm ?? (() => undefined),
            inPageUI,
            currentTab,
            highlighter,
            annotationsManager,
            getRemoteFunction: () => async () => {},
            bookmarks: backgroundModules.bookmarks.remoteFunctions,
            tags: backgroundModules.tags.remoteFunctions,
            contentSharing: backgroundModules.contentSharing.remoteFunctions,
            customLists: backgroundModules.customLists.remoteFunctions,
            annotations,
            ...(options?.dependencies ?? {}),
            tooltip: {
                getState: async () => globalTooltipState,
                setState: async (value) => {
                    globalTooltipState = value
                },
            },
            highlights: {
                getState: async () => globalHighlightsState,
                setState: async (value) => {
                    globalHighlightsState = value
                },
            },
            annotationsCache,
        })

        const ribbon = device.createElement(ribbonLogic)
        return {
            ribbon,
            inPageUI,
            ribbonLogic,
            analytics,
            annotationsCache,
            syncSettings,
        }
    }

    it('should load', async ({ device }) => {
        const { ribbon: firstRibbon } = await setupTest(device, {
            dependencies: {
                getSidebarEnabled: async () => true,
            },
        })
        await firstRibbon.init()
        expect(firstRibbon.state.isRibbonEnabled).toBe(true)

        const { ribbon: secondRibbon } = await setupTest(device, {
            dependencies: {
                getSidebarEnabled: async () => false,
            },
        })
        await secondRibbon.init()
        expect(secondRibbon.state.isRibbonEnabled).toBe(false)
    })

    it('should toggle the ribbon', async ({ device }) => {
        let sidebarEnabled = true
        const { ribbon, inPageUI } = await setupTest(device, {
            dependencies: {
                getSidebarEnabled: async () => sidebarEnabled,
                setSidebarEnabled: async (enabled) => {
                    sidebarEnabled = enabled
                },
            },
        })
        await inPageUI.showRibbon()
        await ribbon.init()

        const expectEnabled = (value: boolean) => {
            expect(sidebarEnabled).toBe(value)
            expect(ribbon.state.isRibbonEnabled).toBe(value)
            expect(inPageUI).toEqual(
                expect.objectContaining({
                    componentsShown: expect.objectContaining({ ribbon: value }),
                    componentsSetUp: expect.objectContaining({ ribbon: value }),
                }),
            )
        }
        expectEnabled(true)
        await ribbon.processEvent('toggleRibbon', null)
        expectEnabled(false)
    })

    it('should toggle a bookmark', async ({ device }) => {
        const { ribbon } = await setupTest(device)

        // TODO: Once we make page indexing more testable, fully test down to the DB level
        let hasBookmark = false
        device.backgroundModules.bookmarks.remoteFunctions.addPageBookmark = async () => {
            hasBookmark = true
        }
        device.backgroundModules.bookmarks.remoteFunctions.delPageBookmark = async () => {
            hasBookmark = false
        }
        await ribbon.init()

        expect(ribbon.state.bookmark.isBookmarked).toBe(false)
        await ribbon.processEvent('toggleBookmark', null)
        expect(ribbon.state.bookmark.isBookmarked).toBe(true)
    })

    it('should be able to toggle tooltip', async ({ device }) => {
        const { ribbon } = await setupTest(device)

        await ribbon.init()
        expect(ribbon.state.tooltip.isTooltipEnabled).toBe(false)
        await ribbon.processEvent('handleTooltipToggle', null)
        expect(ribbon.state.tooltip.isTooltipEnabled).toBe(true)
        await ribbon.processEvent('handleTooltipToggle', null)
        expect(ribbon.state.tooltip.isTooltipEnabled).toBe(false)
    })

    it('should be able to toggle highlights', async ({ device }) => {
        const { ribbon } = await setupTest(device)

        await ribbon.init()
        expect(ribbon.state.highlights.areHighlightsEnabled).toBe(false)
        await ribbon.processEvent('handleHighlightsToggle', null)
        expect(ribbon.state.highlights.areHighlightsEnabled).toBe(true)
        await ribbon.processEvent('handleHighlightsToggle', null)
        expect(ribbon.state.highlights.areHighlightsEnabled).toBe(false)
    })

    it('should call passed-down callback when toggling popout open states', async ({
        device,
    }) => {
        let arePopupsOpen = false
        const toggleAutoHideRibbon = () => {
            arePopupsOpen = !arePopupsOpen
        }
        const { ribbon } = await setupTest(device, {
            dependencies: { setRibbonShouldAutoHide: toggleAutoHideRibbon },
        })

        await ribbon.init()

        expect(arePopupsOpen).toBe(false)
        await ribbon.processEvent('setShowCommentBox', { value: true })
        expect(arePopupsOpen).toBe(true)
        await ribbon.processEvent('setShowCommentBox', { value: false })
        expect(arePopupsOpen).toBe(false)
        await ribbon.processEvent('setShowCommentBox', { value: true })
        expect(arePopupsOpen).toBe(true)
        await ribbon.processEvent('cancelComment', null)

        expect(arePopupsOpen).toBe(false)
        await ribbon.processEvent('setShowListsPicker', { value: true })
        expect(arePopupsOpen).toBe(true)
        await ribbon.processEvent('setShowListsPicker', { value: false })

        expect(arePopupsOpen).toBe(false)
        await ribbon.processEvent('setShowTagsPicker', { value: true })
        expect(arePopupsOpen).toBe(true)
        await ribbon.processEvent('setShowTagsPicker', { value: false })

        expect(arePopupsOpen).toBe(false)
        await ribbon.processEvent('setShowSearchBox', { value: true })
        expect(arePopupsOpen).toBe(true)
        await ribbon.processEvent('setShowSearchBox', { value: false })

        expect(arePopupsOpen).toBe(false)
        await ribbon.processEvent('toggleShowExtraButtons', null)
        expect(arePopupsOpen).toBe(true)
        await ribbon.processEvent('toggleShowExtraButtons', null)

        expect(arePopupsOpen).toBe(false)
        await ribbon.processEvent('toggleShowTutorial', null)
        expect(arePopupsOpen).toBe(true)
        await ribbon.processEvent('toggleShowTutorial', null)
    })

    it('should be able to add+remove lists, also adding any shared lists to public annotations', async ({
        device,
    }) => {
        const fullPageUrl = DATA.CURRENT_TAB_URL_1
        await device.storageManager
            .collection('customLists')
            .createObject(DATA.LISTS_1[0])
        await device.storageManager
            .collection('customLists')
            .createObject(DATA.LISTS_1[1])
        await device.storageManager
            .collection('sharedListMetadata')
            .createObject({
                localId: DATA.LISTS_1[0].id,
                remoteId: 'test-share-1',
            })
        await device.storageManager
            .collection('annotations')
            .createObject(DATA.ANNOT_1)
        await device.storageManager
            .collection('annotations')
            .createObject(DATA.ANNOT_2)
        await device.storageManager
            .collection('annotationPrivacyLevels')
            .createObject({
                annotation: DATA.ANNOT_1.url,
                privacyLevel: AnnotationPrivacyLevels.SHARED,
                createdWhen: new Date(),
            })

        const { ribbon, annotationsCache } = await setupTest(device, {
            dependencies: { getPageUrl: () => fullPageUrl },
        })

        const expectListEntries = async (listIds: number[]) => {
            expect(
                await device.storageManager
                    .collection('pageListEntries')
                    .findAllObjects({}),
            ).toEqual(
                listIds.map((listId) =>
                    expect.objectContaining({ listId, fullUrl: fullPageUrl }),
                ),
            )
            expect(ribbon.state.lists.pageListIds).toEqual(listIds)
        }

        await ribbon.init()
        await annotationsCache.load(fullPageUrl)

        await expectListEntries([])
        expect(annotationsCache.annotations).toEqual([
            expect.objectContaining({
                url: DATA.ANNOT_1.url,
                isShared: true,
                lists: [],
            }),
            expect.objectContaining({
                url: DATA.ANNOT_2.url,
                isShared: false,
                lists: [],
            }),
        ])

        await ribbon.processEvent('updateLists', {
            value: {
                added: DATA.LISTS_1[0].id,
                selected: [],
                deleted: null,
                skipPageIndexing: true,
            },
        })

        await expectListEntries([DATA.LISTS_1[0].id])
        expect(annotationsCache.annotations).toEqual([
            expect.objectContaining({
                url: DATA.ANNOT_1.url,
                isShared: true,
                lists: [DATA.LISTS_1[0].id],
            }),
            expect.objectContaining({
                url: DATA.ANNOT_2.url,
                isShared: false,
                lists: [],
            }),
        ])

        await ribbon.processEvent('updateLists', {
            value: {
                added: DATA.LISTS_1[1].id,
                selected: [],
                deleted: null,
                skipPageIndexing: true,
            },
        })

        await expectListEntries([DATA.LISTS_1[0].id, DATA.LISTS_1[1].id])
        expect(annotationsCache.annotations).toEqual([
            expect.objectContaining({
                url: DATA.ANNOT_1.url,
                isShared: true,
                lists: [DATA.LISTS_1[0].id],
            }),
            expect.objectContaining({
                url: DATA.ANNOT_2.url,
                isShared: false,
                lists: [],
            }),
        ])

        await ribbon.processEvent('updateLists', {
            value: {
                deleted: DATA.LISTS_1[0].id,
                selected: [],
                added: null,
                skipPageIndexing: true,
            },
        })

        await expectListEntries([DATA.LISTS_1[1].id])
        expect(annotationsCache.annotations).toEqual([
            expect.objectContaining({
                url: DATA.ANNOT_1.url,
                isShared: true,
                lists: [],
            }),
            expect.objectContaining({
                url: DATA.ANNOT_2.url,
                isShared: false,
                lists: [],
            }),
        ])

        await ribbon.processEvent('updateLists', {
            value: {
                deleted: DATA.LISTS_1[1].id,
                selected: [],
                added: null,
                skipPageIndexing: true,
            },
        })

        await expectListEntries([])
        expect(annotationsCache.annotations).toEqual([
            expect.objectContaining({
                url: DATA.ANNOT_1.url,
                isShared: true,
                lists: [],
            }),
            expect.objectContaining({
                url: DATA.ANNOT_2.url,
                isShared: false,
                lists: [],
            }),
        ])
    })

    it('should save a private comment', async ({ device }) => {
        const { ribbon, ribbonLogic } = await setupTest(device)
        const COMMENT_TEXT = 'comment'

        await ribbon.init()
        expect(ribbon.state.commentBox).toEqual(
            INITIAL_RIBBON_COMMENT_BOX_STATE,
        )

        await ribbon.processEvent('setShowCommentBox', { value: true })
        expect(ribbon.state.commentBox).toEqual({
            ...INITIAL_RIBBON_COMMENT_BOX_STATE,
            showCommentBox: true,
        })
        await ribbon.processEvent('changeComment', { value: COMMENT_TEXT })
        expect(ribbon.state.commentBox.commentText).toEqual(COMMENT_TEXT)

        ribbonLogic.commentSavedTimeout = 1
        await ribbon.processEvent('saveComment', {
            shouldShare: false,
        })

        expect(ribbon.state.commentBox).toEqual({
            ...INITIAL_RIBBON_COMMENT_BOX_STATE,
        })
        const [savedAnnotation] = (await device.storageManager
            .collection('annotations')
            .findObjects({})) as Annotation[]

        expect(savedAnnotation).toEqual(
            expect.objectContaining({
                comment: COMMENT_TEXT,
                pageTitle: 'Foo.com: Home',
                pageUrl: 'foo.com',
            }),
        )

        expect(
            await device.storageManager
                .collection('sharedAnnotationMetadata')
                .findObjects({}),
        ).toEqual([])

        expect(
            await device.storageManager
                .collection('annotationPrivacyLevels')
                .findObjects({}),
        ).toEqual([
            expect.objectContaining({
                annotation: savedAnnotation.url,
                privacyLevel: AnnotationPrivacyLevels.PRIVATE,
            }),
        ])

        expect(
            await device.storageManager.collection('tags').findObjects({}),
        ).toEqual([])
    })

    it('should save a private comment, in protected mode', async ({
        device,
    }) => {
        const { ribbon, ribbonLogic } = await setupTest(device)
        const COMMENT_TEXT = 'comment'

        await ribbon.init()
        expect(ribbon.state.commentBox).toEqual(
            INITIAL_RIBBON_COMMENT_BOX_STATE,
        )

        await ribbon.processEvent('setShowCommentBox', { value: true })
        expect(ribbon.state.commentBox).toEqual({
            ...INITIAL_RIBBON_COMMENT_BOX_STATE,
            showCommentBox: true,
        })
        await ribbon.processEvent('changeComment', { value: COMMENT_TEXT })
        expect(ribbon.state.commentBox.commentText).toEqual(COMMENT_TEXT)

        ribbonLogic.commentSavedTimeout = 1
        await ribbon.processEvent('saveComment', {
            shouldShare: false,
            isProtected: true,
        })

        expect(ribbon.state.commentBox).toEqual({
            ...INITIAL_RIBBON_COMMENT_BOX_STATE,
        })

        const [savedAnnotation] = (await device.storageManager
            .collection('annotations')
            .findObjects({})) as Annotation[]

        expect(savedAnnotation).toEqual(
            expect.objectContaining({
                comment: COMMENT_TEXT,
                pageTitle: 'Foo.com: Home',
                pageUrl: 'foo.com',
            }),
        )

        expect(
            await device.storageManager
                .collection('sharedAnnotationMetadata')
                .findObjects({}),
        ).toEqual([])

        expect(
            await device.storageManager
                .collection('annotationPrivacyLevels')
                .findObjects({}),
        ).toEqual([
            expect.objectContaining({
                privacyLevel: AnnotationPrivacyLevels.PROTECTED,
                annotation: savedAnnotation.url,
            }),
        ])

        expect(
            await device.storageManager.collection('tags').findObjects({}),
        ).toEqual([])
    })

    it('should save a private comment, with tags', async ({ device }) => {
        const { ribbon, ribbonLogic } = await setupTest(device)
        const COMMENT_TEXT = 'comment'
        const TAGS = ['a', 'b', 'c']

        await ribbon.init()
        expect(ribbon.state.commentBox).toEqual(
            INITIAL_RIBBON_COMMENT_BOX_STATE,
        )

        await ribbon.processEvent('setShowCommentBox', { value: true })
        expect(ribbon.state.commentBox).toEqual({
            ...INITIAL_RIBBON_COMMENT_BOX_STATE,
            showCommentBox: true,
        })
        await ribbon.processEvent('changeComment', { value: COMMENT_TEXT })
        expect(ribbon.state.commentBox.commentText).toEqual(COMMENT_TEXT)
        await ribbon.processEvent('updateCommentBoxTags', { value: TAGS })
        expect(ribbon.state.commentBox.tags).toEqual(TAGS)

        ribbonLogic.commentSavedTimeout = 1
        await ribbon.processEvent('saveComment', {
            shouldShare: false,
        })

        expect(ribbon.state.commentBox).toEqual({
            ...INITIAL_RIBBON_COMMENT_BOX_STATE,
        })

        const annotations: Annotation[] = await device.storageManager
            .collection('annotations')
            .findObjects({})

        expect(annotations).toEqual([
            expect.objectContaining({
                comment: COMMENT_TEXT,
                pageTitle: 'Foo.com: Home',
                pageUrl: 'foo.com',
            }),
        ])

        expect(
            await device.storageManager
                .collection('sharedAnnotationMetadata')
                .findObjects({}),
        ).toEqual([])

        expect(
            await device.storageManager
                .collection('annotationPrivacyLevels')
                .findObjects({}),
        ).toEqual([
            expect.objectContaining({
                annotation: annotations[0].url,
                privacyLevel: AnnotationPrivacyLevels.PRIVATE,
            }),
        ])

        expect(
            await device.storageManager.collection('tags').findObjects({}),
        ).toEqual(
            expect.arrayContaining([
                { url: annotations[0].url, name: TAGS[0] },
                { url: annotations[0].url, name: TAGS[1] },
                { url: annotations[0].url, name: TAGS[2] },
            ]),
        )
    })

    it('should save a comment and share it', async ({ device }) => {
        const { ribbon, ribbonLogic } = await setupTest(device)
        const COMMENT_TEXT = 'comment'

        await ribbon.init()
        expect(ribbon.state.commentBox).toEqual(
            INITIAL_RIBBON_COMMENT_BOX_STATE,
        )

        await ribbon.processEvent('setShowCommentBox', { value: true })
        expect(ribbon.state.commentBox).toEqual({
            ...INITIAL_RIBBON_COMMENT_BOX_STATE,
            showCommentBox: true,
        })
        await ribbon.processEvent('changeComment', { value: COMMENT_TEXT })
        expect(ribbon.state.commentBox.commentText).toEqual(COMMENT_TEXT)

        ribbonLogic.commentSavedTimeout = 1
        await ribbon.processEvent('saveComment', {
            shouldShare: true,
        })

        expect(ribbon.state.commentBox).toEqual({
            ...INITIAL_RIBBON_COMMENT_BOX_STATE,
        })

        const [savedAnnotation] = (await device.storageManager
            .collection('annotations')
            .findObjects({})) as Annotation[]

        expect(savedAnnotation).toEqual(
            expect.objectContaining({
                comment: COMMENT_TEXT,
                pageTitle: 'Foo.com: Home',
                pageUrl: 'foo.com',
            }),
        )

        expect(
            await device.storageManager
                .collection('sharedAnnotationMetadata')
                .findObjects({}),
        ).toEqual([
            {
                localId: savedAnnotation.url,
                remoteId: expect.any(String),
                excludeFromLists: false,
            },
        ])

        expect(
            await device.storageManager
                .collection('annotationPrivacyLevels')
                .findObjects({}),
        ).toEqual([
            {
                id: expect.any(Number),
                annotation: savedAnnotation.url,
                privacyLevel: AnnotationPrivacyLevels.SHARED,
                createdWhen: expect.any(Date),
            },
        ])

        expect(
            await device.storageManager.collection('tags').findObjects({}),
        ).toEqual([])
    })

    it('should save a comment and share it, in protected mode', async ({
        device,
    }) => {
        const { ribbon, ribbonLogic } = await setupTest(device)
        const COMMENT_TEXT = 'comment'

        await ribbon.init()
        expect(ribbon.state.commentBox).toEqual(
            INITIAL_RIBBON_COMMENT_BOX_STATE,
        )

        await ribbon.processEvent('setShowCommentBox', { value: true })
        expect(ribbon.state.commentBox).toEqual({
            ...INITIAL_RIBBON_COMMENT_BOX_STATE,
            showCommentBox: true,
        })
        await ribbon.processEvent('changeComment', { value: COMMENT_TEXT })
        expect(ribbon.state.commentBox.commentText).toEqual(COMMENT_TEXT)

        ribbonLogic.commentSavedTimeout = 1
        await ribbon.processEvent('saveComment', {
            shouldShare: true,
            isProtected: true,
        })

        expect(ribbon.state.commentBox).toEqual({
            ...INITIAL_RIBBON_COMMENT_BOX_STATE,
        })

        const [savedAnnotation] = (await device.storageManager
            .collection('annotations')
            .findObjects({})) as Annotation[]

        expect(savedAnnotation).toEqual(
            expect.objectContaining({
                comment: COMMENT_TEXT,
                pageTitle: 'Foo.com: Home',
                pageUrl: 'foo.com',
            }),
        )

        expect(
            await device.storageManager
                .collection('sharedAnnotationMetadata')
                .findObjects({}),
        ).toEqual([
            {
                localId: savedAnnotation.url,
                remoteId: expect.any(String),
                excludeFromLists: false,
            },
        ])

        expect(
            await device.storageManager
                .collection('annotationPrivacyLevels')
                .findObjects({}),
        ).toEqual([
            {
                id: expect.any(Number),
                annotation: savedAnnotation.url,
                privacyLevel: AnnotationPrivacyLevels.SHARED_PROTECTED,
                createdWhen: expect.any(Date),
            },
        ])

        expect(
            await device.storageManager.collection('tags').findObjects({}),
        ).toEqual([])
    })

    it('should be able to set focus on comment box', async ({ device }) => {
        let isCreateFormFocused = false

        const { ribbon } = await setupTest(device, {
            dependencies: {
                focusCreateForm: () => {
                    isCreateFormFocused = true
                },
            },
        })

        await ribbon.init()

        expect(isCreateFormFocused).toBe(false)
        await ribbon.processEvent('setShowCommentBox', { value: false })
        expect(isCreateFormFocused).toBe(false)
        await ribbon.processEvent('setShowCommentBox', { value: true })
        expect(isCreateFormFocused).toBe(true)
    })

    it('should fire event on adding add new tags', async ({ device }) => {
        let addedTag: string
        const { ribbon, analytics } = await setupTest(device, {
            dependencies: {
                tags: {
                    ...device.backgroundModules.tags.remoteFunctions,
                    updateTagForPage: ({ added }) => {
                        addedTag = added
                    },
                } as any,
            },
        })

        await ribbon.init()

        expect(addedTag).toEqual(undefined)
        expect(analytics.popNew()).toEqual([])

        await ribbon.processEvent('updateTags', {
            value: { added: 'test', deleted: null, selected: [] },
        })

        expect(addedTag).toEqual('test')
        expect(analytics.popNew()).toEqual([
            {
                eventArgs: {
                    category: 'Tags',
                    action: 'createForPageViaRibbon',
                },
            },
        ])
    })

    it('should rehydrate state on URL change', async ({ device }) => {
        const pageBookmarksMockDB: { [url: string]: boolean } = {}

        device.backgroundModules.bookmarks.remoteFunctions = {
            pageHasBookmark: async (url) => pageBookmarksMockDB[url] ?? false,
            addPageBookmark: async (args) => {
                pageBookmarksMockDB[args.url] = true
            },
            delPageBookmark: async (args) => {
                pageBookmarksMockDB[args.url] = false
            },
        }

        const newURL = 'https://www.newurl.com'

        const { ribbon } = await setupTest(device)

        await ribbon.init()

        expect(ribbon.state.bookmark.isBookmarked).toBe(false)
        await ribbon.processEvent('toggleBookmark', null)
        expect(ribbon.state.bookmark.isBookmarked).toBe(true)

        expect(ribbon.state.pageUrl).not.toEqual(newURL)
        await ribbon.processEvent('hydrateStateFromDB', { url: newURL })
        expect(ribbon.state.bookmark.isBookmarked).toBe(false)
        expect(ribbon.state.pageUrl).toEqual(newURL)
    })

    it('should check whether tags migration is done to signal showing of tags UI on init', async ({
        device,
    }) => {
        const { ribbon, syncSettings } = await setupTest(device)

        await syncSettings.extension.set('areTagsMigratedToSpaces', false)
        expect(ribbon.state.tagging.shouldShowTagsUIs).toBe(false)
        await ribbon.init()
        expect(ribbon.state.tagging.shouldShowTagsUIs).toBe(true)

        await syncSettings.extension.set('areTagsMigratedToSpaces', true)
        expect(ribbon.state.tagging.shouldShowTagsUIs).toBe(true)
        await ribbon.init()
        expect(ribbon.state.tagging.shouldShowTagsUIs).toBe(false)
    })
})
