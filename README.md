# BTCUSD Levels

Options-derived Bitcoin levels on GitHub Pages. Information only, not financial advice.

## Setup
1. Create a new public GitHub repository.
2. Add all files to the root. Create the workflow with **Add file > Create new file**, named `.github/workflows/analyze.yml`, and paste its contents.
3. **Settings > Actions > General > Workflow permissions**: choose **Read and write**, then Save.
4. **Settings > Pages**: Deploy from a branch, `main`, `/ (root)`.
5. **Actions > Analyze BTC levels > Run workflow**.

`data_prev.json` is created by the first run.

## Schedule (every day)
| Session | Kenya time | UTC |
|---|---|---|
| Asian | 03:30 | 00:30 |
| London | 12:00 | 09:00 |
| New York | 17:33 | 14:33 |

## Test checklist
- Countdown shows the next session, including weekends.
- A manual run removes the sample banner.
- Both tabs work; `#chart` opens the chart.
- Chart pans, zooms and shows a crosshair; lines match labels.
- Stale banner appears only after 14 hours.
- A repository search for unrelated asset names finds nothing.

## Not yet included
Indicators, alarms, buy/sell signals and the alert log.
