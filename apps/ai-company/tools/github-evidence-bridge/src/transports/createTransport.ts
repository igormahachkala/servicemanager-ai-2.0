/**
 * GitHub Evidence Bridge — transport factory (AI-COMPANY-114).
 */

import type { GitHubEvidenceBridgeConfig } from '../config.ts'
import type { GitHubEvidenceTransport } from '../../../../src/domain/githubEvidenceReader/githubEvidenceReaderTypes.ts'
import { createGhCliTransport } from './ghCliTransport.ts'
import { createGitTransport } from './gitTransport.ts'
import { createGithubApiTransport } from './githubApiTransport.ts'

export function createGitHubEvidenceTransport(config: GitHubEvidenceBridgeConfig): GitHubEvidenceTransport {
  switch (config.mode) {
    case 'git':
      return createGitTransport(config)
    case 'github_api':
      return createGithubApiTransport(config)
    case 'gh_cli':
    default:
      return createGhCliTransport(config)
  }
}
