@AGENTS.md

## Claude Code
- `.claude/rules/`의 규칙은 frontmatter `paths:`에 맞는 파일을 다룰 때만 자동으로 적용된다.
- 스킬 원본은 `.agents/skills/`. Claude Code가 찾을 수 있도록 `.claude/skills/`는 같은 폴더를 가리키는 링크로 둔다.
- `.claude/settings.json`의 권한·훅 설정은 사용자 요청 없이 수정하지 않는다.
