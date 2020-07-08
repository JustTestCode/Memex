import { Annotation } from 'src/annotations/types'
import TypedEventEmitter from 'typed-emitter'
import { Observable } from 'rxjs'

export interface AnnotationCacheChanges {
    created: (annotation: Annotation) => void
    updated: (annotation: Annotation) => void
    deleted: (annotation: Annotation) => void
    newState: (annotation: Annotation[]) => void
    load: (annotation: Annotation[]) => void
    rollback: (annotations: Annotation[]) => void
}

export interface AnnotationsCacheDependencies {
    backendOperations?: {
        load: (url) => Promise<Annotation[]> // url should become one concrete example of a contentFingerprint to load annotations for
        create: (annotation: Annotation) => Promise<void>
        update: (annotation: Annotation) => Promise<void>
        updateTags: (
            annotationUrl: Annotation['url'],
            tags: Annotation['tags'],
        ) => Promise<void>
        delete: (annotation: Annotation) => Promise<void>
    }
}

export interface AnnotationsCacheInterface {
    load: (url) => Promise<void>
    create: (annotation: Annotation) => void
    update: (annotation: Annotation) => void
    delete: (annotation: Annotation) => void

    annotations: Observable<Annotation[]>
}

export class AnnotationsCache implements AnnotationsCacheInterface {
    private _annotations: Annotation[]
    public annotationChanges: TypedEventEmitter<AnnotationCacheChanges>

    constructor(private dependencies: AnnotationsCacheDependencies) {}

    load = async (url) => {
        this._annotations = await this.dependencies.backendOperations.load(url)
        this.annotationChanges.emit('load', this._annotations)
    }

    get annotations() {
        return new Observable<Annotation[]>((subscriber) => {
            subscriber.next(this._annotations)
            this.annotationChanges.on('load', (annotations) => {
                subscriber.next(annotations)
            })
        })
    }

    create = (annotation: Annotation) => {
        const stateBeforeModifications = this._annotations
        this._annotations.push(annotation)
        this.annotationChanges.emit('created', annotation)
        this.annotationChanges.emit('newState', this._annotations)

        const asyncUpstream = async () => {
            try {
                await this.dependencies.backendOperations.create(annotation)
            } catch (e) {
                this._annotations = stateBeforeModifications
                this.annotationChanges.emit(
                    'rollback',
                    stateBeforeModifications,
                )
                throw e
            }
        }
        asyncUpstream().then(() => true)
    }

    update = (annotation: Annotation) => {
        const stateBeforeModifications = this._annotations

        const resultIndex = this._annotations.findIndex(
            (existingAnnotation) => existingAnnotation.url === annotation.url,
        )

        this._annotations = [
            ...this._annotations.slice(0, resultIndex),
            annotation,
            ...this._annotations.slice(resultIndex + 1),
        ]

        this.annotationChanges.emit('updated', annotation)
        this.annotationChanges.emit('newState', this._annotations)

        const asyncUpstream = async () => {
            try {
                await this.dependencies.backendOperations.update(annotation)
                await this.dependencies.backendOperations.updateTags(
                    annotation.url,
                    annotation.tags,
                )
            } catch (e) {
                this._annotations = stateBeforeModifications
                this.annotationChanges.emit(
                    'rollback',
                    stateBeforeModifications,
                )
                throw e
            }
        }
        asyncUpstream().then(() => true)
    }

    delete = (annotation: Annotation) => {
        const stateBeforeModifications = this._annotations

        const resultIndex = this._annotations.findIndex(
            (existingAnnotation) => existingAnnotation.url === annotation.url,
        )

        this._annotations = [
            ...this._annotations.slice(0, resultIndex),
            ...this._annotations.slice(resultIndex + 1),
        ]

        this.annotationChanges.emit('deleted', annotation)
        this.annotationChanges.emit('newState', this._annotations)

        const asyncUpstream = async () => {
            try {
                await this.dependencies.backendOperations.delete(annotation)
            } catch (e) {
                this._annotations = stateBeforeModifications
                this.annotationChanges.emit(
                    'rollback',
                    stateBeforeModifications,
                )
                throw e
            }
        }
        asyncUpstream().then(() => true)
    }
}
