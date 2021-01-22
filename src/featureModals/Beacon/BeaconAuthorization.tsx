import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { useTranslation, Trans } from 'react-i18next';
import styled from 'styled-components';
import { BeaconMessageType, OperationResponseInput } from '@airgap/beacon-sdk';
import IconButton from '@material-ui/core/IconButton';
import { BigNumber } from 'bignumber.js';
import { TezosParameterFormat, OperationKindType } from 'conseiljs';
import { JSONPath } from 'jsonpath-plus';

import { beaconClient } from './BeaconMessageRouter';

import Loader from '../../components/Loader';
import PasswordInput from '../../components/PasswordInput';
import Fees from '../../components/Fees';
import Tooltip from '../../components/Tooltip';
import TezosIcon from '../../components/TezosIcon';
import { ms } from '../../styles/helpers';
import { useFetchFees, estimateContractCall } from '../../reduxContent/app/thunks';

import { RootState, ModalState } from '../../types/store';

import { sendTezThunk } from '../../contracts/duck/thunks';
import { invokeAddressThunk } from '../../reduxContent/invoke/thunks';
import { setModalOpen } from '../../reduxContent/modal/actions';
import { setBeaconLoading } from '../../reduxContent/app/actions';
import { createMessageAction } from '../../reduxContent/message/actions';

import { ModalWrapper, ModalContainer, Container, ButtonContainer, InvokeButton, WhiteBtn, Footer } from '../style';
import { knownContractNames, knownMarketMetadata } from '../../constants/Token';

export const PromptContainer = styled.div`
    align-items: center;
    color: #979797;
    display: flex;
    font-size: 24px;
    justify-content: center;
    height: 80px;
    margin-top: 30px;
    width: 100%;
`;

const WrapPassword = styled.div`
    margin-top: 3px;
`;

const TooltipContainer = styled.div`
    padding: 10px;
    color: #000;
    font-size: 14px;
    max-width: 312px;
`;

const TooltipTitle = styled.div`
    font-size: 16px;
    font-weight: 700;
    color: ${({ theme: { colors } }) => colors.primary};
`;

const TooltipContent = styled.div`
    margin-top: 8px;
    font-size: 14px;
    line-height: 21px;
    width: 270px;
    font-weight: 300;
    color: ${({ theme: { colors } }) => colors.black};
`;

const BoldSpan = styled.span`
    font-weight: 500;
`;

const defaultState = {
    amount: '',
    fee: 26_501,
    total: 0,
    balance: 0,
};

const utez = 1_000_000;
const GAS = 64_250;

interface Props {
    open: boolean;
    managerBalance: number;
    onClose: () => void;
}

