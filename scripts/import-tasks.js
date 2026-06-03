/**
 * Import all tasks from tasks.json → planit.pk
 *
 * BEFORE RUNNING:
 *   Optionally update AUTH_TOKEN if your session has expired.
 *
 * RUN:
 *   node scripts/import-tasks.js
 *
 * The script adds a 300ms delay between requests to avoid rate limiting.
 * If a task fails it logs the error and continues with the next one.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const API_URL    = 'https://backend.planit.pk/api/v1/tasks/create';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo1LCJjb21wYW55X2lkIjoxMiwicm9sZV9pZCI6MTQsInJvbGVfdGl0bGUiOiJUZWFtIExlYWQiLCJpc19oZWFkIjoieWVzIiwiZGVwYXJ0bWVudF9pZCI6MywiZW1haWwiOiJ6YW5hZW5AdnJveC5jby51ayIsInBvbGljeSI6eyJfaWQiOiI2YTE1NGU0NjdiYTYzZGNmMWVmZWFhYmEiLCJpZCI6MjA5OCwiY29tcGFueV9pZCI6MTIsInBvbGljeV9pZCI6MTYsInVzZXJfaWQiOjUsImxlYXZlUG9saWN5IjpbeyJsZWF2ZV90eXBlX2lkIjoxLCJsZWF2ZV90eXBlX25hbWUiOiJBbm51YWwiLCJhbGxvd2VkX2xlYXZlcyI6MTUsInVuaXQiOiJkYXlzIiwiY2FycnlfZm9yd29yZCI6MCwiY29uc2VjdXRpdmVfYWxsb3dlZCI6NSwicHJvcmF0ZWQiOiJ5ZXMiLCJwYWlkX2xlYXZlcyI6MTUsImVuY2FzaGFibGUiOjAsImxlYXZlc2Vzc2lvbiI6MX0seyJsZWF2ZV90eXBlX2lkIjoyLCJsZWF2ZV90eXBlX25hbWUiOiJNYXRlcm5pdHkiLCJhbGxvd2VkX2xlYXZlcyI6NDAsInVuaXQiOiJkYXlzIiwiY2FycnlfZm9yd29yZCI6MCwiY29uc2VjdXRpdmVfYWxsb3dlZCI6NDAsInByb3JhdGVkIjoibm8iLCJwYWlkX2xlYXZlcyI6MTUsImVuY2FzaGFibGUiOjAsImxlYXZlc2Vzc2lvbiI6MX0seyJsZWF2ZV90eXBlX2lkIjozLCJsZWF2ZV90eXBlX25hbWUiOiJQYXRlcm5pdHkiLCJhbGxvd2VkX2xlYXZlcyI6MywidW5pdCI6ImRheXMiLCJjYXJyeV9mb3J3b3JkIjowLCJjb25zZWN1dGl2ZV9hbGxvd2VkIjozLCJwcm9yYXRlZCI6Im5vIiwicGFpZF9sZWF2ZXMiOjMsImVuY2FzaGFibGUiOjAsImxlYXZlc2Vzc2lvbiI6MX0seyJsZWF2ZV90eXBlX2lkIjo0LCJsZWF2ZV90eXBlX25hbWUiOiJNYXJyaWFnZSBMZWF2ZSIsImFsbG93ZWRfbGVhdmVzIjoxNSwidW5pdCI6ImRheXMiLCJjYXJyeV9mb3J3b3JkIjowLCJjb25zZWN1dGl2ZV9hbGxvd2VkIjoxNSwicHJvcmF0ZWQiOiJubyIsInBhaWRfbGVhdmVzIjoxMCwiZW5jYXNoYWJsZSI6MCwibGVhdmVzZXNzaW9uIjoxfSx7ImxlYXZlX3R5cGVfaWQiOjUsImxlYXZlX3R5cGVfbmFtZSI6IlVtcmFoIiwiYWxsb3dlZF9sZWF2ZXMiOjE1LCJ1bml0IjoiZGF5cyIsImNhcnJ5X2ZvcndvcmQiOjAsImNvbnNlY3V0aXZlX2FsbG93ZWQiOjE1LCJwcm9yYXRlZCI6Im5vIiwicGFpZF9sZWF2ZXMiOjEwLCJlbmNhc2hhYmxlIjowLCJsZWF2ZXNlc3Npb24iOjF9LHsibGVhdmVfdHlwZV9pZCI6NiwibGVhdmVfdHlwZV9uYW1lIjoiSGFqaiIsImFsbG93ZWRfbGVhdmVzIjo0MCwidW5pdCI6ImRheXMiLCJjYXJyeV9mb3J3b3JkIjowLCJjb25zZWN1dGl2ZV9hbGxvd2VkIjo0MCwicHJvcmF0ZWQiOiJubyIsInBhaWRfbGVhdmVzIjoxNSwiZW5jYXNoYWJsZSI6MCwibGVhdmVzZXNzaW9uIjoxfSx7ImxlYXZlX3R5cGVfaWQiOjcsImxlYXZlX3R5cGVfbmFtZSI6IkJlcmVhdmVtZW50IiwiYWxsb3dlZF9sZWF2ZXMiOjUsInVuaXQiOiJkYXlzIiwiY2FycnlfZm9yd29yZCI6MCwiY29uc2VjdXRpdmVfYWxsb3dlZCI6NSwicHJvcmF0ZWQiOiJubyIsInBhaWRfbGVhdmVzIjozLCJlbmNhc2hhYmxlIjowLCJsZWF2ZXNlc3Npb24iOjF9XSwiaHJQb2xpY3kiOlt7ImlkIjoxNiwibmFtZSI6IlN0YW5kYXJkIEhSIFBvbGljeSIsInN0YXR1cyI6MX1dLCJhdHRlbmRlbmNlUG9saWN5IjpbeyJsYXRlX2NvbWluZ190aW1lX2xlbmllbmN5IjoxNSwibGF0ZV9jb21pbmdfbW9udGhseV9idWNrZXQiOjQsImxhdGVfY29taW5nX3BlbmFsdHkiOjEsImlkIjoxNzYsInBvbGljeV9pZCI6MTYsImxlYXZlc2Vzc2lvbiI6MX1dfSwiaWF0IjoxNzgwNDgxNDI1LCJleHAiOjE3ODEwODYyMjV9.SM7pd0WhKTjGg1IwdkkOm_Y9yV7WZnrNPVGEXyuD0MQ';

const COMPANY_ID         = 12;
const COMPANY_IDENTIFIER = 'websouls';
const ASSIGN_TO          = 5;
const DUE_DATE           = '2026-06-10';   // adjust as needed
const DELAY_MS           = 300;            // ms between requests

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildDescription(task, epicTitle) {
  return (
    `<p><strong>[${task.epic}] ${epicTitle}</strong></p>` +
    `<p>${task.description}</p>`
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const data    = JSON.parse(readFileSync(join(__dirname, '../tasks.json'), 'utf8'));
  const epicMap = Object.fromEntries(data.epics.map((e) => [e.id, e.title]));

  let total   = 0;
  let success = 0;
  let failed  = 0;

  for (const sprint of data.sprints) {
    console.log(`\n── ${sprint.id}: ${sprint.title} ──`);

    for (const task of sprint.tasks) {
      total++;

      const payload = {
        company_id:            COMPANY_ID,
        company_identifier:    COMPANY_IDENTIFIER,
        title:                 task.title,
        assign_to:             ASSIGN_TO,
        due_date:              DUE_DATE,
        priority:              2,
        approval_required:     0,
        status:                'Pending',
        description:           buildDescription(task, epicMap[task.epic] ?? task.epic),
        is_recurring:          false,
        recurring_period:      '',
        recurring_time:        '09:00',
        recurringTotalCount:   0,
        recurring_exclude_days:[],
        project_id:            0,
        sprint_id:             null,
        parent_id:             0,
      };

      try {
        const res = await fetch(API_URL, {
          method:  'POST',
          headers: {
            'accept':       'application/json',
            'authtoken':    AUTH_TOKEN,
            'content-type': 'application/json',
            'origin':       'https://planit.pk',
            'referer':      'https://planit.pk/',
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));

        if (res.ok) {
          success++;
          console.log(`  ✓ [${task.id}] ${task.title}`);
        } else {
          failed++;
          console.error(`  ✗ [${task.id}] ${task.title} — HTTP ${res.status}: ${json?.message ?? JSON.stringify(json)}`);
        }
      } catch (err) {
        failed++;
        console.error(`  ✗ [${task.id}] ${task.title} — Network error: ${err.message}`);
      }

      await sleep(DELAY_MS);
    }
  }

  console.log(`\n──────────────────────────────────`);
  console.log(`Done. ${success}/${total} created, ${failed} failed.`);
}

main();
