import * as core from '@actions/core';
const Github = require('@actions/github');
const { Octokit } = require("@octokit/rest");
const { retry } = require("@octokit/plugin-retry");
const token = core.getInput('token', { required: true });
const context = Github.context;
const MyOctokit = Octokit.plugin(retry)
const octokit = new MyOctokit({
  auth: token,
  request: {
    retries: 4,
    retryAfter: 60,
  },
});

async function run() {
  const owner = core.getInput('owner', { required: false }) || context.repo.owner;
  const base = core.getInput('base', { required: false });
  const head = core.getInput('head', { required: false });
  const mergeMethod = core.getInput('merge_method', { required: false });
  const prTitle = core.getInput('pr_title', { required: false });
  const prMessage = core.getInput('pr_message', { required: false });
  const ignoreFail = core.getInput('ignore_fail', { required: false });
  const autoApprove = core.getInput('auto_approve', { required: false });

  try {
    let pr = await octokit.pulls.create({ owner: context.repo.owner, repo: context.repo.repo, title: prTitle, head: owner + ':' + head, base: base, body: prMessage, merge_method: mergeMethod, maintainer_can_modify: false });
    await delay(20);
    if (autoApprove) {
        await octokit.pulls.createReview({ owner: context.repo.owner, repo: context.repo.repo, pull_number: pr.data.number, event: "COMMENT", body: "Auto approved" });
        await octokit.pulls.createReview({ owner: context.repo.owner, repo: context.repo.repo, pull_number: pr.data.number, event: "APPROVE" });
    }
  } catch (error) {
    if (error.request.request.retryCount) {
      console.log(
        `request failed after ${error.request.request.retryCount} retries with a delay of ${error.request.request.retryAfter}`
      );
    }
    if (!!error.errors && !!error.errors[0] && !!error.errors[0].message && error.errors[0].message.startsWith('No commits between')) {
      console.log('No commits between ' + context.repo.owner + ':' + base + ' and ' + owner + ':' + head);
    } else {
      if (!ignoreFail) {
        core.setFailed(`Failed to create or merge pull request: ${error ?? "[n/a]"}`);
      }
    }
  }
}

function delay(s: number) {
  return new Promise( resolve => setTimeout(resolve, s * 1000) );
}

run();
