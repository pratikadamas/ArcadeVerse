/**
 * ArcadeVerse Safe Issue Publisher
 * Automated, rate-limited GitHub Actions issue creator.
 * Protects maintainer personal accounts by running under github-actions[bot] via GITHUB_TOKEN.
 */

const fs = require('fs');
const path = require('path');

const QUEUE_DIR = path.join(__dirname, '..', '.github', 'issue-queue');
const PENDING_FILE = path.join(QUEUE_DIR, 'pending.json');
const PUBLISHED_FILE = path.join(QUEUE_DIR, 'published.json');

const args = process.argv.slice(2);
const DRY_RUN = process.env.DRY_RUN === 'true' || args.includes('--dry-run');
const batchArg = args.find(a => /^\d+$/.test(a));
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || batchArg || '3', 10);
const REPO = process.env.GITHUB_REPOSITORY || 'DebasmitaBose0/ArcadeVerse';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanIssueBody(body) {
  if (!body) return '';
  // Strip duplicate check results or internal metadata if present, start directly from ## Problem
  const problemIndex = body.indexOf('## Problem');
  if (problemIndex !== -1) {
    return body.slice(problemIndex).trim();
  }
  return body.trim();
}

function filterAllowedLabels(labels) {
  if (!Array.isArray(labels)) return ['nsoc26', 'level3'];
  // Keep strictly ONLY nsoc and level labels (e.g. nsoc26, level3)
  const allowed = labels
    .map(l => String(l).trim())
    .filter(l => /^nsoc\d*$/i.test(l) || /^level\d+$/i.test(l));

  if (!allowed.some(l => /^nsoc/i.test(l))) allowed.unshift('nsoc26');
  if (!allowed.some(l => /^level/i.test(l))) allowed.push('level3');
  return allowed;
}

async function main() {
  console.log('=== ArcadeVerse Safe Issue Publisher ===');
  console.log(`Repository : ${REPO}`);
  console.log(`Batch Size : ${BATCH_SIZE}`);
  console.log(`Dry Run    : ${DRY_RUN}`);

  if (!fs.existsSync(PENDING_FILE)) {
    console.log(`[INFO] No pending issues file found at ${PENDING_FILE}. Nothing to do.`);
    return;
  }

  let pending = [];
  try {
    pending = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] Failed to parse ${PENDING_FILE}:`, err.message);
    process.exit(1);
  }

  if (!Array.isArray(pending) || pending.length === 0) {
    console.log('[INFO] Pending queue is empty. All issues published!');
    return;
  }

  let published = [];
  if (fs.existsSync(PUBLISHED_FILE)) {
    try {
      published = JSON.parse(fs.readFileSync(PUBLISHED_FILE, 'utf-8'));
    } catch (_) {
      published = [];
    }
  }

  if (!DRY_RUN && !TOKEN) {
    console.error('[ERROR] GITHUB_TOKEN or GH_TOKEN environment variable is required to publish issues.');
    process.exit(1);
  }

  const toPublish = pending.slice(0, BATCH_SIZE);
  console.log(`[INFO] Processing ${toPublish.length} issue(s) out of ${pending.length} in queue...`);

  const remaining = pending.slice(BATCH_SIZE);
  const newlyPublished = [];

  for (let i = 0; i < toPublish.length; i++) {
    const issue = toPublish[i];
    console.log(`\n----------------------------------------`);
    console.log(`[${i + 1}/${toPublish.length}] Preparing: "${issue.title}"`);
    const finalLabels = filterAllowedLabels(issue.labels);
    console.log(`Labels : ${finalLabels.join(', ')}`);

    if (DRY_RUN) {
      console.log(`[DRY-RUN] Would create issue. Body preview:`);
      console.log(issue.body.slice(0, 150) + '...\n[DRY-RUN] OK.');
      continue;
    }

    try {
      // Create issue via GitHub REST API
      const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'ArcadeVerse-Issue-Publisher-Bot',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          title: issue.title,
          body: cleanIssueBody(issue.body),
          labels: finalLabels
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[FAILED] HTTP ${res.status}: ${errorText}`);
        // If we hit secondary rate limit, stop the batch to be completely safe
        if (res.status === 403 || res.status === 429) {
          console.warn('[RATE-LIMIT] Hit rate limit threshold. Halting further issue creations in this run.');
          remaining.unshift(...toPublish.slice(i));
          break;
        }
        // Otherwise put back in queue and continue
        remaining.push(issue);
        continue;
      }

      const created = await res.json();
      console.log(`[SUCCESS] Created Issue #${created.number}: ${created.html_url}`);

      newlyPublished.push({
        number: created.number,
        title: created.title,
        url: created.html_url,
        published_at: new Date().toISOString()
      });

      // Crucial: 5-second cooling delay between issues to respect GitHub Secondary Rate Limits
      if (i < toPublish.length - 1) {
        console.log(`[DELAY] Cooling down for 5 seconds to prevent rate-limit triggers...`);
        await sleep(5000);
      }
    } catch (err) {
      console.error(`[ERROR] Network error creating issue:`, err.message);
      remaining.push(issue);
    }
  }

  if (!DRY_RUN) {
    // Update pending and published queues
    fs.writeFileSync(PENDING_FILE, JSON.stringify(remaining, null, 2), 'utf-8');
    const updatedPublished = [...published, ...newlyPublished];
    fs.writeFileSync(PUBLISHED_FILE, JSON.stringify(updatedPublished, null, 2), 'utf-8');

    console.log(`\n========================================`);
    console.log(`Published in this run : ${newlyPublished.length}`);
    console.log(`Remaining in queue    : ${remaining.length}`);
    console.log(`Pending queue updated at ${PENDING_FILE}`);
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
