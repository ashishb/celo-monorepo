// This is a helpful script to figure out whether to run incremental testing in a directory or not.
// Say the caller is in the celotool dir and wants to check if celotool or protocol dir has changed then
// the sample usage will be
// node -r ts-node/register scripts/check_if_test_should_run_v2.ts --dirs packages/protocol,packages/celotool
// Prints "true" to stdout if the tests should run
// Prints "false" otherwise
// All console logging intentionally sent to stderr, so that, stdout is not corrupted
import { execCmdWithExitOnFailure } from '@celo/celotool/src/lib/utils'
import { existsSync } from 'fs'
import fetch from 'node-fetch'

const argv = require('minimist')(process.argv.slice(2))
const dirs: string[] = argv.dirs.split(',')
main()

async function main() {
  // TODO(ashishb): testing only
  // Delete this whole block
  // process.env.PULL_REQUEST_FROM_ANOTHER_REPO = 'true'
  // process.env.CIRCLE_PROJECT_USERNAME = 'celo-org'
  // process.env.CIRCLE_PROJECT_REPONAME = 'celo-monorepo'
  // process.env.CIRCLE_PR_NUMBER = '551'
  // logMessage((await getBranchCommits()).toString())
  // process.exit(1)

  try {
    await checkIfTestShouldRun()
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

async function checkIfTestShouldRun() {
  const currentBranch: string = await getCurrentBranch()
  const isCriticalBranch: boolean =
    isStagingBranch(currentBranch) ||
    isProductionBranch(currentBranch) ||
    isMasterBranch(currentBranch)
  if (isCriticalBranch) {
    logMessage('We are on staging or production branch')
    console.info('true')
    return
  }

  const branchCommits: string[] = await getBranchCommits()
  if (branchCommits.length === 0) {
    logMessage('No commits found; this is most likely a bug in the checking script')
    process.exit(1)
  }
  for (const commit of branchCommits) {
    logMessage(`\nChecking commit ${commit}...`)
    const paths: string[] = dirs.concat(['../../yarn.lock'])
    const anyPathsChanged: boolean = await checkIfAnyPathsChangedInCommit(commit, paths)
    if (anyPathsChanged) {
      console.info('true')
      return
    }
  }
  console.info('false')
}

async function checkIfAnyPathsChangedInCommit(commit: string, dirs: string[]): Promise<boolean> {
  logMessage(`Checking if any of the paths [${dirs}] have changed in commit ${commit}...`)
  for (const dir of dirs) {
    const changeCommit = await getChangeCommit(dir)
    if (commit == changeCommit) {
      logMessage(`\nDir "${dir}" has changed in commit ${commit}\n`)
      return true
    } else {
      logMessage(`Dir "${dir}" has not changed in commit ${commit}`)
    }
  }
  return false
}

async function getBranchCommits(): Promise<string[]> {
  // TODO(ashishb): delete this
  // if (pullRequestFromSameRepo()) {
  //   // "git rev-parse --abbrev-ref HEAD" returns the branch name
  //   // "git merge-base master $(git rev-parse --abbrev-ref HEAD)" returns the merge point of master and the current branch
  //   // And then we finally print out all the commit hashes between the two commits.
  //   const cmd =
  //     'git log --format=format:%H $(git merge-base master $(git rev-parse --abbrev-ref HEAD))..HEAD'
  //   const stdout = (await execCmdWithExitOnFailure(cmd))[0]
  //   const commitHashes = stdout.split('\n')
  //   logMessage(`Commit hashes in this branch are [${commitHashes}]`)
  //   const commits = stdout.split('\n')
  //   return commits.filter((x) => x.trim().length > 0)
  // } else {

  // GitHub + Circle CI-specific approach.
  const owner = process.env.CIRCLE_PROJECT_USERNAME
  const repo = process.env.CIRCLE_PROJECT_REPONAME
  const prNumber = process.env.CIRCLE_PR_NUMBER
  if (owner === undefined) {
    throw new Error('Environment variable CIRCLE_PROJECT_USERNAME is not defined')
  }
  if (repo === undefined) {
    throw new Error('Environment variable CIRCLE_PROJECT_REPONAME is not defined')
  }
  if (prNumber === undefined) {
    throw new Error('Environment variable CIRCLE_PR_NUMBER is not defined')
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/commits`
  const response: any = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'https://celo.org', // https://developer.github.com/v3/#user-agent-required
    },
  })
  if (response.status !== 200) {
    throw new Error(
      `Failed to get commits from GitHub, url: "${url}", status: ${
        response.status
      } response: "${JSON.stringify(response)}"`
    )
  }
  const commitObjects: any = await response.json()
  if (commitObjects === undefined) {
    throw new Error(
      `Failed to get commits from GitHub, url: "${url}", response: "${JSON.stringify(response)}"`
    )
  }
  // logMessage(`Commit objects are ${JSON.stringify(commitObjects)}`)
  const commits = commitObjects.map((commitObject: any) => commitObject.sha)
  logMessage(`Commits corresponding to ${prNumber} are ${commits}`)
  return commits
  // }
}

// // Returns true if the PR is based off of a branch in the same repo.
// // Returns false if the PR is to merge a branch from a different repo
// // into the current repository configured on Circle CI.
// function pullRequestFromSameRepo(): boolean {
//   const prUserName = process.env.CIRCLE_PR_USERNAME
//   const prRepoName = process.env.CIRCLE_PR_REPONAME
//   const projectUserName = process.env.CIRCLE_PROJECT_USERNAME
//   const projectRepoName = process.env.CIRCLE_PROJECT_REPONAME
//   logMessage(`PR user name: ${prUserName}`)
//   logMessage(`PR repo name: ${prRepoName}`)
//   logMessage(`Project user name: ${projectUserName}`)
//   logMessage(`Project repo name: ${projectRepoName}`)
//   const pullRequestFromSameRepo = prRepoName === projectRepoName && prUserName === projectUserName
//   logMessage(`Pull request from same repo: ${pullRequestFromSameRepo}`)
//   return prRepoName === projectRepoName && prUserName === projectUserName
// }

async function getChangeCommit(file: string): Promise<string> {
  if (!existsSync(file)) {
    logMessage(`File "${file}" does not exist`)
    process.exit(1)
  }
  const cmd = `git log -1 --format=format:%H --full-diff ${file}`
  return (await execCmdWithExitOnFailure(cmd))[0].trim()
}

async function getCurrentBranch(): Promise<string> {
  const cmd = 'git rev-parse --abbrev-ref HEAD'
  return (await execCmdWithExitOnFailure(cmd))[0].trim()
}

function isStagingBranch(branchName: string): boolean {
  return branchName.endsWith('staging')
}

function isProductionBranch(branchName: string): boolean {
  return branchName.endsWith('production')
}

function isMasterBranch(branchName: string): boolean {
  return branchName === 'master'
}

function logMessage(message: string) {
  // Intentionally sent to stderr since bash will read stdout of this script
  console.error(message)
}
