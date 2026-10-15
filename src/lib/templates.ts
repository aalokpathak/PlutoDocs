export interface Template {
  id: string;
  name: string;
  description: string;
  category: "Basic" | "Business" | "Personal" | "Education";
  html: string;
}

const today = () => new Date().toLocaleDateString(undefined, { dateStyle: "long" });

export function getTemplates(): Template[] {
  return [
    {
      id: "blank",
      name: "Blank document",
      description: "Start from an empty page",
      category: "Basic",
      html: "",
    },
    {
      id: "meeting-notes",
      name: "Meeting notes",
      description: "Agenda, decisions and action items",
      category: "Business",
      html: `
<h1>Weekly Team Sync</h1>
<p><strong>Date:</strong> ${today()} &nbsp;·&nbsp; <strong>Facilitator:</strong> Your name &nbsp;·&nbsp; <strong>Note taker:</strong> Teammate</p>
<div data-callout="info"><p><strong>Goal:</strong> Align on priorities for the next sprint and unblock open issues.</p></div>
<h2>Attendees</h2>
<ul><li><p>Alex Rivera — Product</p></li><li><p>Sam Chen — Engineering</p></li><li><p>Jordan Lee — Design</p></li></ul>
<h2>Agenda</h2>
<ol><li><p>Review last week's action items</p></li><li><p>Sprint priorities</p></li><li><p>Risks and blockers</p></li><li><p>Open floor</p></li></ol>
<h2>Discussion</h2>
<p>Summarise the key points of the conversation here.</p>
<h2>Decisions</h2>
<table><tbody><tr><th><p>Decision</p></th><th><p>Owner</p></th><th><p>Notes</p></th></tr><tr><td><p>Ship onboarding v2 behind a flag</p></td><td><p>Sam</p></td><td><p>Gradual rollout from Monday</p></td></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr></tbody></table>
<h2>Action items</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Share the rollout plan with support — <em>Alex, Friday</em></p></li><li data-type="taskItem" data-checked="false"><p>Finalise empty-state illustrations — <em>Jordan, Wednesday</em></p></li><li data-type="taskItem" data-checked="true"><p>Book the retro room</p></li></ul>`,
    },
    {
      id: "project-proposal",
      name: "Project proposal",
      description: "Problem, solution, scope, timeline and budget",
      category: "Business",
      html: `
<h1>Project Proposal: Customer Portal Redesign</h1>
<p><em>Prepared by Your Name · ${today()}</em></p>
<h2>Executive summary</h2>
<p>In two or three sentences, describe what you propose, why it matters now, and the outcome you expect.</p>
<h2>The problem</h2>
<p>Describe the current situation and its cost. Use evidence: support tickets, survey results, conversion data.</p>
<blockquote><p>“Finding my invoices takes five clicks and a phone call.” — Customer interview, March</p></blockquote>
<h2>Proposed solution</h2>
<ul><li><p><strong>Unified dashboard</strong> showing orders, invoices and support in one place</p></li><li><p><strong>Self-service</strong> billing changes without contacting support</p></li><li><p><strong>Accessibility</strong> to WCAG 2.2 AA throughout</p></li></ul>
<h2>Timeline</h2>
<table><tbody><tr><th><p>Phase</p></th><th><p>Deliverable</p></th><th><p>Duration</p></th></tr><tr><td><p>Discovery</p></td><td><p>Research findings, requirements</p></td><td><p>3 weeks</p></td></tr><tr><td><p>Design</p></td><td><p>Prototype and usability testing</p></td><td><p>4 weeks</p></td></tr><tr><td><p>Build</p></td><td><p>Production release</p></td><td><p>8 weeks</p></td></tr></tbody></table>
<h2>Budget</h2>
<p>Outline the estimated cost and what it covers.</p>
<div data-callout="warning"><p><strong>Risks:</strong> list the main risks and how you will mitigate them.</p></div>
<h2>Next steps</h2>
<ol><li><p>Approve discovery budget</p></li><li><p>Assign project sponsor</p></li></ol>`,
    },
    {
      id: "report",
      name: "Report",
      description: "Structured report with summary and findings",
      category: "Business",
      html: `
<h1>Quarterly Performance Report</h1>
<p><em>Q3 · ${today()}</em></p>
<div data-callout="note"><p><strong>Key takeaway:</strong> revenue grew 18% quarter-on-quarter, driven by the new subscription tier.</p></div>
<h2>1. Summary</h2>
<p>Provide a short overview of the period and the most important results.</p>
<h2>2. Key metrics</h2>
<table><tbody><tr><th><p>Metric</p></th><th><p>Q2</p></th><th><p>Q3</p></th><th><p>Change</p></th></tr><tr><td><p>Revenue</p></td><td><p>$1.20M</p></td><td><p>$1.42M</p></td><td><p>+18%</p></td></tr><tr><td><p>Active customers</p></td><td><p>8,400</p></td><td><p>9,350</p></td><td><p>+11%</p></td></tr><tr><td><p>Churn</p></td><td><p>3.1%</p></td><td><p>2.6%</p></td><td><p>−0.5 pt</p></td></tr></tbody></table>
<h2>3. Findings</h2>
<h3>3.1 What went well</h3>
<p>Describe successes.</p>
<h3>3.2 What needs attention</h3>
<p>Describe concerns.</p>
<h2>4. Recommendations</h2>
<ol><li><p>Recommendation one</p></li><li><p>Recommendation two</p></li></ol>`,
    },
    {
      id: "letter",
      name: "Business letter",
      description: "Formal letter layout",
      category: "Business",
      html: `
<p>Your Name<br>123 Main Street<br>City, State 00000<br>you@example.com</p>
<p>${today()}</p>
<p>Recipient Name<br>Title<br>Company<br>456 Business Ave<br>City, State 00000</p>
<p>Dear Recipient Name,</p>
<p>I am writing to … State the purpose of your letter clearly in the first paragraph.</p>
<p>Use the second paragraph to provide supporting details, context, or background information.</p>
<p>Close by summarising your request or next steps, and thank the reader for their time.</p>
<p>Sincerely,</p>
<p><br><strong>Your Name</strong><br>Your Title</p>`,
    },
    {
      id: "resume",
      name: "Résumé",
      description: "Clean one-page CV",
      category: "Personal",
      html: `
<h1 style="text-align: center">Alex Morgan</h1>
<p style="text-align: center">Product Designer · San Francisco, CA · alex@example.com · (555) 010-0199</p>
<hr>
<h2>Profile</h2>
<p>Product designer with 7 years of experience shipping consumer and B2B products. Strong in research, interaction design and design systems.</p>
<h2>Experience</h2>
<h3>Senior Product Designer — Northwind Labs</h3>
<p><em>2021 – Present</em></p>
<ul><li><p>Led the redesign of the onboarding flow, increasing activation by 23%</p></li><li><p>Built and maintained a cross-platform design system used by 40+ engineers</p></li></ul>
<h3>Product Designer — Contoso</h3>
<p><em>2017 – 2021</em></p>
<ul><li><p>Designed analytics dashboards for enterprise customers</p></li><li><p>Ran weekly usability testing sessions</p></li></ul>
<h2>Education</h2>
<p><strong>B.A. Interaction Design</strong> — State University, 2017</p>
<h2>Skills</h2>
<p>User research · Prototyping · Figma · Accessibility · HTML/CSS · Workshop facilitation</p>`,
    },
    {
      id: "planner",
      name: "Weekly planner",
      description: "Priorities and a checklist for each day",
      category: "Personal",
      html: `
<h1>Week of ${today()}</h1>
<div data-callout="success"><p><strong>Focus this week:</strong> one sentence about what matters most.</p></div>
<h2>Top priorities</h2>
<ol><li><p></p></li><li><p></p></li><li><p></p></li></ol>
${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  .map(
    (d) =>
      `<h3>${d}</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li><li data-type="taskItem" data-checked="false"><p></p></li></ul>`,
  )
  .join("")}
<h2>Notes</h2>
<p></p>`,
    },
    {
      id: "study-notes",
      name: "Study notes",
      description: "Cornell-style notes with key terms",
      category: "Education",
      html: `
<h1>Lecture 4: Introduction to Algorithms</h1>
<p><strong>Course:</strong> CS 101 &nbsp;·&nbsp; <strong>Date:</strong> ${today()}</p>
<h2>Key questions</h2>
<ul><li><p>What makes an algorithm efficient?</p></li><li><p>How do we compare two algorithms?</p></li></ul>
<h2>Notes</h2>
<p>An <strong>algorithm</strong> is a finite sequence of well-defined steps that solves a problem. We measure efficiency with <mark>Big-O notation</mark>.</p>
<pre><code class="language-python">def binary_search(items, target):
    lo, hi = 0, len(items) - 1
    while lo &lt;= hi:
        mid = (lo + hi) // 2
        if items[mid] == target:
            return mid
        if items[mid] &lt; target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1</code></pre>
<div data-callout="info"><p>Binary search runs in O(log n) time but requires a <strong>sorted</strong> list.</p></div>
<h2>Key terms</h2>
<table><tbody><tr><th><p>Term</p></th><th><p>Definition</p></th></tr><tr><td><p>Time complexity</p></td><td><p>How running time grows with input size</p></td></tr><tr><td><p>Space complexity</p></td><td><p>How memory use grows with input size</p></td></tr></tbody></table>
<h2>Summary</h2>
<p>Write a 2–3 sentence summary in your own words.</p>`,
    },
  ];
}
