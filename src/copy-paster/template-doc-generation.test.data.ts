import { normalizeUrl } from '@worldbrain/memex-url-utils'
import {
    FingerprintSchemeType,
    ContentLocatorFormat,
    LocationSchemeType,
    ContentLocatorType,
} from '@worldbrain/memex-common/lib/personal-cloud/storage/types'

export const testPageAUrl = 'https://test.com'
export const testPageATags = ['a', 'b', 'c']
export const testPageASpaces = ['space 1', 'space 2', 'spacespace']
export const testPageAPrivateSpaces = ['private space']
export const testPageA = {
    url: normalizeUrl(testPageAUrl),
    fullUrl: testPageAUrl,
    fullTitle: 'test page A title',
}
export const testPageACreatedAt = new Date('2022-05-06T00:30')

export const testPageBUrl = 'https://test.com/sub'
export const testPageBTags = ['a', 'test']
export const testPageBSpaces = ['space 1', 'test']
export const testPageB = {
    url: normalizeUrl(testPageBUrl),
    fullUrl: testPageBUrl,
    fullTitle: 'test page B title',
}
export const testPageBCreatedAt = new Date('2022-05-06T00:35')

export const testPageCUrl = 'https://memex.cloud/ct/test-fingerprint-a.pdf'
export const testPageCTags = ['ttt']
export const testPageCSpaces = ['space 2']
export const testPageC = {
    url: normalizeUrl(testPageCUrl),
    fullUrl: testPageCUrl,
    fullTitle: 'test PDF C title',
}
export const testPageCCreatedAt = new Date('2022-05-06T00:40')
export const testLocatorC = {
    normalizedUrl: testPageC.url,
    location: 'test.com/test.pdf',
    originalLocation: 'https://test.com/test.pdf',
    fingerprint: 'test-fingerprint-a',
    fingerprintScheme: FingerprintSchemeType.PdfV1,
    format: ContentLocatorFormat.PDF,
    lastVisited: 1641443837993,
    locationScheme: LocationSchemeType.FilesystemPathV1,
    locationType: ContentLocatorType.Remote,
    primary: true,
    valid: true,
    version: 0,
}

// Children of page A
export const testAnnotationAUrl = testPageA.url + '#1'
export const testAnnotationATags = ['a', 'tag']
export const testAnnotationASpaces = [
    'test',
    'space 1',
    'space 2',
    'spacespace',
]
export const testAnnotationAText = 'this is a comment on the annotation'
export const testAnnotationACreatedAt = new Date('2022-05-06T01:00')
export const testAnnotationBUrl = testPageA.url + '#2'
export const testAnnotationBTags = ['a']
export const testAnnotationBSpaces = ['space 1']
export const testAnnotationBHighlight = 'this is a highlight from the webpage'
export const testAnnotationBCreatedAt = new Date('2022-05-06T01:05')

// Children of page B
export const testAnnotationCUrl = testPageB.url + '#3'
export const testAnnotationCTags = ['z']
export const testAnnotationCSpaces = []
export const testAnnotationCHighlight =
    'this is another highlight from a webpage'
export const testAnnotationCCreatedAt = new Date('2022-05-06T01:10')

// Children of page C
export const testAnnotationDUrl = testPageC.url + '#3'
export const testAnnotationDTags = ['t1', 't2']
export const testAnnotationDSpaces = ['space 2']
export const testAnnotationDHighlight = 'this is another highlight from a PDF'
export const testAnnotationDCreatedAt = new Date('2022-05-06T01:15')
