// The example blitz: a made-up savings app, Fernly, half way through a session. The product, the
// flows and the findings are illustrative, not from a real product or a real test.

const at = (min) => new Date(Date.UTC(2026, 9, 12, 10, min)).toISOString();

const f = (id, min, heuristic, severity, status, reporter, note) => ({
  id,
  note,
  heuristic,
  severity,
  status,
  reporter,
  screenshot: null,
  createdAt: at(min),
  updatedAt: at(min),
});

export const SAMPLE = {
  id: 'example',
  sampleRev: 2, // bump when the example changes: browsers holding an older copy get this one (core.js loadStore)
  product: 'Fernly, a savings app',
  url: '',
  createdAt: at(0),
  timer: { minutes: 30, startedAt: null, spent: 21 * 60 },
  flows: [
    { id: 'signup', label: 'Sign up and verify your email' },
    { id: 'link', label: 'Link a bank account' },
    { id: 'goal', label: 'Create a savings goal' },
    { id: 'deposit', label: 'Move money into a goal' },
    { id: 'withdraw', label: 'Withdraw from a goal' },
    { id: 'fail', label: 'A transfer that fails' },
    { id: 'phone', label: 'Every flow again on a phone' },
  ],
  done: ['signup', 'link', 'goal', 'deposit'],
  findings: [
    f(
      's1',
      4,
      'visibility',
      'high',
      'triaged',
      'Wally',
      'After confirming a transfer the button just greys out. No spinner, no message. I tapped it again and it sent twice.',
    ),
    f('s2', 7, 'unsorted', 'medium', 'open', 'Jasper', 'Goal balance takes a full refresh to update after a deposit.'),
    f(
      's3',
      9,
      'real_world_match',
      'medium',
      'open',
      'Bertie',
      '“Sweep” on the goal screen. I had to guess it means moving leftover money in. Plain words, or a one-line explainer.',
    ),
    f(
      's4',
      11,
      'user_control',
      'high',
      'open',
      'Rob',
      'No way to back out of the link-a-bank flow once it starts. Closing the sheet drops me on the home screen with nothing saved.',
    ),
    f('s5', 13, 'consistency', 'low', 'sent', 'Jasper', 'Two styles of primary button: rounded on onboarding, square in settings.'),
    f(
      's6',
      15,
      'error_prevention',
      'critical',
      'triaged',
      'Wally',
      'Withdraw lets me enter more than the goal holds. It only fails after I confirm.',
    ),
    f('s7', 16, 'error_prevention', 'medium', 'open', 'Bertie', 'Empty amount field still enables Continue.'),
    f(
      's8',
      18,
      'unsorted',
      'low',
      'open',
      'Rob',
      'Interest breakdown, projections and a chart all on the goal card. Most of it can wait one tap.',
    ),
    f('s9', 21, 'general_ux', 'medium', 'dismissed', 'Jasper', 'Confetti on every deposit feels a lot by the third one.'),
  ],
};
