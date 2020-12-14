import React from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

import { H3 } from '../../components/Heading';

const SectionContainer = styled.div`
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    flex-direction: column;
`;

const DefaultContainer = styled.div`
    flex-grow: 1;
    display: flex;
    justify-content: space-around;
    align-items: center;
    height: 100%;
    padding: 0px 50px;
`;

const WalletContainers = styled.div`
    display: flex;
    flex-direction: column;
    margin: 0 30px;
`;

const StyledPre = styled.pre`
    border: 1px solid #d0d0d0;
    background: white;
`;

const preContent = `
{
  "selectedNode": "Tezos Mainnet (nautilus.cloud)",
  "nodesList": [
      {
          "displayName": "Tezos Mainnet (nautilus.cloud)",
          "platform": "tezos",
          "network": "mainnet",
          "tezosUrl": "https://tezos-prod.cryptonomic-infra.tech:443",
          "conseilUrl": "https://conseil-prod.cryptonomic-infra.tech:443",
          "apiKey": "galleon"
      },
      {
          "displayName": "Tezos Mainnet (nautilus.cloud + giganode.io)",
          "platform": "tezos",
          "network": "mainnet",
          "tezosUrl": "https://mainnet-tezos.giganode.io",
          "conseilUrl": "https://conseil-prod.cryptonomic-infra.tech:443",
          "apiKey": "galleon"
      },
      {
          "displayName": "Tezos Testnet (nautilus.cloud)",
          "platform": "tezos",
          "network": "carthagenet",
          "tezosUrl": "https://tezos-dev.cryptonomic-infra.tech:443",
          "conseilUrl": "https://conseil-dev.cryptonomic-infra.tech:443",
          "apiKey": "galleon"
      }
  ],
  "selectedPath": "Default",
  "pathsList": [
      {
          "label": "Default",
          "derivation": "44'/1729'/0'/0'/0'"
      },
      {
          "label": "Ledger Live",
          "derivation": "44'/1729'/0'/0'"
      },
      {
          "label": "TezBox",
          "derivation": "44'/1729'/0'/0'"
      }
  ]
}

`;

function WalletNodesRequired() {
    const { t } = useTranslation();
    return (
        <SectionContainer>
            <DefaultContainer>
                <WalletContainers>
                    <H3>{t('containers.walletNodesRequired.configuration_missing')}</H3>
                    <p>
                        {t('containers.walletNodesRequired.close_wallet_description')}
                        <br />
                        {t('containers.walletNodesRequired.default_wallet_shape')}
                    </p>
                    <StyledPre>{preContent}</StyledPre>
                </WalletContainers>
            </DefaultContainer>
        </SectionContainer>
    );
}

export default WalletNodesRequired;
