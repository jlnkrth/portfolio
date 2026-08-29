# Social posts — repo storage

Social threads live here for portfolio reference. They are **not** published on kreth.work.

## Layout

```
social/<slug>/
  post.md       # thread copy + YAML frontmatter
  assets/       # screenshots, GIFs, exports
```

## Frontmatter

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | Internal label — sentence case |
| `slug` | yes | kebab-case, matches folder name |
| `platform` | yes | `x`, `linkedin`, `threads`, etc. |
| `status` | yes | `draft` or `published` |
| `date` | yes | ISO `YYYY-MM-DD` |
| `author` | yes | `"Julian Kreth"` |
| `related_note` | no | Slug of a future/published note under `notes/` |
| `thread` | yes | Array of `{ text, image }` — one entry per post in the thread |

## Keeping posts off the website

The portfolio is static HTML with no build filter. Hidden means **not linked and not indexed**:

1. Do **not** add social posts to `data/notes.json`, homepage Writing, or any nav.
2. `robots.txt` disallows `/social/`.
3. No sitemap entries for social paths.

## Publishing checklist

- [ ] Drop screenshots into `assets/` (name to match `thread[].image`)
- [ ] Proofread each `thread[].text` for character limits (X: 280; adjust for platform)
- [ ] Set `status: published` and add publish date if different from draft date
- [ ] When the related note exists, fill `related_note` and add the link to the final thread post
