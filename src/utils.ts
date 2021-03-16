import * as github from "@actions/github"
import { GitHub } from "@actions/github/lib/utils"

let { Octokit } = require("@octokit/rest")
Octokit = Octokit.plugin(require("octokit-commit-multiple-files"))

function getPrNumber(): number | undefined {
  const pullRequest = github.context.payload.pull_request
  if (!pullRequest) {
    return undefined
  }
  return pullRequest.number
}

async function createOrUpdatePrComment(
  client: InstanceType<typeof GitHub>,
  prNumber: number,
  commentMessage: string
) {
  // get all the comments we currently have
  const { data: comments } = await client.issues.listComments({
    ...github.context.repo,
    issue_number: prNumber,
  })

  // check if there is already a comment by us
  const comment = comments.find((comment) => {
    return (
      comment.user?.login === "github-actions[bot]" &&
      comment.body?.startsWith("## Image Tag Publish Status\n")
    )
  })

  // if yes, update the comment
  if (comment) {
    await client.issues.updateComment({
      ...github.context.repo,
      comment_id: comment.id,
      body: commentMessage,
    })
  } else {
    // create a new comment
    await client.issues.createComment({
      ...github.context.repo,
      issue_number: prNumber,
      body: commentMessage,
    })
  }
}

async function fetchContent(
  client: InstanceType<typeof GitHub>,
  path: string,
  repo: string = github.context.repo.repo
): Promise<string> {
  try {
    const user = await client.users.getAuthenticated()
    const response: any = await client.repos.getContent({
      owner: user.data.login,
      repo,
      path,
    })

    return Buffer.from(response.data.content, response.data.encoding).toString()
  } catch (error) {
    console.log(error)
    return ""
  }
}

async function updateMultipleFiles(
  token: string,
  repo: string,
  branch: string,
  commitMessage: string,
  files: Record<string, string>
): Promise<string> {
  const octokit = new Octokit({
    auth: token,
  })
  const user = await octokit.users.getAuthenticated()
  return await octokit.repos.createOrUpdateFiles({
    owner: user.data.login,
    repo,
    branch,
    createBranch: true,
    changes: [
      {
        message: commitMessage,
        files,
      },
    ],
  })
}

function updateImageTag(records: Array<Record<string, string>>, newTag: string) {
  let recordsCopy: Array<any> = []
  if (records) {
    recordsCopy = [...records]
  }

  // if imageTag exists, update
  let isImageTagUpdated = false
  for (let i = 0; i < recordsCopy.length; i++) {
    let record = recordsCopy[i]
    if (record["name"] === newTag) {
      record["date"] = new Date().toString().slice(0, 24)
      isImageTagUpdated = true
      break
    }
  }
  // else create a new entry
  if (!isImageTagUpdated) {
    recordsCopy.push({
      name: newTag,
      date: new Date().toString().slice(0, 24),
    })
  }
  return recordsCopy
}

// TODO: Add file append functionality
function createOrUpdateSummary(imageRecords: Record<string, string>[]) {
  let message = "## Image Tag Publish Status\n"
  message += "| Tag | Publish Time |\n"
  message += "| :--- | :---: |\n"
  imageRecords.forEach((record) => {
    message += `| ${record.name} | ${record.date} |\n`
  })
  return message
}

export {
  getPrNumber,
  createOrUpdatePrComment,
  fetchContent,
  updateMultipleFiles,
  updateImageTag,
  createOrUpdateSummary,
}
