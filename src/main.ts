import * as core from "@actions/core"
import * as github from "@actions/github"
import * as yaml from "js-yaml"
import * as utils from "./utils"

async function run() {
  try {
    const token = core.getInput("repo-token", { required: true })
    const configPath = core.getInput("configuration-path", { required: true })
    const imageTag = core.getInput("image-tag", { required: true })
    const destinationToken = core.getInput("target-token", { required: true })

    const octokit = github.getOctokit(token)
    // read config yaml file
    const configurationContent: string = await utils.fetchContent(octokit, configPath)

    // loads (hopefully) a `{[label:string]:string | StringOrMatchConfig[]}` but is `any`:
    const configObject: any = yaml.load(configurationContent)

    console.log({ configObject })

    const configMap = utils.verifyConfigObject(configObject)

    const targetRepoName = configMap["repo-name"]
    const targetFileName = configMap["output-file"]
    const recordFileName = configMap["record-file"]
    const targetBranchName = configMap["branch-name"]

    if (!targetRepoName) {
      throw new Error("repo-name missing from config file")
    }
    if (!targetFileName) {
      throw new Error("output-file missing from config file")
    }
    if (!recordFileName) {
      throw new Error("record-file missing from config fie")
    }

    // fetch record-file
    const recordFile = await utils.fetchContent(octokit, recordFileName, targetRepoName)
    // check for image-tag entry in recordFile
    let imageRecords: any = yaml.load(recordFile)

    let updatedImageRecords = utils.updateImageTag(imageRecords, imageTag)

    const targetFileContents = utils.createOrUpdateSummary(updatedImageRecords)

    await utils.updateMultipleFiles(
      destinationToken,
      targetRepoName,
      targetBranchName || "main",
      `Update info for ${imageTag}`,
      {
        [recordFileName]: yaml.dump(updatedImageRecords),
        [targetFileName]: targetFileContents,
      }
    )
  } catch (error) {
    core.error(error)
    core.setFailed(error.message)
  }
}

run()
