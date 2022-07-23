import { featuresBeta } from 'src/util/remote-functions-background'
import { TaskState } from 'ui-logic-core/lib/types'

import React from 'react'
import {
    TypographyHeadingBig,
    TypographyHeadingNormal,
    TypographyHeadingBigger,
    TypographyLink,
    TypographyTextNormal,
} from 'src/common-ui/components/design-library/typography'
import { withCurrentUser } from 'src/authentication/components/AuthConnector'
import { AuthContextInterface } from 'src/authentication/background/types'
import { connect } from 'react-redux'
import { show } from 'src/overview/modals/actions'
import { auth, subscription } from 'src/util/remote-functions-background'
import { SecondaryAction } from 'src/common-ui/components/design-library/actions/SecondaryAction'

const settingsStyle = require('src/options/settings/components/settings.css')
import {
    UserBetaFeature,
    UserBetaFeatureId,
} from 'src/features/background/feature-beta'
import { acts as resultsActs } from 'src/overview/results'
import { default as PDFSetting } from 'src/options/PDF'

interface Props {
    showSubscriptionModal: () => void
    toggleBetaFeatures: (val: boolean) => void
    showBetaFeatureNotifModal: () => void
}

interface State {
    featureOptions: UserBetaFeature[]
    featureEnabled: { [key in UserBetaFeatureId]: boolean }
    loadingChargebee: boolean
    loadState: TaskState
    displayName?: string
    newDisplayName?: string
    updateProfileState: TaskState
}

class BetaFeaturesScreen extends React.Component<
    AuthContextInterface & Props,
    State
> {
    state = {
        loadState: 'running',
        featureOptions: {},
        featureEnabled: {},
        loadingChargebee: false,
        updateProfileState: 'pristine',
    } as State

    componentDidMount = async () => {
        await this.refreshFeatures()
        this.getDisplayName()

        this.setState({
            loadState: 'success',
        })
    }

    async getDisplayName() {
        this.setState({ loadState: 'running' })
        try {
            const profile = await auth.getUserProfile()
            this.setState({
                loadState: 'success',
                displayName: profile?.displayName ?? undefined,
            })
        } catch (e) {
            this.setState({ loadState: 'error' })
            throw e
        }
    }

    updateDisplayName = async () => {
        this.setState({
            updateProfileState: 'running',
        })
        try {
            await auth.updateUserProfile({
                displayName: this.state.newDisplayName,
            })
            this.setState({
                updateProfileState: 'success',
                displayName: this.state.newDisplayName,
                newDisplayName: undefined,
            })
        } catch (e) {
            this.setState({
                updateProfileState: 'error',
            })
            throw e
        }
    }

    openPortal = async () => {
        this.setState({
            loadingChargebee: true,
        })
        const portalLink = await subscription.getManageLink()
        window.open(portalLink['access_url'])
        this.setState({
            loadingChargebee: false,
        })
    }

    refreshFeatures = async () => {
        const featureOptions = await featuresBeta.getFeatures()
        const featureEnabled = {
            'sharing-collections': true,
            'pdf-annotations': true,
        }
        Object.values(featureOptions).forEach(
            (f) => (featureEnabled[f.id] = f.enabled),
        )
        this.setState({ featureOptions, featureEnabled })
    }

    toggleFeature = (feature) => async () => {
        await featuresBeta.toggleFeature(feature)
        await this.refreshFeatures()
    }

    render() {
        return (
            <div>
                <section className={settingsStyle.section}>
                    <div className={settingsStyle.titleBox}>
                        <div className={settingsStyle.titleArea}>
                            <TypographyHeadingBigger>
                                Beta Features
                            </TypographyHeadingBigger>

                            {this.state.loadState === 'success' ? (
                                <TypographyTextNormal>
                                    👍 You're set up for using the beta
                                    features.
                                    <br />
                                </TypographyTextNormal>
                            ) : (
                                <div>
                                    <TypographyTextNormal>
                                        Access beta features by
                                        <TypographyLink
                                            onClick={
                                                this.props
                                                    .showBetaFeatureNotifModal
                                            }
                                        >
                                            requesting free access via a wait
                                            list.
                                        </TypographyLink>
                                    </TypographyTextNormal>
                                </div>
                            )}
                        </div>
                        <div className={settingsStyle.buttonBox}>
                            <SecondaryAction
                                onClick={() =>
                                    window.open(
                                        'https://worldbrain.io/feedback',
                                    )
                                }
                                label={'Send Feedback'}
                            />
                        </div>
                    </div>
                </section>
                <section>
                    <div className={settingsStyle.titleSpace}>
                        <TypographyHeadingBig>
                            Available Beta Features
                        </TypographyHeadingBig>
                    </div>
                    {Object.values(this.state.featureOptions)?.map(
                        (feature) => (
                            <div>
                                {feature.available === true && (
                                    <section className={settingsStyle.listItem}>
                                        <div
                                            className={
                                                settingsStyle.featureBlock
                                            }
                                            key={`key-beta-${feature.id}`}
                                        >
                                            <div
                                                className={
                                                    settingsStyle.featureContent
                                                }
                                            >
                                                <TypographyHeadingNormal>
                                                    {feature.name}
                                                </TypographyHeadingNormal>
                                                <TypographyTextNormal>
                                                    {feature.description}
                                                </TypographyTextNormal>
                                            </div>
                                            <div
                                                className={
                                                    settingsStyle.buttonArea
                                                }
                                            >
                                                {feature.link && (
                                                    <div
                                                        className={
                                                            settingsStyle.readMoreButton
                                                        }
                                                        onClick={() => {
                                                            window.open(
                                                                feature.link,
                                                            )
                                                        }}
                                                    >
                                                        Read More
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {feature.id === 'pdf-annotations' &&
                                            this.state.loadState ===
                                                'success' && <PDFSetting />}
                                    </section>
                                )}
                            </div>
                        ),
                    )}
                    <TypographyHeadingBig>In Development</TypographyHeadingBig>
                    {Object.values(this.state.featureOptions)?.map(
                        (feature) => (
                            <div>
                                {!feature.available && (
                                    <div>
                                        <section
                                            className={settingsStyle.listItem}
                                        >
                                            <div
                                                className={
                                                    settingsStyle.featureBlock
                                                }
                                                key={`key-beta-${feature.id}`}
                                            >
                                                <div
                                                    className={
                                                        settingsStyle.featureContent
                                                    }
                                                >
                                                    <TypographyHeadingNormal>
                                                        {feature.name}
                                                    </TypographyHeadingNormal>
                                                    <TypographyTextNormal>
                                                        {feature.description}
                                                    </TypographyTextNormal>
                                                </div>
                                                <div
                                                    className={
                                                        settingsStyle.buttonArea
                                                    }
                                                >
                                                    {feature.link && (
                                                        <div
                                                            className={
                                                                settingsStyle.readMoreButton
                                                            }
                                                            onClick={() => {
                                                                window.open(
                                                                    feature.link,
                                                                )
                                                            }}
                                                        >
                                                            Read More
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>
                                    </div>
                                )}
                            </div>
                        ),
                    )}
                </section>
            </div>
        )
    }
}

export default connect(null, (dispatch) => ({
    showSubscriptionModal: () => dispatch(show({ modalId: 'Subscription' })),
    toggleBetaFeatures: (val) => dispatch(resultsActs.setBetaFeatures(val)),
    showBetaFeatureNotifModal: () =>
        dispatch(
            show({
                modalId: 'BetaFeatureNotifModal',
                options: { initWithAuth: true },
            }),
        ),
}))(withCurrentUser(BetaFeaturesScreen))
