# CTF Auto-Sync Registry

Drop a new subfolder here with an `event.json` file to add a CTF event to the platform.
Click "Sync Now" on the SysAdmin CTF tab (or `POST /api/v1/admin/ctf/sync`) to pick it up —
same convention as the `labs/` folder.

Events are matched by `title` and challenges by `title` within that event, so re-running
sync after editing `event.json` updates the existing rows instead of duplicating them.

## event.json format

```json
{
  "title": "Example Web CTF",
  "description": "A beginner-friendly web exploitation CTF.",
  "start_time": "2026-09-01T09:00:00",
  "end_time": "2026-09-01T18:00:00",
  "status": "scheduled",
  "is_public": true,
  "challenges": [
    {
      "title": "SQL Injection 101",
      "category": "Web",
      "description": "Bypass the login form.",
      "connection_string": null,
      "challenge_url": "http://example.com/challenge1",
      "scoring_mode": "static",
      "static_points": 100,
      "flag": "flag{example_flag_here}",
      "is_hidden": false
    }
  ]
}
```

Required fields: `title`, `description`, `start_time`, `end_time` at the event level;
`title`, `category`, `flag` at the challenge level. Everything else is optional.
