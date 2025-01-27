import chalk from 'chalk'
import { cli } from 'cli-ux'
import { BaseCommand } from '../../base'
import { Args } from '../../utils/command'

export default class List extends BaseCommand {
  static description = "View information about all of the account's commitments"

  static flags = {
    ...BaseCommand.flags,
  }

  static args = [Args.address('account')]

  static examples = ['list 0x5409ed021d9299bf6814279a6a1411a7e866a631']

  async run() {
    const { args } = this.parse(List)
    cli.action.start('Fetching commitments...')
    const lockedGold = await this.kit.contracts.getLockedGold()
    const commitments = await lockedGold.getCommitments(args.account)
    cli.action.stop()

    cli.log(chalk.bold.yellow('Total Gold Locked \t') + commitments.total.gold)
    cli.log(chalk.bold.red('Total Account Weight \t') + commitments.total.weight)
    if (commitments.locked.length > 0) {
      cli.table(commitments.locked, {
        noticePeriod: { header: 'NoticePeriod', get: (a) => a.time.toString() },
        value: { get: (a) => a.value.toString() },
      })
    }
    if (commitments.notified.length > 0) {
      cli.table(commitments.notified, {
        availabilityTime: { header: 'AvailabilityTime', get: (a) => a.time.toString() },
        value: { get: (a) => a.value.toString() },
      })
    }
  }
}
