import { Storage } from 'webextension-polyfill-ts'

import { Template } from '../types'
import CopyPasterBackground from '.'

export const PERFORMED_STORAGE_FLAG = '@TextExport-default_templates_inserted_1'

export const JUST_URL: Template = {
    id: 1,
    title: 'Page URL',
    isFavourite: false,
    code: `{{{PageUrl}}}`,
}

export const URL_AND_TITLE: Template = {
    id: 2,
    title: 'Page URL & Title',
    isFavourite: false,
    code: `{{{PageTitle}}}
{{{PageUrl}}}`,
}

export const ROAM_MD_TEMPLATE: Template = {
    id: 3,
    title: 'Roam Markdown',
    isFavourite: false,
    code: `[[{{{PageTitle}}}]]
  url:: {{{PageUrl}}}
{{#Notes}}
  ^^{{{NoteHighlight}}}^^ {{{NoteTags}}}
    {{{NoteText}}}
{{/Notes}}
`,
}

export const NOTION_MD_TEMPLATE: Template = {
    id: 4,
    title: 'Notion Markdown',
    isFavourite: false,
    code: `[{{{PageTitle}}}]({{{PageUrl}}})
{{#Notes}}
- {{{NoteHighlight}}}
  {{{NoteSpaces}}}
  {{{NoteText}}}
{{/Notes}}
`,
}

export const HTML_TEMPLATE: Template = {
    id: 5,
    title: 'HTML',
    isFavourite: false,
    code: `<a target="_blank"  href="{{{PageUrl}}}">{{{PageTitle}}}</a>
<ul>
{{#Notes}}
<li>
<p style="font-style: italic">
"{{{NoteHighlight}}}"
</p>
<p>
{{{NoteText}}}
</p>
</li>
{{/Notes}}
</ul>
`,
}

const DEFAULT_TEMPLATES = [
    HTML_TEMPLATE,
    ROAM_MD_TEMPLATE,
    NOTION_MD_TEMPLATE,
    JUST_URL,
    URL_AND_TITLE,
]

export default async function insertDefaultTemplates({
    copyPaster,
    localStorage,
    templates = DEFAULT_TEMPLATES,
}: {
    copyPaster: CopyPasterBackground
    localStorage: Storage.LocalStorageArea
    templates?: Template[]
}) {
    const alreadyPerformed = (await localStorage.get(PERFORMED_STORAGE_FLAG))[
        PERFORMED_STORAGE_FLAG
    ]

    if (alreadyPerformed) {
        return
    }

    for (const template of templates) {
        await copyPaster.storage.__createTemplateWithId(template)
    }

    await localStorage.set({ [PERFORMED_STORAGE_FLAG]: true })
}