const BeaconAuthorize = ({ open, managerBalance, onClose }: Props) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedParentHash } = useSelector((rootState: RootState) => rootState.app, shallowEqual);
    const activeModal = useSelector<RootState, string>((state: RootState) => state.modal.activeModal);
    const modalValues = useSelector<RootState, ModalState>((state) => state.modal.values, shallowEqual);
    const operationHash = useSelector<RootState>((state) => state.message.hash) as string;
    const beaconLoading = useSelector((state: RootState) => state.app.beaconLoading);

    const [password, setPassword] = useState('');
    const [operationState, setOperationState] = useState(defaultState);

    const { id, operationDetails, website, network, appMetadata } = modalValues[activeModal];
    const isContract = String(operationDetails[0].destination).startsWith('KT1'); // TODO: // recognize contract call and simple transaction
    const { destination, amount, parameters } = operationDetails[0];
    const operationParameters = parameters || { value: { prim: 'Unit' }, entrypoint: 'default' };

    const { newFees, miniFee, isRevealed } = useFetchFees(OperationKindType.Transaction, true, true);
    const { fee } = estimateContractCall(
        selectedParentHash,
        destination,
        new BigNumber(amount).toNumber(),
        operationParameters.entrypoint,
        JSON.stringify(operationParameters.value)
    );

    const onAuthorize = async () => {
        try {
            dispatch(setBeaconLoading(true));

            // const requiresBurn = await getIsImplicitAndEmptyThunk(operationDetails[0].destination, settings.nodesList, settings.selectedNode);

            // TODO: validate fee against min
            // TODO: validate burn+amount+fee against balance - 1xtz
            // TODO: validate amount > 0 for
            // TODO: validate destination != self

            const formattedAmount = new BigNumber(amount).dividedBy(utez).toString();
            if (isContract) {
                // TODO: errors from here don't always bubble up
                const operationResult = await dispatch(
                    invokeAddressThunk(
                        destination,
                        operationState.fee,
                        formattedAmount,
                        10_000,
                        500_000,
                        JSON.stringify(operationParameters.value),
                        password,
                        selectedParentHash,
                        operationParameters.entrypoint,
                        TezosParameterFormat.Micheline
                    )
                );

                if (!!operationResult) {
                    onClose();
                }

                // TODO: ledger
            } else {
                dispatch(sendTezThunk(password, destination, formattedAmount, operationState.fee));
                // TODO: ledger
            }
        } catch (e) {
            console.log('Transaction.Error', e);
            dispatch(setBeaconLoading(false));
        }
    };

    const updateState = (updatedValues) => {
        setOperationState((prevState) => {
            return { ...prevState, ...updatedValues };
        });
    };

    const changeFee = (newFee) => {
        const float = Number.isNaN(parseFloat(operationState.amount)) ? 0.0 : parseFloat(operationState.amount);
        const numAmount = float * utez;
        const newTotal = numAmount + newFee + GAS;
        const newBalance = managerBalance - operationState.total;
        updateState({ fee: newFee, total: newTotal, balance: newBalance });
    };

    useEffect(() => {
        if (!operationHash || !beaconLoading) {
            return;
        }
        const sendBeaconResponse = async () => {
            try {
                const response: OperationResponseInput = {
                    type: BeaconMessageType.OperationResponse,
                    id,
                    transactionHash: operationHash,
                };
                await beaconClient.respond(response);

                dispatch(setBeaconLoading());
                dispatch(setModalOpen(false, activeModal));
            } catch (e) {
                dispatch(createMessageAction(`Beacon authorization failed with "${e.message}"`, true));
            }
        };

        sendBeaconResponse();
    }, [operationHash, beaconLoading]);

    const renderFeeToolTip = () => {
        return (
            <TooltipContainer>
                <TooltipTitle>{t('components.send.fee_tooltip_title')}</TooltipTitle>
                <TooltipContent>
                    <Trans i18nKey="components.send.fee_tooltip_content">
                        This address is not revealed on the blockchain. We have added
                        <BoldSpan>0.001420 XTZ</BoldSpan> for Public Key Reveal to your regular send operation fee.
                    </Trans>
                </TooltipContent>
            </TooltipContainer>
        );
    };

    const contractName = knownContractNames[operationDetails[0].destination] || operationDetails[0].destination;

    const idTransaction = (transaction) => {
        if (transaction.destination === 'KT19c8n5mWrqpxMcR3J687yssHxotj88nGhZ') {
            // Dexter ETHtz Pool
            if (transaction.parameters.entrypoint === 'xtzToToken') {
                const holder = JSONPath({ path: '$.args[0].string', json: transaction.parameters.value })[0];
                const tokenAmount = new BigNumber(JSONPath({ path: '$.args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy('1000000000000000000')
                    .toFixed();
                const expiration = new Date(JSONPath({ path: '$.args[1].args[1].string', json: transaction.parameters.value })[0]);

                return (
                    <>
                        &nbsp;to receive <strong>{tokenAmount.toString()}</strong> ETHtz at <strong>{holder}</strong>, expiring on{' '}
                        <strong>{expiration.toString()}</strong>
                    </>
                );
            }

            if (transaction.parameters.entrypoint === 'addLiquidity') {
                const holder = JSONPath({ path: '$.args[0].args[0].string', json: transaction.parameters.value })[0];
                // TODO: $.args[0].args[1].int liquidity token balance
                const tokenAmount = new BigNumber(JSONPath({ path: '$.args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy('1000000000000000000')
                    .toFixed();
                const expiration = new Date(JSONPath({ path: '$.args[1].args[1].string', json: transaction.parameters.value })[0]);

                return (
                    <>
                        &nbsp;to add <strong>{tokenAmount.toString()}</strong> ETHtz to the pool from <strong>{holder}</strong>, expiring on{' '}
                        <strong>{expiration.toString()}</strong>
                    </>
                );
            }

            if (transaction.parameters.entrypoint === 'tokenToToken') {
                const targetToken = JSONPath({ path: '$.args[0].args[0].string', json: transaction.parameters.value })[0];
                // const targetName = knownContractNames[targetToken] || targetToken;
                const targetSymbol = knownMarketMetadata.filter((o) => o.address === targetToken)[0].symbol || 'tokens';
                const targetScale = knownMarketMetadata.filter((o) => o.address === targetToken)[0].scale || 0;
                const targetAmount = new BigNumber(JSONPath({ path: '$.args[0].args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy(10 ** targetScale)
                    .toFixed();
                const targetHolder = JSONPath({ path: '$.args[0].args[1].args[1].string', json: transaction.parameters.value })[0];
                const sourceHolder = JSONPath({ path: '$.args[1].args[0].string', json: transaction.parameters.value })[0];
                const sourceAmount = new BigNumber(JSONPath({ path: '$.args[1].args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy('1000000000000000000')
                    .toFixed();
                const expiration = new Date(JSONPath({ path: '$.args[1].args[1].args[1].string', json: transaction.parameters.value })[0]);

                let holderText = '';
                if (targetHolder === sourceHolder) {
                    holderText = `for ${targetHolder}`;
                } else {
                    holderText = `from ${sourceHolder} to ${targetHolder}`;
                }

                return (
                    <>
                        &nbsp;to exchange <strong>{sourceAmount.toString()}</strong> ETHtz for <strong>{targetAmount.toString()}</strong> {targetSymbol}{' '}
                        <strong>{holderText}</strong>, expiring on <strong>{expiration.toString()}</strong>
                    </>
                );
            }

            return undefined;
        }

        if (transaction.destination === 'KT1Puc9St8wdNoGtLiD2WXaHbWU7styaxYhD') {
            // Dexter USDtz Pool
            if (transaction.parameters.entrypoint === 'xtzToToken') {
                const holder = JSONPath({ path: '$.args[0].string', json: transaction.parameters.value })[0];
                const tokenAmount = new BigNumber(JSONPath({ path: '$.args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy('1000000')
                    .toFixed();
                const expiration = new Date(JSONPath({ path: '$.args[1].args[1].string', json: transaction.parameters.value })[0]);

                return (
                    <>
                        &nbsp;to receive <strong>{tokenAmount.toString()}</strong> USDtz at <strong>{holder}</strong>, expiring on{' '}
                        <strong>{expiration.toString()}</strong>
                    </>
                );
            }

            if (transaction.parameters.entrypoint === 'addLiquidity') {
                const holder = JSONPath({ path: '$.args[0].args[0].string', json: transaction.parameters.value })[0];
                // TODO: $.args[0].args[1].int liquidity token balance
                const tokenAmount = new BigNumber(JSONPath({ path: '$.args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy('1000000')
                    .toFixed();
                const expiration = new Date(JSONPath({ path: '$.args[1].args[1].string', json: transaction.parameters.value })[0]);

                return (
                    <>
                        &nbsp;to add <strong>{tokenAmount.toString()}</strong> USDtz to the pool from <strong>{holder}</strong>, expiring on{' '}
                        <strong>{expiration.toString()}</strong>
                    </>
                );
            }

            if (transaction.parameters.entrypoint === 'tokenToToken') {
                const targetToken = JSONPath({ path: '$.args[0].args[0].string', json: transaction.parameters.value })[0];
                // const targetName = knownContractNames[targetToken] || targetToken;
                const targetSymbol = knownMarketMetadata.filter((o) => o.address === targetToken)[0].symbol || 'tokens';
                const targetScale = knownMarketMetadata.filter((o) => o.address === targetToken)[0].scale || 0;
                const targetAmount = new BigNumber(JSONPath({ path: '$.args[0].args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy(10 ** targetScale)
                    .toFixed();
                const targetHolder = JSONPath({ path: '$.args[0].args[1].args[1].string', json: transaction.parameters.value })[0];
                const sourceHolder = JSONPath({ path: '$.args[1].args[0].string', json: transaction.parameters.value })[0];
                const sourceAmount = new BigNumber(JSONPath({ path: '$.args[1].args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy('1000000')
                    .toFixed();
                const expiration = new Date(JSONPath({ path: '$.args[1].args[1].args[1].string', json: transaction.parameters.value })[0]);

                let holderText = '';
                if (targetHolder === sourceHolder) {
                    holderText = `for ${targetHolder}`;
                } else {
                    holderText = `from ${sourceHolder} to ${targetHolder}`;
                }

                return (
                    <>
                        &nbsp;to exchange <strong>{sourceAmount.toString()}</strong> USDtz for <strong>{targetAmount.toString()}</strong> {targetSymbol}{' '}
                        <strong>{holderText}</strong>, expiring on <strong>{expiration.toString()}</strong>
                    </>
                );
            }

            return undefined;
        }

        if (transaction.destination === 'KT1XTXBsEauzcv3uPvVXW92mVqrx99UGsb9T') {
            // Dexter wXTZ Pool
            if (transaction.parameters.entrypoint === 'xtzToToken') {
                const holder = JSONPath({ path: '$.args[0].string', json: transaction.parameters.value })[0];
                const tokenAmount = new BigNumber(JSONPath({ path: '$.args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy('1000000')
                    .toFixed();
                const expiration = new Date(JSONPath({ path: '$.args[1].args[1].string', json: transaction.parameters.value })[0]);

                return (
                    <>
                        &nbsp;to receive <strong>{tokenAmount.toString()}</strong> wXTZ at <strong>{holder}</strong>, expiring on{' '}
                        <strong>{expiration.toString()}</strong>
                    </>
                );
            }

            if (transaction.parameters.entrypoint === 'addLiquidity') {
                const holder = JSONPath({ path: '$.args[0].args[0].string', json: transaction.parameters.value })[0];
                // TODO: $.args[0].args[1].int liquidity token balance
                const tokenAmount = new BigNumber(JSONPath({ path: '$.args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy('1000000')
                    .toFixed();
                const expiration = new Date(JSONPath({ path: '$.args[1].args[1].string', json: transaction.parameters.value })[0]);

                return (
                    <>
                        &nbsp;to add <strong>{tokenAmount.toString()}</strong> wXTZ to the pool from <strong>{holder}</strong>, expiring on{' '}
                        <strong>{expiration.toString()}</strong>
                    </>
                );
            }

            if (transaction.parameters.entrypoint === 'tokenToToken') {
                const targetToken = JSONPath({ path: '$.args[0].args[0].string', json: transaction.parameters.value })[0];
                // const targetName = knownContractNames[targetToken] || targetToken;
                const targetSymbol = knownMarketMetadata.filter((o) => o.address === targetToken)[0].symbol || 'tokens';
                const targetScale = knownMarketMetadata.filter((o) => o.address === targetToken)[0].scale || 0;
                const targetAmount = new BigNumber(JSONPath({ path: '$.args[0].args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy(10 ** targetScale)
                    .toFixed();
                const targetHolder = JSONPath({ path: '$.args[0].args[1].args[1].string', json: transaction.parameters.value })[0];
                const sourceHolder = JSONPath({ path: '$.args[1].args[0].string', json: transaction.parameters.value })[0];
                const sourceAmount = new BigNumber(JSONPath({ path: '$.args[1].args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy('1000000')
                    .toFixed();
                const expiration = new Date(JSONPath({ path: '$.args[1].args[1].args[1].string', json: transaction.parameters.value })[0]);

                let holderText = '';
                if (targetHolder === sourceHolder) {
                    holderText = `for ${targetHolder}`;
                } else {
                    holderText = `from ${sourceHolder} to ${targetHolder}`;
                }

                return (
                    <>
                        &nbsp;to exchange <strong>{sourceAmount.toString()}</strong> wXTZ for <strong>{targetAmount.toString()}</strong> {targetSymbol}{' '}
                        <strong>{holderText}</strong>, expiring on <strong>{expiration.toString()}</strong>
                    </>
                );
            }

            return undefined;
        }

        if (transaction.destination === 'KT1DrJV8vhkdLEj76h1H9Q4irZDqAkMPo1Qf') {
            // Dexter tzBTC Pool
            if (transaction.parameters.entrypoint === 'xtzToToken') {
                const holder = JSONPath({ path: '$.args[0].string', json: transaction.parameters.value })[0];
                const tokenAmount = new BigNumber(JSONPath({ path: '$.args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy('100000000')
                    .toFixed();
                const expiration = new Date(JSONPath({ path: '$.args[1].args[1].string', json: transaction.parameters.value })[0]);

                return (
                    <>
                        &nbsp;to receive <strong>{tokenAmount.toString()}</strong> tzBTC at <strong>{holder}</strong>, expiring on{' '}
                        <strong>{expiration.toString()}</strong>
                    </>
                );
            }

            if (transaction.parameters.entrypoint === 'addLiquidity') {
                const holder = JSONPath({ path: '$.args[0].args[0].string', json: transaction.parameters.value })[0];
                // TODO: $.args[0].args[1].int liquidity token balance
                const tokenAmount = new BigNumber(JSONPath({ path: '$.args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy('100000000')
                    .toFixed();
                const expiration = new Date(JSONPath({ path: '$.args[1].args[1].string', json: transaction.parameters.value })[0]);

                return (
                    <>
                        &nbsp;to add <strong>{tokenAmount.toString()}</strong> tzBTC to the pool from <strong>{holder}</strong>, expiring on{' '}
                        <strong>{expiration.toString()}</strong>
                    </>
                );
            }

            if (transaction.parameters.entrypoint === 'tokenToToken') {
                const targetToken = JSONPath({ path: '$.args[0].args[0].string', json: transaction.parameters.value })[0];
                // const targetName = knownContractNames[targetToken] || targetToken;
                const targetSymbol = knownMarketMetadata.filter((o) => o.address === targetToken)[0].symbol || 'tokens';
                const targetScale = knownMarketMetadata.filter((o) => o.address === targetToken)[0].scale || 0;
                const targetAmount = new BigNumber(JSONPath({ path: '$.args[0].args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy(10 ** targetScale)
                    .toFixed();
                const targetHolder = JSONPath({ path: '$.args[0].args[1].args[1].string', json: transaction.parameters.value })[0];
                const sourceHolder = JSONPath({ path: '$.args[1].args[0].string', json: transaction.parameters.value })[0];
                const sourceAmount = new BigNumber(JSONPath({ path: '$.args[1].args[1].args[0].int', json: transaction.parameters.value })[0])
                    .dividedBy('100000000')
                    .toFixed();
                const expiration = new Date(JSONPath({ path: '$.args[1].args[1].args[1].string', json: transaction.parameters.value })[0]);

                let holderText = '';
                if (targetHolder === sourceHolder) {
                    holderText = `for ${targetHolder}`;
                } else {
                    holderText = `from ${sourceHolder} to ${targetHolder}`;
                }

                return (
                    <>
                        &nbsp;to exchange <strong>{sourceAmount.toString()}</strong> tzBTC for <strong>{targetAmount.toString()}</strong> {targetSymbol}{' '}
                        <strong>{holderText}</strong>, expiring on <strong>{expiration.toString()}</strong>
                    </>
                );
            }

            return undefined;
        }

        if (transaction.destination === 'KT19at7rQUvyjxnZ2fBv7D9zc8rkyG7gAoU8') {
            // ETHtz Token
            if (transaction.parameters.entrypoint === 'approve') {
                let approvedAddress = JSONPath({ path: '$.args[0].string', json: transaction.parameters.value })[0];
                const tokenAmount = new BigNumber(JSONPath({ path: '$.args[1].int', json: transaction.parameters.value })[0])
                    .dividedBy('1000000000000000000')
                    .toFixed();

                approvedAddress = knownContractNames[approvedAddress] || approvedAddress;

                return (
                    <>
                        &nbsp;to approve <strong>{approvedAddress}</strong> for a balance of <strong>{tokenAmount}</strong> ETHtz
                    </>
                );
            }

            // TODO: transfer

            return undefined;
        }

        if (transaction.destination === 'KT1LN4LPSqTMS7Sd2CJw4bbDGRkMv2t68Fy9') {
            // USDtz Token
            if (transaction.parameters.entrypoint === 'approve') {
                let approvedAddress = JSONPath({ path: '$.args[0].string', json: transaction.parameters.value })[0];
                const tokenAmount = new BigNumber(JSONPath({ path: '$.args[1].int', json: transaction.parameters.value })[0]).dividedBy('1000000').toFixed();

                approvedAddress = knownContractNames[approvedAddress] || approvedAddress;

                return (
                    <>
                        &nbsp;to approve <strong>{approvedAddress}</strong> for a balance of <strong>{tokenAmount}</strong> USDtz
                    </>
                );
            }

            // TODO: transfer

            return undefined;
        }

        if (transaction.destination === 'KT1VYsVfmobT7rsMVivvZ4J8i3bPiqz12NaH') {
            // wXTZ Token
            if (transaction.parameters.entrypoint === 'approve') {
                let approvedAddress = JSONPath({ path: '$.args[0].string', json: transaction.parameters.value })[0];
                const tokenAmount = new BigNumber(JSONPath({ path: '$.args[1].int', json: transaction.parameters.value })[0]).dividedBy('1000000').toFixed();

                approvedAddress = knownContractNames[approvedAddress] || approvedAddress;

                return (
                    <>
                        &nbsp;to approve <strong>{approvedAddress}</strong> for a balance of <strong>{tokenAmount}</strong> wXTZ
                    </>
                );
            }

            // TODO: transfer

            return undefined;
        }

        if (transaction.destination === 'KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn') {
            // tzBTC Token
            if (transaction.parameters.entrypoint === 'approve') {
                let approvedAddress = JSONPath({ path: '$.args[0].string', json: transaction.parameters.value })[0];
                const tokenAmount = new BigNumber(JSONPath({ path: '$.args[1].int', json: transaction.parameters.value })[0]).dividedBy('100000000').toFixed();

                approvedAddress = knownContractNames[approvedAddress] || approvedAddress;

                return (
                    <>
                        &nbsp;to approve <strong>{approvedAddress}</strong> for a balance of <strong>{tokenAmount}</strong> tzBTC
                    </>
                );
            }

            // TODO: transfer

            return undefined;
        }

        return undefined;
    };

    return (
        <ModalWrapper open={open}>
            {open ? (
                <ModalContainer>
                    <Container>
                        <div className="modal-holder">
                            {operationDetails.length === 1 && <h3>{t('components.Beacon.authorization.title')}</h3>}
                            {operationDetails.length > 1 && <h3>{t('components.Beacon.authorization.title_plural')}</h3>}
                            <h4>Network: {network.type}</h4>
                            <p className="linkAddress">{website}</p>
                            {!isContract && (
                                <p>
                                    {appMetadata.name} is requesting a transaction of{' '}
                                    <strong>{new BigNumber(operationDetails[0].amount).dividedBy(utez).toNumber().toFixed(6)}</strong>
                                    <strong>XTZ</strong> to <strong>{operationDetails[0].destination}</strong>
                                </p>
                            )}
                            {isContract && (
                                <p>
                                    <strong>{appMetadata.name}</strong> is requesting a contract call to the <strong>{operationParameters.entrypoint}</strong>{' '}
                                    function of <strong>{contractName}</strong>
                                    {new BigNumber(operationDetails[0].amount).toNumber() !== 0 && (
                                        <span>
                                            {' '}
                                            with <strong>{new BigNumber(operationDetails[0].amount).dividedBy(utez).toNumber().toFixed(6)}</strong>{' '}
                                            <strong>XTZ</strong>
                                        </span>
                                    )}
                                    {idTransaction(operationDetails[0]) && idTransaction(operationDetails[0])}
                                    {!idTransaction(operationDetails[0]) && (
                                        <>
                                            &nbsp;with the following parameters: <strong>{JSON.stringify(operationParameters.value)}</strong>
                                        </>
                                    )}
                                </p>
                            )}

                            {isContract && (
                                <div>
                                    <p className="inputLabel">Raw Operation Content</p>
                                    <textarea className="inputField">{JSON.stringify(operationDetails[0], null, 2)}</textarea>
                                </div>
                            )}
                            <div className="feeContainer">
                                <Fees
                                    low={isContract ? fee : newFees.low}
                                    medium={newFees.medium}
                                    high={newFees.high}
                                    fee={operationState.fee}
                                    miniFee={miniFee}
                                    onChange={changeFee}
                                    tooltip={
                                        !isRevealed ? (
                                            <Tooltip position="bottom" content={renderFeeToolTip()}>
                                                <IconButton size="small">
                                                    <TezosIcon iconName="help" size={ms(1)} color="gray5" />
                                                </IconButton>
                                            </Tooltip>
                                        ) : null
                                    }
                                />
                            </div>
                            <WrapPassword>
                                <PasswordInput label={t('general.nouns.wallet_password')} password={password} onChange={(pwd) => setPassword(pwd)} />
                            </WrapPassword>
                            <p className="subtitleText">
                                Authorizing will allow this site to carry out this operation for you. Always make sure you trust the sites you interact with.
                            </p>
                        </div>
                    </Container>
                    {beaconLoading && <Loader />}
                    <Footer>
                        <ButtonContainer>
                            <WhiteBtn buttonTheme="secondary" onClick={onClose}>
                                {t('general.verbs.cancel')}
                            </WhiteBtn>
                            <InvokeButton buttonTheme="primary" onClick={onAuthorize}>
                                {t('general.verbs.authorize')}
                            </InvokeButton>
                        </ButtonContainer>
                    </Footer>
                </ModalContainer>
            ) : (
                <ModalContainer />
            )}
        </ModalWrapper>
    );
};

export default BeaconAuthorize;
