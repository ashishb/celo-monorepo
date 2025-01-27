/* tslint:disable:no-console */

import { toFixed } from '@celo/protocol/lib/fixidity'
import { CeloContractName } from '@celo/protocol/lib/registry-utils'
import {
  deploymentForCoreContract,
  getDeployedProxiedContract,
} from '@celo/protocol/lib/web3-utils'
import { config } from '@celo/protocol/migrationsConfig'
import { ExchangeInstance, ReserveInstance, StableTokenInstance } from 'types'

const initializeArgs = async (): Promise<any[]> => {
  const stableToken: StableTokenInstance = await getDeployedProxiedContract<StableTokenInstance>(
    'StableToken',
    artifacts
  )
  return [
    config.registry.predeployedProxyAddress,
    stableToken.address,
    toFixed(config.exchange.spread).toString(),
    toFixed(config.exchange.reserveFraction).toString(),
    config.exchange.updateFrequency,
    config.exchange.minimumReports,
  ]
}

module.exports = deploymentForCoreContract<ExchangeInstance>(
  web3,
  artifacts,
  CeloContractName.Exchange,
  initializeArgs,
  async (exchange: ExchangeInstance) => {
    console.log('Setting Exchange as StableToken minter')
    const stableToken: StableTokenInstance = await getDeployedProxiedContract<StableTokenInstance>(
      'StableToken',
      artifacts
    )
    await stableToken.setMinter(exchange.address)

    console.log('Setting Exchange as a Reserve spender')
    const reserve: ReserveInstance = await getDeployedProxiedContract<ReserveInstance>(
      'Reserve',
      artifacts
    )
    await reserve.addSpender(exchange.address)
  }
)
