export interface Template {
    id: number
    title: string
    code: string
    isFavourite: boolean
}

export type TemplateDoc = {
    Notes?: Array<TemplateDocNote>
    Pages?: Array<TemplateDocPage>
} & TemplateDocPage &
    TemplateDocNote

export type TemplateDocKey = keyof (Omit<TemplateDocPage, 'Notes'> &
    TemplateDocNote)

export interface TemplateDocPage {
    PageUrl?: string
    PageTitle?: string
    PageTags?: string
    PageTagList?: string[]
    PageSpaces?: string
    PageSpacesList?: string[]
    PageCreatedAt?: string
    PageLink?: string
    Notes?: TemplateDocNote[]

    // For backward compatibility
    url?: string
    title?: string
    tags?: string[]
}

export interface TemplateDocNote {
    NoteHighlight?: string
    NoteText?: string
    NoteTags?: string
    NoteTagList?: string[]
    NoteSpaces?: string
    NoteSpacesList?: string[]
    NoteCreatedAt?: string
    NoteLink?: string
}

export interface TemplateAnalysis {
    usesLegacyTags: boolean
    expectedContext: 'note' | 'page' | 'page-list'
    requirements: TemplateRequirements
}

export interface TemplateRequirements {
    page?: boolean
    pageTags?: boolean
    pageSpaces?: boolean
    pageCreatedAt?: boolean
    pageLink?: boolean
    note?: boolean
    noteTags?: boolean
    noteSpaces?: boolean
    noteCreatedAt?: boolean
    noteLink?: boolean
}

export interface TemplateDataFetchers {
    getPages(
        normalizedPageUrls: string[],
    ): Promise<UrlMappedData<PageTemplateData>>
    getNotes(annotationUrls: string[]): Promise<UrlMappedData<NoteTemplateData>>
    getNoteIdsForPages(
        normalizedPageUrls: string[],
    ): Promise<UrlMappedData<string[]>>
    getTagsForNotes(annotationUrls: string[]): Promise<UrlMappedData<string[]>>
    getTagsForPages(
        normalizedPageUrls: string[],
    ): Promise<UrlMappedData<string[]>>
    getSpacesForNotes(
        annotationUrls: string[],
    ): Promise<UrlMappedData<string[]>>
    getSpacesForPages(
        normalizedPageUrls: string[],
    ): Promise<UrlMappedData<string[]>>
    getCreatedAtForPages(
        normalizedPageUrls: string[],
    ): Promise<UrlMappedData<Date>>
    getPageLinks(
        notes: UrlMappedData<{ annotationUrls: string[] }>,
    ): Promise<UrlMappedData<string>>
    getNoteLinks(annotationUrls: string[]): Promise<UrlMappedData<string>>
}

export interface PageTemplateData {
    fullUrl: string
    fullTitle: string
}

export interface NoteTemplateData {
    url: string
    pageUrl: string
    body?: string
    comment?: string
    createdAt: Date
}

export interface UrlMappedData<T> {
    [url: string]: T
}
